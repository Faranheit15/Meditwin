from __future__ import annotations

from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import AppException, NotFoundError
from app.core.logging import get_logger
from app.models.patient import Condition, LabResult, Medication, Patient
from app.models.protocol import Protocol, ProtocolStatus
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.patient import PatientRead

router = APIRouter()
logger = get_logger(__name__)


@router.get("/", response_model=APIResponse[list[PatientRead]])
async def list_patients(
    protocol_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> APIResponse[list[PatientRead]]:
    started = perf_counter()
    if protocol_id:
        await _get_confirmed_protocol(db, protocol_id)

    result = await db.execute(
        select(Patient)
        .options(selectinload(Patient.medications), selectinload(Patient.conditions))
        .order_by(Patient.name.asc())
    )
    patients = result.scalars().all()
    latest_labs = await _load_latest_labs_map(db, [patient.id for patient in patients])

    payload = [
        PatientRead.model_validate(_serialize_patient(patient, latest_labs.get(patient.id, [])))
        for patient in patients
    ]
    if protocol_id:
        payload.sort(key=lambda patient: patient.pre_screen_score if patient.pre_screen_score is not None else -1.0, reverse=True)

    logger.info(
        "Patients listed",
        event="patients_list",
        patient_count=len(payload),
        protocol_id=protocol_id or "none",
        duration_ms=round((perf_counter() - started) * 1000, 2),
    )
    return APIResponse(data=payload, message="Patients retrieved.")


@router.get("/{patient_id}", response_model=APIResponse[PatientRead])
async def get_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> APIResponse[PatientRead]:
    started = perf_counter()
    result = await db.execute(
        select(Patient)
        .options(
            selectinload(Patient.lab_results),
            selectinload(Patient.medications),
            selectinload(Patient.conditions),
        )
        .where(Patient.id == patient_id)
    )
    patient = result.scalar_one_or_none()
    if patient is None:
        raise NotFoundError("Patient not found.")

    payload = PatientRead.model_validate(_serialize_patient(patient, patient.lab_results))
    logger.info(
        "Patient retrieved",
        event="patient_get",
        patient_id=patient_id,
        duration_ms=round((perf_counter() - started) * 1000, 2),
    )
    return APIResponse(data=payload, message="Patient retrieved.")


@router.post("/{patient_id}/documents", response_model=APIResponse[None])
async def upload_patient_document(
    patient_id: UUID,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[None]:
    raise AppException(501, f"Document upload for patient {patient_id} is not implemented yet.", "NOT_IMPLEMENTED")


@router.post("/{patient_id}/confirm-enrichment", response_model=APIResponse[None])
async def confirm_patient_enrichment(
    patient_id: UUID,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[None]:
    raise AppException(501, f"Patient enrichment confirmation for {patient_id} is not implemented yet.", "NOT_IMPLEMENTED")


async def _get_confirmed_protocol(db: AsyncSession, protocol_id: str) -> Protocol:
    protocol_uuid = UUID(protocol_id)
    result = await db.execute(select(Protocol).where(Protocol.id == protocol_uuid))
    protocol = result.scalar_one_or_none()
    if protocol is None:
        raise NotFoundError("Protocol not found.")
    if protocol.status != ProtocolStatus.CONFIRMED:
        raise AppException(400, "Protocol must be confirmed before screening patients.", "INVALID_PROTOCOL_STATUS")
    return protocol


async def _load_latest_labs_map(db: AsyncSession, patient_ids: list[UUID]) -> dict[UUID, list[LabResult]]:
    if not patient_ids:
        return {}

    ranked_results = (
        select(
            LabResult.id.label("id"),
            LabResult.patient_id.label("patient_id"),
            func.row_number()
            .over(
                partition_by=(LabResult.patient_id, LabResult.parameter),
                order_by=(LabResult.result_date.desc(), LabResult.created_at.desc()),
            )
            .label("row_number"),
        )
        .where(LabResult.patient_id.in_(patient_ids))
        .subquery()
    )

    result = await db.execute(
        select(LabResult)
        .join(ranked_results, ranked_results.c.id == LabResult.id)
        .where(ranked_results.c.row_number == 1)
    )
    latest_rows = result.scalars().all()
    latest_map: dict[UUID, list[LabResult]] = {}
    for row in latest_rows:
        latest_map.setdefault(row.patient_id, []).append(row)

    for rows in latest_map.values():
        rows.sort(key=lambda item: (item.parameter.lower(), item.result_date), reverse=False)
    return latest_map


def _serialize_patient(patient: Patient, lab_results: list[LabResult]) -> dict:
    ordered_labs = sorted(lab_results, key=lambda item: (item.parameter.lower(), item.result_date), reverse=False)
    ordered_meds = sorted(patient.medications, key=lambda item: item.start_date, reverse=True)
    ordered_conditions = sorted(patient.conditions, key=lambda item: item.onset_date, reverse=True)
    return {
        "id": str(patient.id),
        "name": patient.name,
        "age": patient.age,
        "sex": _enum_value(patient.sex),
        "primary_diagnosis": patient.primary_diagnosis,
        "pre_screen_score": patient.pre_screen_score,
        "risk_level": _enum_value(patient.risk_level),
        "lab_results": [
            {
                "parameter": lab.parameter,
                "value": lab.value,
                "unit": lab.unit,
                "date": lab.result_date,
                "reference_range": (lab.reference_low, lab.reference_high),
            }
            for lab in ordered_labs
        ],
        "medications": [
            {
                "name": med.name,
                "dose": med.dose,
                "frequency": med.frequency,
                "start_date": med.start_date,
                "end_date": med.end_date,
            }
            for med in ordered_meds
        ],
        "conditions": [
            {
                "name": condition.name,
                "icd_code": condition.icd_code,
                "onset_date": condition.onset_date,
            }
            for condition in ordered_conditions
        ],
        "fail_reasons": [],
        "created_at": patient.created_at,
        "updated_at": patient.updated_at,
    }


def _enum_value(value: object) -> str | None:
    if value is None:
        return None
    return str(getattr(value, "value", value))
