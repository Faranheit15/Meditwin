from __future__ import annotations

from time import perf_counter
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import AppException, NotFoundError
from app.core.logging import get_logger
from app.core.pre_screener import PreScreener
from app.core.simulator import SimulationRunner
from app.core.twin import DigitalTwin
from app.models.patient import Patient, RiskLevel
from app.models.protocol import Criterion, Protocol, ProtocolStatus
from app.models.simulation import Evaluation, EvaluationStatus, ReasoningTrace, Simulation
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.simulation import (
    EvaluationResponse,
    FullSimulationRequest,
    PreScreenPatientResult,
    PreScreenRequest,
    PreScreenResponse,
    ReasoningTraceResponse,
    SimulationResponse,
)

router = APIRouter()
logger = get_logger(__name__)


@router.post("/simulate/pre-screen", response_model=APIResponse[PreScreenResponse])
async def pre_screen(
    request: PreScreenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> APIResponse[PreScreenResponse]:
    started = perf_counter()
    protocol, criteria = await _get_protocol_with_criteria(db, request.protocol_id)

    patient_result = await db.execute(
        select(Patient)
        .options(
            selectinload(Patient.lab_results),
            selectinload(Patient.medications),
            selectinload(Patient.conditions),
        )
        .order_by(Patient.name.asc())
    )
    patients = patient_result.scalars().all()
    screener = PreScreener()
    results: list[PreScreenPatientResult] = []

    for patient in patients:
        latest_labs = _latest_labs(patient)
        outcome = screener.screen_patient(
            patient_data=_patient_data_dict(patient),
            latest_labs=latest_labs,
            medications=_medication_dicts(patient),
            conditions=_condition_dicts(patient),
            criteria=criteria,
        )
        patient.pre_screen_score = outcome.score
        patient.risk_level = RiskLevel[outcome.risk_level]
        results.append(
            PreScreenPatientResult(
                id=str(patient.id),
                name=patient.name,
                age=patient.age,
                sex=_enum_value(patient.sex) or "",
                primary_diagnosis=patient.primary_diagnosis,
                pre_screen_score=outcome.score,
                risk_level=outcome.risk_level,
                fail_reasons=outcome.fail_reasons,
            )
        )

    await db.commit()
    results.sort(key=lambda item: item.pre_screen_score if item.pre_screen_score is not None else -1.0, reverse=True)

    payload = PreScreenResponse(
        protocol_id=str(protocol.id),
        total_patients=len(results),
        results=results,
    )
    logger.info(
        "Pre-screen completed",
        event="simulation_pre_screen",
        protocol_id=protocol.id,
        user_id=current_user.id,
        patient_count=len(results),
        duration_ms=round((perf_counter() - started) * 1000, 2),
    )
    return APIResponse(data=payload, message="Pre-screen completed.")


@router.post("/simulate/full", response_model=APIResponse[SimulationResponse])
async def run_full_simulation(
    request: FullSimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> APIResponse[SimulationResponse]:
    started = perf_counter()
    protocol, criteria = await _get_protocol_with_criteria(db, request.protocol_id)
    patient = await _get_patient_with_data(db, request.patient_id)

    twin = DigitalTwin(
        patient_id=str(patient.id),
        lab_results=_lab_result_dicts(patient.lab_results),
        medications=_medication_dicts(patient),
        conditions=_condition_dicts(patient),
        patient_data=_patient_data_dict(patient),
    )
    simulation_output = SimulationRunner().run(twin=twin, criteria=criteria)
    simulation_output.protocol_id = str(protocol.id)

    simulation = Simulation(
        protocol_id=protocol.id,
        patient_id=patient.id,
        created_by_id=current_user.id,
        overall_risk=simulation_output.overall_risk,
        risk_score=simulation_output.risk_score,
        compatibility_score=simulation_output.compatibility_score,
    )
    db.add(simulation)
    await db.flush()

    for evaluation in simulation_output.evaluations:
        db.add(
            Evaluation(
                simulation_id=simulation.id,
                criterion_id=UUID(evaluation.criterion_id),
                week=evaluation.week,
                status=EvaluationStatus[evaluation.status],
                projected_value=evaluation.projected_value,
                threshold=evaluation.threshold,
                margin_percent=evaluation.margin_percent,
                confidence=evaluation.confidence,
            )
        )

    await db.commit()
    response_payload = await _load_simulation_response(db, simulation.id)
    logger.info(
        "Full simulation completed",
        event="simulation_full",
        simulation_id=simulation.id,
        protocol_id=protocol.id,
        patient_id=patient.id,
        user_id=current_user.id,
        evaluation_count=len(response_payload.evaluations),
        duration_ms=round((perf_counter() - started) * 1000, 2),
    )
    return APIResponse(data=response_payload, message="Simulation completed.")


@router.get("/simulations/{simulation_id}", response_model=APIResponse[SimulationResponse])
async def get_simulation(
    simulation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> APIResponse[SimulationResponse]:
    started = perf_counter()
    payload = await _load_simulation_response(db, simulation_id)
    logger.info(
        "Simulation retrieved",
        event="simulation_get",
        simulation_id=simulation_id,
        user_id=current_user.id,
        duration_ms=round((perf_counter() - started) * 1000, 2),
    )
    return APIResponse(data=payload, message="Simulation retrieved.")


async def _get_protocol_with_criteria(db: AsyncSession, protocol_id: str) -> tuple[Protocol, list[dict]]:
    protocol_uuid = UUID(protocol_id)
    result = await db.execute(
        select(Protocol)
        .options(selectinload(Protocol.criteria))
        .where(Protocol.id == protocol_uuid)
    )
    protocol = result.scalar_one_or_none()
    if protocol is None:
        raise NotFoundError("Protocol not found.")
    if protocol.status != ProtocolStatus.CONFIRMED:
        raise AppException(400, "Protocol must be confirmed before screening or simulation.", "INVALID_PROTOCOL_STATUS")

    criteria = [
        {
            "id": str(criterion.id),
            "category": _enum_value(criterion.category),
            "original_text": criterion.original_text,
            "parameter": criterion.parameter,
            "operator": _enum_value(criterion.operator),
            "threshold": criterion.threshold,
            "unit": criterion.unit,
            "time_window": criterion.time_window,
            "eval_schedule": criterion.eval_schedule or [0],
            "requires_review": criterion.requires_review,
            "confidence": criterion.confidence,
        }
        for criterion in sorted(protocol.criteria, key=lambda item: (item.created_at, item.parameter))
    ]
    return protocol, criteria


async def _get_patient_with_data(db: AsyncSession, patient_id: str) -> Patient:
    patient_uuid = UUID(patient_id)
    result = await db.execute(
        select(Patient)
        .options(
            selectinload(Patient.lab_results),
            selectinload(Patient.medications),
            selectinload(Patient.conditions),
        )
        .where(Patient.id == patient_uuid)
    )
    patient = result.scalar_one_or_none()
    if patient is None:
        raise NotFoundError("Patient not found.")
    return patient


async def _load_simulation_response(db: AsyncSession, simulation_id: UUID) -> SimulationResponse:
    result = await db.execute(
        select(Simulation)
        .options(
            selectinload(Simulation.evaluations).selectinload(Evaluation.criterion),
            selectinload(Simulation.evaluations).selectinload(Evaluation.reasoning_trace),
        )
        .where(Simulation.id == simulation_id)
    )
    simulation = result.scalar_one_or_none()
    if simulation is None:
        raise NotFoundError("Simulation not found.")

    evaluations = sorted(simulation.evaluations, key=lambda item: (item.week, str(item.criterion_id)))
    return SimulationResponse(
        id=str(simulation.id),
        protocol_id=str(simulation.protocol_id),
        patient_id=str(simulation.patient_id),
        overall_risk=simulation.overall_risk,
        risk_score=simulation.risk_score,
        compatibility_score=simulation.compatibility_score,
        evaluations=[_evaluation_response(item) for item in evaluations],
        created_at=simulation.created_at,
    )


def _evaluation_response(evaluation: Evaluation) -> EvaluationResponse:
    criterion = evaluation.criterion
    reasoning = evaluation.reasoning_trace
    reasoning_payload = (
        ReasoningTraceResponse(
            id=str(reasoning.id),
            explanation=reasoning.explanation,
            risk_factors=reasoning.risk_factors,
            suggestion=reasoning.suggestion,
            confidence_note=reasoning.confidence_note,
        )
        if isinstance(reasoning, ReasoningTrace)
        else None
    )
    return EvaluationResponse(
        id=str(evaluation.id),
        criterion_id=str(evaluation.criterion_id),
        criterion_text=criterion.original_text if criterion is not None else "",
        category=_enum_value(criterion.category) if criterion is not None else "",
        week=evaluation.week,
        status=_enum_value(evaluation.status) or "",
        projected_value=evaluation.projected_value,
        threshold=evaluation.threshold,
        margin_percent=evaluation.margin_percent,
        confidence=evaluation.confidence,
        parameter=criterion.parameter if criterion is not None else "",
        operator=_enum_value(criterion.operator) if criterion is not None else "",
        reasoning=reasoning_payload,
    )


def _patient_data_dict(patient: Patient) -> dict:
    return {
        "id": str(patient.id),
        "name": patient.name,
        "age": patient.age,
        "sex": _enum_value(patient.sex),
        "primary_diagnosis": patient.primary_diagnosis,
        "pre_screen_score": patient.pre_screen_score,
        "risk_level": _enum_value(patient.risk_level),
    }


def _latest_labs(patient: Patient) -> dict[str, float]:
    latest_by_parameter: dict[str, tuple[object, float]] = {}
    for lab in patient.lab_results:
        existing = latest_by_parameter.get(lab.parameter)
        if existing is None or lab.result_date > existing[0]:
            latest_by_parameter[lab.parameter] = (lab.result_date, lab.value)
    return {parameter: value for parameter, (_, value) in latest_by_parameter.items()}


def _lab_result_dicts(lab_results: list) -> list[dict]:
    return [
        {
            "parameter": lab.parameter,
            "value": lab.value,
            "unit": lab.unit,
            "result_date": lab.result_date,
            "reference_low": lab.reference_low,
            "reference_high": lab.reference_high,
        }
        for lab in sorted(lab_results, key=lambda item: (item.parameter.lower(), item.result_date))
    ]


def _medication_dicts(patient: Patient) -> list[dict]:
    return [
        {
            "name": med.name,
            "dose": med.dose,
            "frequency": med.frequency,
            "start_date": med.start_date,
            "end_date": med.end_date,
        }
        for med in patient.medications
    ]


def _condition_dicts(patient: Patient) -> list[dict]:
    return [
        {
            "name": condition.name,
            "icd_code": condition.icd_code,
            "onset_date": condition.onset_date,
        }
        for condition in patient.conditions
    ]


def _enum_value(value: object) -> str | None:
    if value is None:
        return None
    return str(getattr(value, "value", value))
