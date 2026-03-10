from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import api_router
from app.config.settings import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import register_middleware
from app.services.database import AsyncDatabaseService
from app.services.seeder import DatabaseSeeder

configure_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db_service = AsyncDatabaseService.get_instance()
    logger.info("Application starting", event="startup", env=settings.ENVIRONMENT)
    await db_service.connect()
    await DatabaseSeeder(db_service).run()
    logger.info("Application ready", event="startup_complete", version=settings.APP_VERSION)

    try:
        yield
    finally:
        await db_service.disconnect()
        logger.info("Application stopped", event="shutdown")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

register_exception_handlers(app)
register_middleware(app)
app.include_router(api_router, prefix="/api")
