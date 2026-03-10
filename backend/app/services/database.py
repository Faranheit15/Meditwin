from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config.settings import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class AsyncDatabaseService:
    _instance: AsyncDatabaseService | None = None

    def __init__(self) -> None:
        self._engine: AsyncEngine | None = None
        self._session_factory: async_sessionmaker[AsyncSession] | None = None

    @classmethod
    def get_instance(cls) -> AsyncDatabaseService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def engine(self) -> AsyncEngine | None:
        return self._engine

    @property
    def is_connected(self) -> bool:
        return self._engine is not None and self._session_factory is not None

    async def connect(self) -> None:
        if self.is_connected:
            return

        settings = get_settings()
        self._engine = create_async_engine(
            settings.resolved_database_url,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            connect_args={"statement_cache_size": 0},
        )
        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        async with self._engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

        logger.info("Database connected", event="connect", pool_size=5, max_overflow=10)

    async def disconnect(self) -> None:
        if self._engine is None:
            return

        await self._engine.dispose()
        self._engine = None
        self._session_factory = None
        logger.info("Database disconnected", event="disconnect")

    @asynccontextmanager
    async def get_session(self) -> AsyncIterator[AsyncSession]:
        if self._session_factory is None:
            raise RuntimeError("Database is not connected.")

        async with self._session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
