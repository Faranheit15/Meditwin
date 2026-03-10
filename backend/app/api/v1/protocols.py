from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.core.exceptions import AppException
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.protocol import CriterionRead, CriterionUpdate

router = APIRouter()


@router.post("/upload", response_model=APIResponse[None])
async def upload_protocol(_current_user: User = Depends(get_current_user)) -> APIResponse[None]:
    raise AppException(501, "Protocol upload is not implemented yet.", "NOT_IMPLEMENTED")


@router.get("/{protocol_id}/criteria", response_model=APIResponse[list[CriterionRead]])
async def get_protocol_criteria(
    protocol_id: UUID,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[list[CriterionRead]]:
    raise AppException(501, f"Criteria retrieval for protocol {protocol_id} is not implemented yet.", "NOT_IMPLEMENTED")


@router.patch("/criteria/{criterion_id}", response_model=APIResponse[None])
async def update_criterion(
    criterion_id: UUID,
    _payload: CriterionUpdate,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[None]:
    raise AppException(501, f"Criterion update for {criterion_id} is not implemented yet.", "NOT_IMPLEMENTED")
