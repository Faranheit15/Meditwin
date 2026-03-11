from __future__ import annotations

import json
import re
from typing import Any

from pydantic import ValidationError

from app.core.logging import get_logger
from app.core.prompts import CRITERIA_EXTRACTION_SYSTEM_PROMPT, CRITERIA_EXTRACTION_USER_PROMPT
from app.schemas.protocol import CriterionCreate
from app.services.llm import GroqLLMService
from app.services.pdf_parser import PDFParserService

logger = get_logger(__name__)


class CriteriaExtractorService:
    """Orchestrates the full extraction pipeline: PDF -> text -> LLM -> structured criteria."""

    def __init__(self, llm_service: GroqLLMService, pdf_parser: PDFParserService) -> None:
        self.llm = llm_service
        self.pdf_parser = pdf_parser

    async def extract_from_pdf(self, pdf_bytes: bytes, protocol_id: str) -> list[CriterionCreate]:
        full_text = self.pdf_parser.extract_text(pdf_bytes)
        sections = self.pdf_parser.extract_sections(full_text)

        user_prompt = CRITERIA_EXTRACTION_USER_PROMPT.format(
            timeline=sections.get("study_timeline", "Not found - infer from criteria text"),
            inclusion_text=sections.get("inclusion_criteria", sections.get("full_text", "Not found")),
            exclusion_text=sections.get("exclusion_criteria", sections.get("full_text", "Not found")),
        )

        raw_response = await self.llm.chat(
            system_prompt=CRITERIA_EXTRACTION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
        criteria_dicts = self._parse_llm_response(raw_response)
        validated = self._validate_criteria(criteria_dicts, protocol_id)

        logger.info(
            "Criteria extraction completed",
            event="extract_complete",
            protocol_id=protocol_id,
            criteria_count=len(validated),
        )
        return validated

    def _parse_llm_response(self, response: str) -> list[dict[str, Any]]:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        parsed = self._load_json_candidate(cleaned)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
        if isinstance(parsed, dict):
            if isinstance(parsed.get("criteria"), list):
                return [item for item in parsed["criteria"] if isinstance(item, dict)]
            if isinstance(parsed.get("data"), list):
                return [item for item in parsed["data"] if isinstance(item, dict)]

        array_match = re.search(r"\[[\s\S]*\]", cleaned)
        if array_match:
            parsed = self._load_json_candidate(array_match.group(0))
            if isinstance(parsed, list):
                return [item for item in parsed if isinstance(item, dict)]

        logger.error("Failed to parse LLM response", event="extract_parse_failed", response=cleaned[:2000])
        raise ValueError("LLM response did not contain a valid criteria array.")

    def _load_json_candidate(self, candidate: str) -> Any:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            return None

    def _validate_criteria(self, criteria_dicts: list[dict[str, Any]], protocol_id: str) -> list[CriterionCreate]:
        validated: list[CriterionCreate] = []
        for index, criterion_dict in enumerate(criteria_dicts):
            try:
                validated.append(CriterionCreate.model_validate(criterion_dict))
            except ValidationError as exc:
                logger.warning(
                    "Criterion validation failed",
                    event="extract_validate_failed",
                    protocol_id=protocol_id,
                    index=index,
                    error=str(exc),
                )
                validated.append(self._build_review_criterion(criterion_dict))

        if not validated:
            logger.warning("No criteria validated", event="extract_no_criteria", protocol_id=protocol_id)
        return validated

    def _build_review_criterion(self, criterion_dict: dict[str, Any]) -> CriterionCreate:
        category = str(criterion_dict.get("category", "INCLUSION")).upper()
        if category not in {"INCLUSION", "EXCLUSION"}:
            category = "INCLUSION"

        operator = str(criterion_dict.get("operator", "BOOLEAN")).upper()
        if operator not in {"GTE", "LTE", "EQ", "NEQ", "BOOLEAN", "NOT_WITHIN", "STABLE"}:
            operator = "BOOLEAN"

        threshold_value = criterion_dict.get("threshold")
        if threshold_value is not None:
            try:
                threshold_value = float(threshold_value)
            except (TypeError, ValueError):
                threshold_value = None

        time_window = criterion_dict.get("time_window")
        if time_window is not None:
            try:
                time_window = int(time_window)
            except (TypeError, ValueError):
                time_window = None

        eval_schedule = criterion_dict.get("eval_schedule")
        if isinstance(eval_schedule, list):
            normalized_schedule = []
            for item in eval_schedule:
                try:
                    normalized_schedule.append(int(item))
                except (TypeError, ValueError):
                    continue
            eval_schedule = normalized_schedule or [0]
        else:
            eval_schedule = [0]

        return CriterionCreate(
            category=category,  # type: ignore[arg-type]
            original_text=str(criterion_dict.get("original_text") or criterion_dict or "Needs manual review"),
            parameter=str(criterion_dict.get("parameter") or "manual_review"),
            operator=operator,  # type: ignore[arg-type]
            threshold=threshold_value,
            unit=str(criterion_dict.get("unit")) if criterion_dict.get("unit") is not None else None,
            time_window=time_window,
            eval_schedule=eval_schedule,
            requires_review=True,
            confidence=0.3,
        )
