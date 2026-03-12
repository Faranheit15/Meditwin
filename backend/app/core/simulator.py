from __future__ import annotations

from dataclasses import dataclass, field

from app.core.twin import DigitalTwin

BORDERLINE_MARGIN = 0.20


@dataclass
class EvaluationResult:
    criterion_id: str
    criterion_text: str
    category: str
    week: int
    status: str
    projected_value: float | None
    threshold: float | None
    margin_percent: float
    confidence: float
    parameter: str
    operator: str


@dataclass
class SimulationOutput:
    patient_id: str
    protocol_id: str
    overall_risk: str
    risk_score: float
    compatibility_score: float
    evaluations: list[EvaluationResult] = field(default_factory=list)
    timeline_weeks: list[int] = field(default_factory=list)


class SimulationRunner:
    def run(
        self,
        twin: DigitalTwin,
        criteria: list[dict],
        timeline: list[int] | None = None,
    ) -> SimulationOutput:
        if timeline is None:
            all_weeks: set[int] = set()
            for criterion in criteria:
                schedule = criterion.get("eval_schedule", [0])
                if isinstance(schedule, list):
                    all_weeks.update(int(week) for week in schedule)
            timeline = sorted(all_weeks)

        if not timeline:
            timeline = [0]

        evaluations: list[EvaluationResult] = []
        for criterion in criteria:
            if criterion.get("requires_review", False):
                continue

            schedule = criterion.get("eval_schedule", [0])
            weeks_to_eval = schedule if isinstance(schedule, list) else [0]
            for week in weeks_to_eval:
                evaluations.append(self._evaluate_criterion(twin, criterion, int(week)))

        risk_score = self._compute_risk_score(evaluations)
        return SimulationOutput(
            patient_id=twin.patient_id,
            protocol_id="",
            overall_risk=self._classify_risk(risk_score),
            risk_score=round(risk_score, 4),
            compatibility_score=round((1.0 - risk_score) * 100, 1),
            evaluations=evaluations,
            timeline_weeks=timeline,
        )

    def _evaluate_criterion(self, twin: DigitalTwin, criterion: dict, week: int) -> EvaluationResult:
        parameter = str(criterion["parameter"])
        operator = str(criterion["operator"])
        threshold = criterion.get("threshold")
        category = str(criterion["category"])
        time_window = criterion.get("time_window")

        if operator == "BOOLEAN":
            has_it = twin.has_condition(parameter)
            status = "PASS" if (has_it if category == "INCLUSION" else not has_it) else "FAIL"
            return EvaluationResult(
                criterion_id=str(criterion["id"]),
                criterion_text=str(criterion.get("original_text", "")),
                category=category,
                week=week,
                status=status,
                projected_value=None,
                threshold=None,
                margin_percent=0.0,
                confidence=0.9,
                parameter=parameter,
                operator=operator,
            )

        if operator == "NOT_WITHIN":
            has_within = twin.has_medication_within(parameter, int(time_window or 0))
            status = "PASS" if not has_within else "FAIL"
            return EvaluationResult(
                criterion_id=str(criterion["id"]),
                criterion_text=str(criterion.get("original_text", "")),
                category=category,
                week=week,
                status=status,
                projected_value=None,
                threshold=None,
                margin_percent=0.0,
                confidence=0.85,
                parameter=parameter,
                operator=operator,
            )

        if operator == "STABLE":
            trend = twin.trends.get(parameter)
            if not trend:
                return self._insufficient_data_result(criterion, week)

            weeks_in_window = (time_window or 180) / 7.0
            total_change = abs(trend.slope_per_week * weeks_in_window)
            percent_change = (total_change / abs(trend.current_value) * 100) if trend.current_value != 0 else 0.0
            stable_threshold = float(threshold or 10.0)

            if percent_change <= stable_threshold * 0.8:
                status = "PASS"
            elif percent_change <= stable_threshold:
                status = "BORDERLINE"
            else:
                status = "FAIL"

            if category == "EXCLUSION":
                if status == "PASS":
                    status = "FAIL"
                elif status == "FAIL":
                    status = "PASS"

            margin = ((stable_threshold - percent_change) / stable_threshold * 100) if stable_threshold > 0 else 0.0
            return EvaluationResult(
                criterion_id=str(criterion["id"]),
                criterion_text=str(criterion.get("original_text", "")),
                category=category,
                week=week,
                status=status,
                projected_value=round(percent_change, 2),
                threshold=stable_threshold,
                margin_percent=round(margin, 2),
                confidence=round(trend.r_squared * 0.9, 3),
                parameter=parameter,
                operator=operator,
            )

        if threshold is None:
            return self._insufficient_data_result(criterion, week)

        projected = twin.project_to(week).values.get(parameter)
        if projected is None:
            if parameter == "age" and twin.patient_data.get("age") is not None:
                projected_value = float(twin.patient_data["age"])
                confidence = 1.0
            else:
                return self._insufficient_data_result(criterion, week)
        else:
            projected_value = float(projected.value)
            confidence = float(projected.confidence)

        numeric_threshold = float(threshold)
        rule_met = self._check_numeric(projected_value, operator, numeric_threshold)
        if numeric_threshold != 0:
            margin_percent = ((projected_value - numeric_threshold) / abs(numeric_threshold)) * 100
        else:
            margin_percent = 100.0 if projected_value > 0 else -100.0

        if category == "INCLUSION":
            status = "FAIL"
            if rule_met:
                status = "BORDERLINE" if abs(margin_percent) <= BORDERLINE_MARGIN * 100 else "PASS"
        else:
            if rule_met:
                status = "FAIL"
            else:
                status = "BORDERLINE" if abs(margin_percent) <= BORDERLINE_MARGIN * 100 else "PASS"

        return EvaluationResult(
            criterion_id=str(criterion["id"]),
            criterion_text=str(criterion.get("original_text", "")),
            category=category,
            week=week,
            status=status,
            projected_value=round(projected_value, 2),
            threshold=numeric_threshold,
            margin_percent=round(margin_percent, 2),
            confidence=round(confidence, 3),
            parameter=parameter,
            operator=operator,
        )

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

    def _insufficient_data_result(self, criterion: dict, week: int) -> EvaluationResult:
        return EvaluationResult(
            criterion_id=str(criterion["id"]),
            criterion_text=str(criterion.get("original_text", "")),
            category=str(criterion.get("category", "INCLUSION")),
            week=week,
            status="BORDERLINE",
            projected_value=None,
            threshold=criterion.get("threshold"),
            margin_percent=0.0,
            confidence=0.0,
            parameter=str(criterion.get("parameter", "unknown")),
            operator=str(criterion.get("operator", "BOOLEAN")),
        )

    def _compute_risk_score(self, evaluations: list[EvaluationResult]) -> float:
        if not evaluations:
            return 0.0

        total_weight = 0.0
        for evaluation in evaluations:
            if evaluation.status == "FAIL":
                total_weight += 1.0
            elif evaluation.status == "BORDERLINE":
                total_weight += 0.4
        return min(1.0, total_weight / len(evaluations))

    def _classify_risk(self, risk_score: float) -> str:
        if risk_score > 0.6:
            return "HIGH"
        if risk_score > 0.3:
            return "MEDIUM"
        return "LOW"
