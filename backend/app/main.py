from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import api_router
from app.config.settings import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.middleware import register_middleware
from app.services.database import AsyncDatabaseService
from app.services.keepalive import DatabaseKeepAliveService
from app.services.seeder import DatabaseSeeder

configure_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db_service = AsyncDatabaseService.get_instance()
    keepalive_task: asyncio.Task[None] | None = None

    logger.info("Application starting", event="startup", env=settings.ENVIRONMENT)
    await db_service.connect()
    await DatabaseSeeder(db_service).run()
    if settings.ENABLE_DB_KEEPALIVE:
        keepalive_task = asyncio.create_task(
            DatabaseKeepAliveService(
                db_service=db_service,
                interval_seconds=settings.DB_KEEPALIVE_INTERVAL_SECONDS,
            ).run_forever()
        )
    logger.info("Application ready", event="startup_complete", version=settings.APP_VERSION)

    try:
        yield
    finally:
        if keepalive_task is not None:
            keepalive_task.cancel()
            try:
                await keepalive_task
            except asyncio.CancelledError:
                pass
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
