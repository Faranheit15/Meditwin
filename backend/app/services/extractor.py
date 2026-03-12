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

# Parameters that are lab values / vitals and MUST be monitored across visits, not just screening
MONITORED_PARAMETERS = {
    "eGFR", "hemoglobin", "HbA1c", "ALT", "AST", "WBC", "platelets",
    "creatinine", "blood_pressure", "heart_rate", "weight",
    "fasting_glucose", "fasting_plasma_glucose",
}

# Parameters that are one-time checks at screening only
SCREENING_ONLY_PARAMETERS = {
    "age", "sex", "type_2_diabetes", "type_1_diabetes", "rheumatoid_arthritis", "BMI",
    "pregnancy_or_breastfeeding",
}

PARAMETER_NORMALIZATION = {
    "platelet count": "platelets",
    "platelet_count": "platelets",
    "white blood cell count": "WBC",
    "white_blood_cell_count": "WBC",
    "wbc": "WBC",
    "hba1c": "HbA1c",
    "egfr": "eGFR",
    "alt": "ALT",
    "ast": "AST",
    "bmi": "BMI",
    "anti-cd20 therapy": "anti_cd20_therapy",
    "anti_cd20_therapy": "anti_cd20_therapy",
    "anti-CD20 therapy": "anti_cd20_therapy",
    "anti_CD20_therapy": "anti_cd20_therapy",
    "informed consent": "informed_consent",
    "study compliance": "compliance",
    "contraception": "contraception",
    "effective_contraception": "contraception",
    "renal_function": "eGFR",
    "renal function": "eGFR",
    "malignancy_history": "malignancy",
    "malignancy history": "malignancy",
    "live_vaccine_administration": "live_vaccine",
    "live vaccine administration": "live_vaccine",
    "inadequate_response_to_conventional_dmard": "inadequate_dmard_response",
    "methotrexate_therapy": "stable_methotrexate",
    "prior_biologic_therapies":"prior_biologic_failures",
    "willingness_to_comply": "compliance",
}

ALWAYS_REQUIRES_REVIEW = {
    "informed_consent", "compliance", "contraception",
    "effective_contraception", "childbearing_contraception",
    "study_compliance", "inadequate_dmard_response",
    "stable_methotrexate", "tuberculosis_screening",
}

class CriteriaExtractorService:
    """Orchestrates the full extraction pipeline: PDF -> text -> LLM -> structured criteria."""

    def __init__(self, llm_service: GroqLLMService, pdf_parser: PDFParserService) -> None:
        self.llm = llm_service
        self.pdf_parser = pdf_parser

    async def extract_from_pdf(self, pdf_bytes: bytes, protocol_id: str) -> list[CriterionCreate]:
        logger.info(">>> USING UPDATED EXTRACTOR WITH EVAL_SCHEDULE FIX <<<")
        full_text = self.pdf_parser.extract_text(pdf_bytes)
        sections = self.pdf_parser.extract_sections(full_text)

        # Extract visit schedule as explicit week numbers for the LLM
        timeline_text = sections.get("study_timeline", "")
        visit_weeks = self._extract_visit_weeks(timeline_text or full_text)
        timeline_for_prompt = self._format_timeline(visit_weeks)

        user_prompt = CRITERIA_EXTRACTION_USER_PROMPT.format(
            timeline=timeline_for_prompt,
            inclusion_text=sections.get("inclusion_criteria", sections.get("full_text", "Not found")),
            exclusion_text=sections.get("exclusion_criteria", sections.get("full_text", "Not found")),
        )

        raw_response = await self.llm.chat(
            system_prompt=CRITERIA_EXTRACTION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )
        criteria_dicts = self._parse_llm_response(raw_response)
        validated = self._validate_criteria(criteria_dicts, protocol_id)

        # Post-process: normalize parameter names first, then fix schedules, review flags, and thresholds
        validated = self._normalize_parameters(validated)
        validated = self._fix_eval_schedules(validated, visit_weeks)
        validated = self._fix_requires_review(validated)
        validated = self._fix_thresholds(validated)
        validated = self._fix_operators(validated)

        logger.info(
            "Criteria extraction completed",
            event="extract_complete",
            protocol_id=protocol_id,
            criteria_count=len(validated),
            visit_weeks=visit_weeks,
        )
        return validated

    # ── Timeline Extraction ─────────────────────────────────────────────

    def _extract_visit_weeks(self, text: str) -> list[int]:
        """Parse visit schedule from protocol text to get week numbers.
        
        Looks for patterns like:
        - "Week 4", "Week 8", "Week 12"
        - "Visit 2  Week 4"
        - "Week 24 (Final)"
        """
        week_numbers: set[int] = set()

        # Pattern: "Week N" or "Wk N"
        week_pattern = re.findall(r"(?:Week|Wk)\s+(\d+)", text, re.IGNORECASE)
        for w in week_pattern:
            week_numbers.add(int(w))

        # Always include screening (Week 0)
        week_numbers.add(0)

        if len(week_numbers) <= 1:
            # Fallback: look for "Day N" and convert to weeks
            day_pattern = re.findall(r"Day\s+(\d+)", text, re.IGNORECASE)
            for d in day_pattern:
                day_val = int(d)
                if day_val > 0:
                    week_numbers.add(round(day_val / 7))

        if len(week_numbers) <= 1:
            # Last resort: common Phase II/III schedules
            logger.warning("Could not detect visit schedule, using default Phase II schedule")
            return [0, 4, 8, 12, 16]

        return sorted(week_numbers)

    def _format_timeline(self, visit_weeks: list[int]) -> str:
        """Format visit weeks into an explicit string for the LLM prompt."""
        week_labels = []
        for w in visit_weeks:
            if w == 0:
                week_labels.append("Screening (Week 0)")
            else:
                week_labels.append(f"Week {w}")
        return f"Visit weeks: {', '.join(week_labels)}\nWeek numbers for eval_schedule: {visit_weeks}"

    # ── Post-Processing Safety Net ──────────────────────────────────────

    def _fix_eval_schedules(self, criteria: list[CriterionCreate], visit_weeks: list[int]) -> list[CriterionCreate]:
        """Fix criteria where the LLM incorrectly assigned [0] to monitored parameters."""
        fixed_count = 0
        for criterion in criteria:
            is_monitored = (
                criterion.parameter.lower() in {p.lower() for p in MONITORED_PARAMETERS}
                or criterion.operator == "STABLE"
            )
            is_screening_only = criterion.eval_schedule == [0]
            is_not_boolean = criterion.operator not in ("BOOLEAN", "NOT_WITHIN")

            if is_monitored and is_screening_only and is_not_boolean:
                criterion.eval_schedule = visit_weeks
                fixed_count += 1
                logger.info(
                    "Fixed eval_schedule for monitored parameter",
                    event="eval_schedule_fixed",
                    parameter=criterion.parameter,
                    operator=criterion.operator,
                    new_schedule=visit_weeks,
                )

        if fixed_count > 0:
            logger.info(
                f"Post-processing fixed {fixed_count} eval_schedules",
                event="eval_schedule_fixes_applied",
                fixed_count=fixed_count,
            )
        return criteria

    def _normalize_parameters(self, criteria: list[CriterionCreate]) -> list[CriterionCreate]:
        """Normalize parameter names to match the patient database column names."""
        fixed_count = 0
        for criterion in criteria:
            normalized = PARAMETER_NORMALIZATION.get(criterion.parameter.lower().strip())
            if normalized and normalized != criterion.parameter:
                logger.info(
                    "Normalized parameter name",
                    event="parameter_normalized",
                    original=criterion.parameter,
                    normalized=normalized,
                )
                criterion.parameter = normalized
                fixed_count += 1
        if fixed_count > 0:
            logger.info(
                f"Post-processing normalized {fixed_count} parameter names",
                event="parameter_normalizations_applied",
                fixed_count=fixed_count,
            )
        return criteria

    def _fix_requires_review(self, criteria: list[CriterionCreate]) -> list[CriterionCreate]:
        """Fix requires_review flags based on known parameter types."""
        fixed_count = 0
        always_review = {p.lower() for p in ALWAYS_REQUIRES_REVIEW}
        all_automatable = {p.lower() for p in MONITORED_PARAMETERS | SCREENING_ONLY_PARAMETERS}
        for criterion in criteria:
            param_lower = criterion.parameter.lower().strip()

            # Force requires_review for known subjective criteria
            if param_lower in always_review:
                if not criterion.requires_review:
                    criterion.requires_review = True
                    fixed_count += 1
                continue

            # Force requires_review = False for known automatable criteria
            if param_lower in all_automatable:
                if criterion.requires_review:
                    criterion.requires_review = False
                    fixed_count += 1

        if fixed_count > 0:
            logger.info(
                f"Post-processing fixed {fixed_count} requires_review flags",
                event="requires_review_fixes_applied",
                fixed_count=fixed_count,
            )
        return criteria

    def _fix_thresholds(self, criteria: list[CriterionCreate]) -> list[CriterionCreate]:
        """Fix thresholds where the LLM used raw values instead of database-unit values.
        
        The patient database stores platelets in ×10³/µL (e.g., 220 = 220,000/µL).
        The LLM extracts 100000 from "≥100,000/µL" but the DB comparison needs 100.
        """
        THRESHOLD_FIXES = {
            "platelets": {
                "check": lambda t: t is not None and t >= 1000,
                "fix": lambda t: t / 1000.0,
                "unit": "×10³/µL",
            },
        }
        
        fixed_count = 0
        for criterion in criteria:
            fix_rule = THRESHOLD_FIXES.get(criterion.parameter)
            if fix_rule and criterion.threshold is not None:
                if fix_rule["check"](criterion.threshold):
                    old_val = criterion.threshold
                    criterion.threshold = fix_rule["fix"](criterion.threshold)
                    criterion.unit = fix_rule["unit"]
                    fixed_count += 1
                    logger.info(
                        "Fixed threshold unit mismatch",
                        event="threshold_fixed",
                        parameter=criterion.parameter,
                        old_value=old_val,
                        new_value=criterion.threshold,
                    )
        
        if fixed_count > 0:
            logger.info(
                f"Post-processing fixed {fixed_count} thresholds",
                event="threshold_fixes_applied",
                fixed_count=fixed_count,
            )
        return criteria

    def _fix_operators(self, criteria: list[CriterionCreate]) -> list[CriterionCreate]:
        """Fix operators where the LLM inverted the logic for exclusion criteria."""
        EXCLUSION_SHOULD_BE_GTE = {"ALT", "AST"}
        
        fixed_count = 0
        for criterion in criteria:
            if (criterion.category == "EXCLUSION" 
                and criterion.parameter in EXCLUSION_SHOULD_BE_GTE
                and criterion.operator == "LTE"
                and criterion.threshold is not None):
                criterion.operator = "GTE"
                fixed_count += 1
                logger.info(
                    "Fixed exclusion operator LTE→GTE",
                    event="operator_fixed",
                    parameter=criterion.parameter,
                )
        
        if fixed_count > 0:
            logger.info(
                f"Post-processing fixed {fixed_count} operators",
                event="operator_fixes_applied",
            )
        return criteria
    # ── LLM Response Parsing ────────────────────────────────────────────

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

    # ── Criteria Validation ─────────────────────────────────────────────

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
