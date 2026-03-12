from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from app.schemas.common import CamelModel


class LabResultRead(CamelModel):
    parameter: str
    value: float
    unit: str
    date: date
    reference_range: tuple[float, float]


class MedicationRead(CamelModel):
    name: str
    dose: str
    frequency: str
    start_date: date
    end_date: date | None


class ConditionRead(CamelModel):
    name: str
    icd_code: str
    onset_date: date


class PatientRead(CamelModel):
    id: UUID
    name: str
    age: int
    sex: str
    primary_diagnosis: str
    pre_screen_score: float | None
    risk_level: str | None
    lab_results: list[LabResultRead] = []
    medications: list[MedicationRead] = []
    conditions: list[ConditionRead] = []
    fail_reasons: list[str] = []
    created_at: datetime
    updated_at: datetime
