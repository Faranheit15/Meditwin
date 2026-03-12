from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np

from app.utils.clinical_mappings import has_condition, has_medication_within


@dataclass
class ParameterTrend:
    parameter: str
    current_value: float
    slope_per_week: float
    r_squared: float
    data_points: int
    standard_error: float
    last_date: date


@dataclass
class ProjectedValue:
    parameter: str
    week: int
    value: float
    lower_bound: float
    upper_bound: float
    confidence: float
    status: str


@dataclass
class ProjectedState:
    week: int
    values: dict[str, ProjectedValue]


class DigitalTwin:
    def __init__(
        self,
        patient_id: str,
        lab_results: list[dict],
        medications: list[dict],
        conditions: list[dict],
        patient_data: dict,
    ) -> None:
        self.patient_id = patient_id
        self.medications = medications
        self.conditions = conditions
        self.patient_data = patient_data
        self.trends: dict[str, ParameterTrend] = {}
        self._compute_trends(lab_results)

    def _compute_trends(self, lab_results: list[dict]) -> None:
        grouped: dict[str, list[dict]] = {}
        for lab in lab_results:
            param = str(lab["parameter"])
            grouped.setdefault(param, []).append(lab)

        for param, readings in grouped.items():
            readings.sort(key=lambda result: _coerce_date(result["result_date"]))

            values = [float(reading["value"]) for reading in readings]
            dates = [_coerce_date(reading["result_date"]) for reading in readings]
            latest_date = dates[-1]
            current_value = values[-1]

            if len(readings) >= 2:
                earliest = dates[0]
                weeks_from_start = [(_date - earliest).days / 7.0 for _date in dates]
                x = np.array(weeks_from_start)
                y = np.array(values)

                coeffs = np.polyfit(x, y, 1)
                slope = float(coeffs[0])
                y_pred = np.polyval(coeffs, x)
                ss_res = float(np.sum((y - y_pred) ** 2))
                ss_tot = float(np.sum((y - np.mean(y)) ** 2))
                r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
                r_squared = max(0.0, min(1.0, float(r_squared)))

                n = len(x)
                if n > 2 and ss_tot > 0:
                    mse = ss_res / (n - 2)
                    x_var = float(np.sum((x - np.mean(x)) ** 2))
                    standard_error = float(np.sqrt(mse / x_var)) if x_var > 0 else 0.0
                else:
                    standard_error = abs(slope) * 0.2

                self.trends[param] = ParameterTrend(
                    parameter=param,
                    current_value=current_value,
                    slope_per_week=slope,
                    r_squared=r_squared,
                    data_points=n,
                    standard_error=standard_error,
                    last_date=latest_date,
                )
            else:
                self.trends[param] = ParameterTrend(
                    parameter=param,
                    current_value=current_value,
                    slope_per_week=0.0,
                    r_squared=0.0,
                    data_points=1,
                    standard_error=abs(current_value) * 0.05,
                    last_date=latest_date,
                )

    def project_to(self, week: int) -> ProjectedState:
        values: dict[str, ProjectedValue] = {}

        for param, trend in self.trends.items():
            projected = trend.current_value + (trend.slope_per_week * week)
            time_decay = 1.0 / (1.0 + 0.02 * week)
            confidence = trend.r_squared * time_decay
            if trend.data_points == 1:
                confidence = 0.3 * time_decay

            margin = trend.standard_error * float(np.sqrt(week + 1)) * 1.96
            values[param] = ProjectedValue(
                parameter=param,
                week=week,
                value=round(projected, 2),
                lower_bound=round(projected - margin, 2),
                upper_bound=round(projected + margin, 2),
                confidence=round(max(0.0, min(1.0, confidence)), 3),
                status="projected",
            )

        return ProjectedState(week=week, values=values)

    def get_current_value(self, parameter: str) -> float | None:
        trend = self.trends.get(parameter)
        return trend.current_value if trend else None

    def has_parameter(self, parameter: str) -> bool:
        return parameter in self.trends

    def has_condition(self, condition_param: str) -> bool:
        return has_condition(condition_param, self.conditions)

    def has_medication_within(self, medication_param: str, days: int) -> bool:
        return has_medication_within(medication_param, days, self.medications)


def _coerce_date(value: object) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))
