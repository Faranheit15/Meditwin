from __future__ import annotations

from datetime import date
from enum import Enum
from uuid import UUID

from sqlalchemy import Date, Enum as SqlEnum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Sex(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class RiskLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Patient(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "patients"

    name: Mapped[str] = mapped_column(String(255), index=True)
    age: Mapped[int] = mapped_column(Integer)
    sex: Mapped[Sex] = mapped_column(SqlEnum(Sex, name="patient_sex"))
    primary_diagnosis: Mapped[str] = mapped_column(String(255))
    pre_screen_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_level: Mapped[RiskLevel | None] = mapped_column(SqlEnum(RiskLevel, name="risk_level"), nullable=True)
    created_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    created_by = relationship("User", back_populates="patients")
    lab_results = relationship("LabResult", back_populates="patient", cascade="all, delete-orphan")
    medications = relationship("Medication", back_populates="patient", cascade="all, delete-orphan")
    conditions = relationship("Condition", back_populates="patient", cascade="all, delete-orphan")
    simulations = relationship("Simulation", back_populates="patient")


class LabResult(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "lab_results"

    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    parameter: Mapped[str] = mapped_column(String(255))
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(64))
    result_date: Mapped[date] = mapped_column(Date)
    reference_low: Mapped[float] = mapped_column(Float)
    reference_high: Mapped[float] = mapped_column(Float)

    patient = relationship("Patient", back_populates="lab_results")


class Medication(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "medications"

    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    dose: Mapped[str] = mapped_column(String(128))
    frequency: Mapped[str] = mapped_column(String(128))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    patient = relationship("Patient", back_populates="medications")


class Condition(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "conditions"

    patient_id: Mapped[UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    icd_code: Mapped[str] = mapped_column(String(32))
    onset_date: Mapped[date] = mapped_column(Date)

    patient = relationship("Patient", back_populates="conditions")
