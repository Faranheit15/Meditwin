from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.core.exceptions import AppException
from app.models.user import User
from app.schemas.common import APIResponse, CamelModel
from app.schemas.user import UserRead

router = APIRouter()


class ClerkWebhookPayload(CamelModel):
    event_type: str | None = None


@router.get("/me", response_model=APIResponse[UserRead])
async def get_me(current_user: User = Depends(get_current_user)) -> APIResponse[UserRead]:
    return APIResponse(data=UserRead.model_validate(current_user), message="User synced.")


@router.post("/webhook", response_model=APIResponse[None])
async def clerk_webhook(_payload: ClerkWebhookPayload) -> APIResponse[None]:
    raise AppException(501, "Clerk webhook handling is not implemented yet.", "NOT_IMPLEMENTED")
