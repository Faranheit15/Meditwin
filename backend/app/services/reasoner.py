from __future__ import annotations

import json
import re
from typing import Any

from app.core.logging import get_logger
from app.core.prompts import REASONING_TRACE_SYSTEM_PROMPT, REASONING_TRACE_USER_PROMPT
from app.services.llm import GroqLLMService

logger = get_logger(__name__)


class ReasoningService:
    def __init__(self, llm_service: GroqLLMService) -> None:
        self.llm = llm_service

    async def generate_traces(
        self,
        patient_data: dict,
        evaluations: list[dict],
        twin_trends: dict | None = None,
    ) -> list[dict]:
        flagged = [evaluation for evaluation in evaluations if evaluation.get("status") in {"BORDERLINE", "FAIL"}]
        if not flagged:
            return []

        patient_summary = self._build_patient_summary(patient_data, twin_trends)
        evaluations_context = self._build_evaluations_context(flagged)
        raw_response = await self.llm.chat(
            system_prompt=REASONING_TRACE_SYSTEM_PROMPT,
            user_prompt=REASONING_TRACE_USER_PROMPT.format(
                patient_summary=patient_summary,
                evaluations_json=evaluations_context,
            ),
            temperature=0.3,
            max_tokens=4096,
            response_format=None,
        )

        parsed = self._parse_response(raw_response)
        traces_by_evaluation_id: dict[str, dict] = {}

        for item in parsed:
            evaluation_id = str(item.get("evaluation_id", "")).strip()
            if not evaluation_id:
                continue
            traces_by_evaluation_id[evaluation_id] = {
                "evaluation_id": evaluation_id,
                "explanation": str(item.get("explanation", "")).strip() or self._generate_fallback_trace(item)["explanation"],
                "risk_factors": [str(factor) for factor in item.get("risk_factors", []) if str(factor).strip()][:3],
                "suggestion": str(item.get("suggestion")).strip() if item.get("suggestion") else None,
                "confidence_note": str(item.get("confidence_note", "")).strip() or "LLM trace generated from simulation context.",
            }

        traces: list[dict] = []
        for evaluation in flagged:
            evaluation_id = str(evaluation.get("id") or evaluation.get("evaluation_id") or "")
            trace = traces_by_evaluation_id.get(evaluation_id)
            if trace is None:
                trace = self._generate_fallback_trace(evaluation)
            elif not trace["risk_factors"]:
                trace["risk_factors"] = self._generate_fallback_trace(evaluation)["risk_factors"]
            traces.append(trace)

        logger.info(
            "Reasoning traces generated",
            event="reasoning_generate",
            flagged_count=len(flagged),
            returned_count=len(traces),
        )
        return traces

    def _build_patient_summary(self, patient_data: dict, twin_trends: dict | None) -> str:
        active_medications = [
            medication.get("name", "unknown")
            for medication in patient_data.get("medications", [])
            if medication.get("end_date") in {None, ""}
        ]
        conditions = [condition.get("name", "unknown") for condition in patient_data.get("conditions", [])]

        trend_lines: list[str] = []
        if twin_trends:
            for parameter, trend in sorted(twin_trends.items()):
                current_value = trend.get("current_value")
                slope_per_week = float(trend.get("slope_per_week", 0.0))
                slope_per_month = round(slope_per_week * 4.345, 2)
                data_points = trend.get("data_points", 0)
                trend_lines.append(
                    f"{parameter}: current {current_value}, trend {slope_per_month:+}/month, "
                    f"{data_points} data points, r_squared {trend.get('r_squared', 0.0):.2f}"
                )

        return "\n".join(
            [
                f"Name: {patient_data.get('name', 'Unknown')}",
                f"Age: {patient_data.get('age', 'Unknown')}",
                f"Sex: {patient_data.get('sex', 'Unknown')}",
                f"Primary diagnosis: {patient_data.get('primary_diagnosis', 'Unknown')}",
                f"Active medications: {', '.join(active_medications) if active_medications else 'None documented'}",
                f"Conditions: {', '.join(conditions) if conditions else 'None documented'}",
                "Lab trends:",
                *trend_lines[:10],
            ]
        )

    def _build_evaluations_context(self, flagged: list[dict]) -> str:
        payload = [
            {
                "evaluation_id": evaluation.get("id"),
                "criterion_text": evaluation.get("criterion_text"),
                "parameter": evaluation.get("parameter"),
                "operator": evaluation.get("operator"),
                "threshold": evaluation.get("threshold"),
                "week": evaluation.get("week"),
                "status": evaluation.get("status"),
                "projected_value": evaluation.get("projected_value"),
                "margin_percent": evaluation.get("margin_percent"),
                "confidence": evaluation.get("confidence"),
            }
            for evaluation in flagged
        ]
        return json.dumps(payload, indent=2)

    def _generate_fallback_trace(self, evaluation: dict) -> dict:
        evaluation_id = str(evaluation.get("id") or evaluation.get("evaluation_id") or "")
        status = str(evaluation.get("status", "BORDERLINE"))
        parameter = str(evaluation.get("parameter", "unknown"))
        value = evaluation.get("projected_value")
        threshold = evaluation.get("threshold")
        week = int(evaluation.get("week", 0) or 0)
        margin = round(float(evaluation.get("margin_percent", 0.0) or 0.0), 2)

        if status == "FAIL":
            if week == 0:
                explanation = (
                    f"Patient's current {parameter} value of {value} does not meet the threshold of {threshold}. "
                    "This criterion is not satisfied at screening."
                )
            else:
                explanation = (
                    f"Projected {parameter} of {value} at Week {week} breaches the threshold of {threshold} "
                    f"(margin {margin}%). Based on the current trend, this criterion will not be met."
                )
            suggestion = f"Consider additional evaluation of {parameter} before proceeding."
        else:
            explanation = (
                f"Patient's {parameter} of {value} is within 20% of the threshold ({threshold}). "
                f"Current margin is {margin}%, indicating elevated risk of future breach."
            )
            suggestion = f"Monitor {parameter} closely and consider more frequent testing."

        return {
            "evaluation_id": evaluation_id,
            "explanation": explanation,
            "risk_factors": [f"{parameter} near threshold", f"Margin: {margin}%"],
            "suggestion": suggestion,
            "confidence_note": f"Week {week} projection" if week > 0 else "Current value assessment",
        }

    def _parse_response(self, response: str) -> list[dict[str, Any]]:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        parsed = self._load_json_candidate(cleaned)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
        if isinstance(parsed, dict):
            for key in ("traces", "items", "data"):
                value = parsed.get(key)
                if isinstance(value, list):
                    return [item for item in value if isinstance(item, dict)]

        array_match = re.search(r"\[[\s\S]*\]", cleaned)
        if array_match:
            parsed = self._load_json_candidate(array_match.group(0))
            if isinstance(parsed, list):
                return [item for item in parsed if isinstance(item, dict)]

        logger.warning("Reasoning response could not be parsed", event="reasoning_parse_failed")
        return []

    def _load_json_candidate(self, candidate: str) -> Any:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            return None
