from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator

from app.schemas.common import CamelModel

CriterionCategoryLiteral = Literal["INCLUSION", "EXCLUSION"]
CriterionOperatorLiteral = Literal["GTE", "LTE", "EQ", "NEQ", "BOOLEAN", "NOT_WITHIN", "STABLE"]


def _normalize_status(value: object) -> str:
    if hasattr(value, "value"):
        raw_value = getattr(value, "value")
    else:
        raw_value = value
    return str(raw_value).upper()


def _normalize_operator(value: object) -> str:
    if hasattr(value, "name"):
        return str(getattr(value, "name")).upper()
    if hasattr(value, "value"):
        raw_value = getattr(value, "value")
    else:
        raw_value = value

    operator_map = {
        ">=": "GTE",
        "<=": "LTE",
        "==": "EQ",
        "!=": "NEQ",
        "BOOLEAN": "BOOLEAN",
        "NOT_WITHIN": "NOT_WITHIN",
        "STABLE": "STABLE",
    }
    return operator_map.get(str(raw_value), str(raw_value).upper())


class CriterionCreate(CamelModel):
    category: CriterionCategoryLiteral
    original_text: str
    parameter: str
    operator: CriterionOperatorLiteral
    threshold: float | None = None
    unit: str | None = None
    time_window: int | None = None
    eval_schedule: list[int] = Field(default_factory=list)
    requires_review: bool = False
    confidence: float

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, value: float) -> float:
        return max(0.0, min(1.0, value))


class CriterionUpdate(CamelModel):
    original_text: str | None = None
    parameter: str | None = None
    operator: CriterionOperatorLiteral | None = None
    threshold: float | None = None
    unit: str | None = None
    time_window: int | None = None
    eval_schedule: list[int] | None = None
    requires_review: bool | None = None
    confidence: float | None = None

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, value: float | None) -> float | None:
        if value is None:
            return None
        return max(0.0, min(1.0, value))


class CriterionResponse(CamelModel):
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

    model_config = ConfigDict(from_attributes=True)

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: object) -> str:
        if hasattr(value, "value"):
            return str(getattr(value, "value")).upper()
        return str(value).upper()

    @field_validator("operator", mode="before")
    @classmethod
    def normalize_operator(cls, value: object) -> str:
        return _normalize_operator(value)


class ProtocolResponse(CamelModel):
    id: UUID
    name: str
    version: str
    status: str
    file_name: str | None = None
    criteria_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: object) -> str:
        return _normalize_status(value)


class ProtocolWithCriteriaResponse(ProtocolResponse):
    criteria: list[CriterionResponse] = Field(default_factory=list)
