from __future__ import annotations

from fastapi import APIRouter

from app.config.settings import get_settings
from app.schemas.common import APIResponse, CamelModel
from app.services.database import AsyncDatabaseService

router = APIRouter()


class HealthStatus(CamelModel):
    app_name: str
    version: str
    environment: str
    database_connected: bool


@router.get("/health", response_model=APIResponse[HealthStatus])
async def health_check() -> APIResponse[HealthStatus]:
    settings = get_settings()
    db_service = AsyncDatabaseService.get_instance()
    return APIResponse(
        data=HealthStatus(
            app_name=settings.APP_NAME,
            version=settings.APP_VERSION,
            environment=settings.ENVIRONMENT,
            database_connected=db_service.is_connected,
        ),
        message="Service is healthy.",
    )
