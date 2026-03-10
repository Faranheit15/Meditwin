from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError
from app.models.user import User
from app.services.auth import ClerkAuthService
from app.services.database import AsyncDatabaseService

bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    db_service = AsyncDatabaseService.get_instance()
    async with db_service.get_session() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise AuthenticationError("Missing authorization header.")
    if credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Invalid authentication scheme.")

    auth_service = ClerkAuthService.get_instance()
    payload = await auth_service.verify_token(credentials.credentials)
    return await auth_service.get_or_create_user(session, payload)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db),
) -> User | None:
    if not credentials:
        return None

    try:
        auth_service = ClerkAuthService.get_instance()
        payload = await auth_service.verify_token(credentials.credentials)
        return await auth_service.get_or_create_user(session, payload)
    except AuthenticationError:
        return None
