from __future__ import annotations

from enum import Enum
from uuid import UUID

from sqlalchemy import Boolean, Enum as SqlEnum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ProtocolStatus(str, Enum):
    PROCESSING = "processing"
    EXTRACTED = "extracted"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class CriterionCategory(str, Enum):
    INCLUSION = "INCLUSION"
    EXCLUSION = "EXCLUSION"


class CriterionOperator(str, Enum):
    GTE = "GTE"
    LTE = "LTE"
    EQ = "EQ"
    NEQ = "NEQ"
    NOT_WITHIN = "NOT_WITHIN"
    STABLE = "STABLE"
    BOOLEAN = "BOOLEAN"


class Protocol(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "protocols"

    name: Mapped[str] = mapped_column(String(255), index=True)
    version: Mapped[str] = mapped_column(String(50), default="1.0")
    status: Mapped[ProtocolStatus] = mapped_column(
        SqlEnum(ProtocolStatus, name="protocol_status"),
        default=ProtocolStatus.PROCESSING,
    )
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criteria_count: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    uploaded_by = relationship("User", back_populates="protocols")
    criteria = relationship("Criterion", back_populates="protocol", cascade="all, delete-orphan")
    simulations = relationship("Simulation", back_populates="protocol")


class Criterion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "criteria"

    protocol_id: Mapped[UUID] = mapped_column(ForeignKey("protocols.id", ondelete="CASCADE"), index=True)
    category: Mapped[CriterionCategory] = mapped_column(SqlEnum(CriterionCategory, name="criterion_category"))
    original_text: Mapped[str] = mapped_column(Text)
    parameter: Mapped[str] = mapped_column(String(255))
    operator: Mapped[CriterionOperator] = mapped_column(SqlEnum(CriterionOperator, name="criterion_operator"))
    threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(64), nullable=True)
    time_window: Mapped[int | None] = mapped_column(Integer, nullable=True)
    eval_schedule: Mapped[list[int]] = mapped_column(JSON, default=list)
    requires_review: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    protocol = relationship("Protocol", back_populates="criteria")
    evaluations = relationship("Evaluation", back_populates="criterion")
