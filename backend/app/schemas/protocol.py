from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.schemas.common import CamelModel


class CriterionRead(CamelModel):
    id: UUID
    protocol_id: UUID
    category: str
    original_text: str
    parameter: str
    operator: str
    threshold: float | None
    unit: str | None
    time_window: int | None
    eval_schedule: list[int]
    requires_review: bool
    confidence: float
    created_at: datetime
    updated_at: datetime


class ProtocolRead(CamelModel):
    id: UUID
    name: str
    version: str
    status: str
    criteria_count: int
    created_at: datetime
    updated_at: datetime


class CriterionUpdate(CamelModel):
    original_text: str | None = None
    parameter: str | None = None
    operator: str | None = None
    threshold: float | None = None
    unit: str | None = None
    time_window: int | None = None
    eval_schedule: list[int] | None = None
    requires_review: bool | None = None
