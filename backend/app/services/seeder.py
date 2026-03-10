from __future__ import annotations

from sqlalchemy import select

from app.core.logging import get_logger
from app.models import Base, User
from app.services.database import AsyncDatabaseService

logger = get_logger(__name__)


class DatabaseSeeder:
    def __init__(self, db_service: AsyncDatabaseService) -> None:
        self._db = db_service

    async def seed_tables(self) -> None:
        if self._db.engine is None:
            raise RuntimeError("Database not connected.")

        async with self._db.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created or verified", event="seed_tables")

    async def seed_data(self) -> None:
        async with self._db.get_session() as session:
            existing_user = await session.scalar(select(User.id).limit(1))
            if existing_user:
                logger.info("Seed data already present", event="seed_data")
                return

            logger.info("Seed data placeholder completed with no inserts", event="seed_data")

    async def run(self) -> None:
        await self.seed_tables()
        await self.seed_data()
