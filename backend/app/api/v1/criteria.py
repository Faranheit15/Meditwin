from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models.protocol import Criterion, CriterionOperator
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.protocol import CriterionResponse, CriterionUpdate

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


@router.patch("/{criterion_id}", response_model=APIResponse[CriterionResponse])
async def update_criterion(
    criterion_id: UUID,
    update_data: CriterionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> APIResponse[CriterionResponse]:
    result = await db.execute(select(Criterion).where(Criterion.id == criterion_id))
    criterion = result.scalar_one_or_none()
    if criterion is None:
        raise NotFoundError("Criterion not found.")

    payload = update_data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if field == "operator" and value is not None:
            setattr(criterion, field, OPERATOR_MAP[value])
        else:
            setattr(criterion, field, value)

    await db.commit()
    await db.refresh(criterion)
    logger.info(
        "Criterion updated",
        event="criterion_updated",
        criterion_id=criterion.id,
        protocol_id=criterion.protocol_id,
        updated_by=current_user.id,
    )
    return APIResponse(data=CriterionResponse.model_validate(criterion), message="Criterion updated.")
