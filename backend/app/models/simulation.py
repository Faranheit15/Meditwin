from __future__ import annotations

from enum import Enum
from uuid import UUID

from sqlalchemy import Enum as SqlEnum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class EvaluationStatus(str, Enum):
    PASS = "PASS"
    BORDERLINE = "BORDERLINE"
    FAIL = "FAIL"


class Simulation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "simulations"

    protocol_id: Mapped[UUID] = mapped_column(ForeignKey("protocols.id"), index=True)
    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id"), index=True)
    created_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    overall_risk: Mapped[str] = mapped_column(String(16), default="MEDIUM")
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    compatibility_score: Mapped[float] = mapped_column(Float, default=0.0)

    protocol = relationship("Protocol", back_populates="simulations")
    patient = relationship("Patient", back_populates="simulations")
    created_by = relationship("User", back_populates="simulations")
    evaluations = relationship("Evaluation", back_populates="simulation", cascade="all, delete-orphan")


class Evaluation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "evaluations"

    simulation_id: Mapped[UUID] = mapped_column(ForeignKey("simulations.id", ondelete="CASCADE"), index=True)
    criterion_id: Mapped[UUID] = mapped_column(ForeignKey("criteria.id"), index=True)
    week: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[EvaluationStatus] = mapped_column(SqlEnum(EvaluationStatus, name="evaluation_status"))
    projected_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    margin_percent: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    simulation = relationship("Simulation", back_populates="evaluations")
    criterion = relationship("Criterion", back_populates="evaluations")
    reasoning_trace = relationship(
        "ReasoningTrace",
        back_populates="evaluation",
        cascade="all, delete-orphan",
        uselist=False,
    )


class ReasoningTrace(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "reasoning_traces"

    evaluation_id: Mapped[UUID] = mapped_column(
        ForeignKey("evaluations.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    explanation: Mapped[str] = mapped_column(Text)
    risk_factors: Mapped[list[str]] = mapped_column(JSON, default=list)
    suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_note: Mapped[str] = mapped_column(Text)

    evaluation = relationship("Evaluation", back_populates="reasoning_trace")
