from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.schemas.common import CamelModel


class ReasoningTraceRead(CamelModel):
    explanation: str
    risk_factors: list[str]
    suggestion: str | None
    confidence_note: str


class EvaluationRead(CamelModel):
    criterion_id: UUID
    criterion_text: str
    status: str
    projected_value: float | None
    threshold: float | None
    margin_percent: float
    confidence: float
    reasoning: ReasoningTraceRead | None = None


class TimePointResult(CamelModel):
    week: int
    evaluations: list[EvaluationRead]


class SimulationRead(CamelModel):
    id: UUID
    protocol_id: UUID
    patient_id: UUID
    overall_risk: str
    risk_score: float
    compatibility_score: float
    timeline: list[TimePointResult]
    created_at: datetime


class PreScreenRequest(CamelModel):
    protocol_id: UUID


class FullSimulationRequest(CamelModel):
    protocol_id: UUID
    patient_id: UUID
