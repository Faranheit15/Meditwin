from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import AppException, NotFoundError
from app.core.logging import get_logger
from app.models.protocol import Criterion, CriterionCategory, CriterionOperator, Protocol, ProtocolStatus
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.protocol import CriterionResponse, ProtocolResponse, ProtocolWithCriteriaResponse
from app.services.extractor import CriteriaExtractorService
from app.services.llm import GroqLLMService
from app.services.pdf_parser import PDFParserService

router = APIRouter()
logger = get_logger(__name__)

OPERATOR_MAP = {
    "GTE": CriterionOperator.GTE,
    "LTE": CriterionOperator.LTE,
    "EQ": CriterionOperator.EQ,
    "NEQ": CriterionOperator.NEQ,
    "BOOLEAN": CriterionOperator.BOOLEAN,
    "NOT_WITHIN": CriterionOperator.NOT_WITHIN,
    "STABLE": CriterionOperator.STABLE,
}


@router.post("/upload", response_model=APIResponse[ProtocolResponse])
async def upload_protocol(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> APIResponse[ProtocolResponse]:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise AppException(400, "Only PDF files are accepted", "INVALID_FILE_TYPE")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise AppException(400, "Uploaded PDF is empty", "INVALID_FILE")

    protocol = Protocol(
        name=file.filename[:-4],
        version="1.0",
        status=ProtocolStatus.PROCESSING,
        file_name=file.filename,
        criteria_count=0,
        uploaded_by_id=current_user.id,
    )
    db.add(protocol)
    await db.commit()
    await db.refresh(protocol)

    try:
        extractor = CriteriaExtractorService(
            llm_service=GroqLLMService.get_instance(),
            pdf_parser=PDFParserService(),
        )
        criteria_list = await extractor.extract_from_pdf(pdf_bytes, str(protocol.id))
        for criterion_data in criteria_list:
            db.add(
                Criterion(
                    protocol_id=protocol.id,
                    category=CriterionCategory(criterion_data.category),
                    original_text=criterion_data.original_text,
                    parameter=criterion_data.parameter,
                    operator=OPERATOR_MAP[criterion_data.operator],
                    threshold=criterion_data.threshold,
                    unit=criterion_data.unit,
                    time_window=criterion_data.time_window,
                    eval_schedule=criterion_data.eval_schedule,
                    requires_review=criterion_data.requires_review,
                    confidence=criterion_data.confidence,
                )
            )

        protocol.status = ProtocolStatus.EXTRACTED
        protocol.criteria_count = len(criteria_list)
        await db.commit()
        await db.refresh(protocol)
        logger.info(
            "Protocol uploaded and extracted",
            event="protocol_upload",
            protocol_id=protocol.id,
            criteria_count=len(criteria_list),
        )
    except Exception as exc:
        protocol.status = ProtocolStatus.FAILED
        await db.commit()
        logger.exception("Criteria extraction failed", event="protocol_extract_failed", protocol_id=protocol.id)
        raise AppException(500, f"Criteria extraction failed: {exc}", "EXTRACTION_FAILED") from exc

    return APIResponse(
        data=ProtocolResponse.model_validate(protocol),
        message="Protocol uploaded and criteria extracted.",
    )


@router.get("", response_model=APIResponse[list[ProtocolResponse]])
async def list_protocols(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> APIResponse[list[ProtocolResponse]]:
    result = await db.execute(select(Protocol).order_by(Protocol.created_at.desc()))
    protocols = result.scalars().all()
    return APIResponse(
        data=[ProtocolResponse.model_validate(protocol) for protocol in protocols],
        message="Protocols retrieved.",
    )


@router.get("/{protocol_id}", response_model=APIResponse[ProtocolWithCriteriaResponse])
async def get_protocol(
    protocol_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> APIResponse[ProtocolWithCriteriaResponse]:
    result = await db.execute(
        select(Protocol)
        .options(selectinload(Protocol.criteria))
        .where(Protocol.id == protocol_id)
    )
    protocol = result.scalar_one_or_none()
    if protocol is None:
        raise NotFoundError("Protocol not found.")

    ordered_criteria = _sort_criteria(protocol.criteria)
    payload = ProtocolWithCriteriaResponse.model_validate(
        {
            **ProtocolResponse.model_validate(protocol).model_dump(),
            "criteria": [CriterionResponse.model_validate(item) for item in ordered_criteria],
        }
    )
    return APIResponse(data=payload, message="Protocol retrieved.")


@router.get("/{protocol_id}/criteria", response_model=APIResponse[list[CriterionResponse]])
async def get_criteria(
    protocol_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> APIResponse[list[CriterionResponse]]:
    await _get_protocol_or_404(db, protocol_id)
    result = await db.execute(
        select(Criterion)
        .where(Criterion.protocol_id == protocol_id)
        .order_by(
            case((Criterion.category == CriterionCategory.INCLUSION, 0), else_=1),
            Criterion.confidence.desc(),
            Criterion.created_at.asc(),
        )
    )
    criteria = result.scalars().all()
    return APIResponse(
        data=[CriterionResponse.model_validate(item) for item in criteria],
        message="Criteria retrieved.",
    )


@router.post("/{protocol_id}/confirm", response_model=APIResponse[ProtocolResponse])
async def confirm_protocol(
    protocol_id: UUID,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> APIResponse[ProtocolResponse]:
    protocol = await _get_protocol_or_404(db, protocol_id)
    if protocol.status != ProtocolStatus.EXTRACTED:
        raise AppException(400, "Only extracted protocols can be confirmed.", "INVALID_PROTOCOL_STATUS")

    protocol.status = ProtocolStatus.CONFIRMED
    await db.commit()
    await db.refresh(protocol)
    logger.info("Protocol confirmed", event="protocol_confirmed", protocol_id=protocol.id)
    return APIResponse(data=ProtocolResponse.model_validate(protocol), message="Protocol confirmed.")


async def _get_protocol_or_404(db: AsyncSession, protocol_id: UUID) -> Protocol:
    result = await db.execute(select(Protocol).where(Protocol.id == protocol_id))
    protocol = result.scalar_one_or_none()
    if protocol is None:
        raise NotFoundError("Protocol not found.")
    return protocol


def _sort_criteria(criteria: list[Criterion]) -> list[Criterion]:
    return sorted(
        criteria,
        key=lambda item: (
            0 if item.category == CriterionCategory.INCLUSION else 1,
            -item.confidence,
            item.created_at,
        ),
    )
