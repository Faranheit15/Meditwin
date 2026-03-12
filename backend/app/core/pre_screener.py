from __future__ import annotations

from dataclasses import dataclass

from app.utils.clinical_mappings import has_condition, has_medication_within


@dataclass
class PreScreenResult:
    patient_id: str
    patient_name: str
    score: float
    risk_level: str
    passed: int
    failed: int
    borderline: int
    total: int
    fail_reasons: list[str]


class PreScreener:
    def screen_patient(
        self,
        patient_data: dict,
        latest_labs: dict[str, float],
        medications: list[dict],
        conditions: list[dict],
        criteria: list[dict],
    ) -> PreScreenResult:
        passed = 0
        failed = 0
        borderline = 0
        fail_reasons: list[str] = []
        total = 0

        for criterion in criteria:
            if criterion.get("requires_review", False):
                continue

            parameter = str(criterion["parameter"])
            operator = str(criterion["operator"])
            threshold = criterion.get("threshold")
            category = str(criterion["category"])
            time_window = criterion.get("time_window")

            if operator == "STABLE":
                continue

            total += 1

            if operator == "BOOLEAN":
                has_required_condition = self._check_condition(parameter, conditions)
                if category == "INCLUSION":
                    if has_required_condition:
                        passed += 1
                    else:
                        failed += 1
                        fail_reasons.append(f"Missing required condition: {criterion.get('original_text', parameter)}")
                else:
                    if has_required_condition:
                        failed += 1
                        fail_reasons.append(f"Has excluded condition: {criterion.get('original_text', parameter)}")
                    else:
                        passed += 1
                continue

            if operator == "NOT_WITHIN":
                has_within = self._check_medication_within(parameter, int(time_window or 0), medications)
                if has_within:
                    failed += 1
                    fail_reasons.append(f"Medication within window: {criterion.get('original_text', parameter)}")
                else:
                    passed += 1
                continue

            if threshold is None:
                continue

            value = patient_data.get("age") if parameter == "age" else latest_labs.get(parameter)
            if value is None:
                borderline += 1
                continue

            numeric_value = float(value)
            numeric_threshold = float(threshold)
            rule_met = self._check_numeric(numeric_value, operator, numeric_threshold)
            margin = abs((numeric_value - numeric_threshold) / numeric_threshold * 100) if numeric_threshold != 0 else 100.0

            if category == "INCLUSION":
                if rule_met:
                    if margin < 20:
                        borderline += 1
                    else:
                        passed += 1
                else:
                    failed += 1
                    fail_reasons.append(f"{parameter} = {numeric_value} (need {operator} {numeric_threshold})")
            else:
                if rule_met:
                    failed += 1
                    fail_reasons.append(f"Excluded: {parameter} = {numeric_value} ({operator} {numeric_threshold})")
                else:
                    if margin < 20:
                        borderline += 1
                    else:
                        passed += 1

        score = round(((passed + borderline * 0.5) / total) * 100, 1) if total > 0 else 0.0
        if score < 60 or failed >= 2:
            risk_level = "HIGH"
        elif score < 85 or failed >= 1:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return PreScreenResult(
            patient_id=str(patient_data["id"]),
            patient_name=str(patient_data.get("name", "Unknown")),
            score=score,
            risk_level=risk_level,
            passed=passed,
            failed=failed,
            borderline=borderline,
            total=total,
            fail_reasons=fail_reasons[:5],
        )

    def _check_condition(self, parameter: str, conditions: list[dict]) -> bool:
        return has_condition(parameter, conditions)

    def _check_medication_within(self, parameter: str, days: int, medications: list[dict]) -> bool:
        return has_medication_within(parameter, days, medications)

    def _check_numeric(self, value: float, operator: str, threshold: float) -> bool:
        match operator:
            case "GTE":
                return value >= threshold
            case "LTE":
                return value <= threshold
            case "EQ":
                return abs(value - threshold) < 0.001
            case "NEQ":
                return abs(value - threshold) >= 0.001
            case _:
                return False
