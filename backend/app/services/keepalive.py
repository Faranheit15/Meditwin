from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.logging import get_logger
from app.services.database import AsyncDatabaseService

logger = get_logger(__name__)


CREATE_KEEPALIVE_TABLE_SQL = text(
    """
    CREATE TABLE IF NOT EXISTS keepalive_pings (
        id INTEGER PRIMARY KEY,
        pinged_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """
)

UPSERT_KEEPALIVE_SQL = text(
    """
    INSERT INTO keepalive_pings (id, pinged_at)
    VALUES (1, now())
    ON CONFLICT (id) DO UPDATE
    SET pinged_at = EXCLUDED.pinged_at
    """
)


class DatabaseKeepAliveService:
    def __init__(self, db_service: AsyncDatabaseService, interval_seconds: int) -> None:
        self._db_service = db_service
        self._interval_seconds = interval_seconds
        self._retry_seconds = min(3_600, interval_seconds)

    async def run_forever(self) -> None:
        logger.info(
            "Database keepalive task started",
            event="db_keepalive_start",
            interval_seconds=self._interval_seconds,
        )

        try:
            while True:
                succeeded = await self.ping()
                await asyncio.sleep(self._interval_seconds if succeeded else self._retry_seconds)
        except asyncio.CancelledError:
            logger.info("Database keepalive task stopped", event="db_keepalive_stop")
            raise

    async def ping(self) -> bool:
        try:
            async with self._db_service.get_session() as session:
                await session.execute(CREATE_KEEPALIVE_TABLE_SQL)
                await session.execute(UPSERT_KEEPALIVE_SQL)

            logger.info("Database keepalive ping complete", event="db_keepalive_ping")
            return True
        except Exception:
            logger.exception("Database keepalive ping failed", event="db_keepalive_failed")
            return False
