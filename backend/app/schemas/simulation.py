from __future__ import annotations

from datetime import datetime

from pydantic import ConfigDict, Field

from app.schemas.common import CamelModel


class PreScreenRequest(CamelModel):
    protocol_id: str


class FullSimulationRequest(CamelModel):
    protocol_id: str
    patient_id: str


class PreScreenPatientResult(CamelModel):
    id: str
    name: str
    age: int
    sex: str
    primary_diagnosis: str
    pre_screen_score: float | None
    risk_level: str | None
    fail_reasons: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PreScreenResponse(CamelModel):
    protocol_id: str
    total_patients: int
    results: list[PreScreenPatientResult] = Field(default_factory=list)


class ReasoningTraceResponse(CamelModel):
    id: str
    explanation: str
    risk_factors: list[str] = Field(default_factory=list)
    suggestion: str | None
    confidence_note: str

    model_config = ConfigDict(from_attributes=True)


class EvaluationResponse(CamelModel):
    id: str
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
    reasoning: ReasoningTraceResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class SimulationResponse(CamelModel):
    id: str
    protocol_id: str
    patient_id: str
    overall_risk: str
    risk_score: float
    compatibility_score: float
    evaluations: list[EvaluationResponse] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
