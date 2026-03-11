from __future__ import annotations

import asyncio
import json
import time

import httpx
import jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.core.exceptions import AuthenticationError
from app.core.logging import get_logger
from app.models.user import User
from app.utils.helpers import utcnow

logger = get_logger(__name__)


class ClerkUserPayload(BaseModel):
    sub: str
    email: str
    first_name: str | None = None
    last_name: str | None = None


class ClerkAuthService:
    _instance: ClerkAuthService | None = None

    def __init__(self) -> None:
        self._jwks: dict[str, dict[str, object]] = {}
        self._jwks_fetched_at: float = 0
        self._jwks_ttl = 3600
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> ClerkAuthService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def _refresh_jwks(self, *, force: bool = False) -> dict[str, dict[str, object]]:
        settings = get_settings()
        if not settings.CLERK_JWKS_URL:
            raise AuthenticationError("CLERK_JWKS_URL is not configured.")

        async with self._lock:
            is_fresh = (time.time() - self._jwks_fetched_at) < self._jwks_ttl
            if self._jwks and is_fresh and not force:
                return self._jwks

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(settings.CLERK_JWKS_URL)
                    response.raise_for_status()
            except httpx.HTTPError as exc:
                raise AuthenticationError("Failed to fetch Clerk JWKS.") from exc

            keys = {
                key["kid"]: key
                for key in response.json().get("keys", [])
                if isinstance(key, dict) and key.get("kid")
            }
            if not keys:
                raise AuthenticationError("No valid Clerk JWKS keys were returned.")

            self._jwks = keys
            self._jwks_fetched_at = time.time()
            logger.info("JWKS cache refreshed", event="jwks_refresh", key_count=len(keys))
            return self._jwks

    async def verify_token(self, token: str) -> ClerkUserPayload:
        if not token:
            raise AuthenticationError("Missing bearer token.")

        try:
            header = jwt.get_unverified_header(token)
        except jwt.InvalidTokenError as exc:
            raise AuthenticationError("Malformed token header.") from exc

        kid = header.get("kid")
        if not kid:
            raise AuthenticationError("Token header is missing kid.")

        keys = await self._refresh_jwks()
        if kid not in keys:
            keys = await self._refresh_jwks(force=True)
        jwk = keys.get(kid)
        if jwk is None:
            raise AuthenticationError("Unable to find matching Clerk signing key.")

        try:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
            payload = jwt.decode(
                token,
                key=public_key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationError("Token has expired.") from exc
        except jwt.InvalidSignatureError as exc:
            raise AuthenticationError("Token signature is invalid.") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationError("Token validation failed.") from exc

        subject = payload.get("sub")
        if not subject:
            raise AuthenticationError("Token is missing subject claim.")

        fallback_profile = await self._fetch_user_profile(subject)
        clerk_payload = ClerkUserPayload(
            sub=subject,
            email=self._extract_email(payload, subject, fallback_profile),
            first_name=self._extract_optional_string(payload, "first_name")
            or fallback_profile.first_name,
            last_name=self._extract_optional_string(payload, "last_name")
            or fallback_profile.last_name,
        )
        logger.info("User authenticated", event="verify", user_id=clerk_payload.sub)
        return clerk_payload

    async def get_or_create_user(self, session: AsyncSession, clerk_payload: ClerkUserPayload) -> User:
        result = await session.execute(select(User).where(User.clerk_id == clerk_payload.sub))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                clerk_id=clerk_payload.sub,
                email=clerk_payload.email,
                first_name=clerk_payload.first_name,
                last_name=clerk_payload.last_name,
            )
            session.add(user)
            logger.info("Created new local user", event="create_user", user_id=clerk_payload.sub)
        else:
            user.email = clerk_payload.email
            user.first_name = clerk_payload.first_name
            user.last_name = clerk_payload.last_name

        user.last_login_at = utcnow()
        await session.flush()
        return user

    async def _fetch_user_profile(self, subject: str) -> ClerkUserPayload:
        settings = get_settings()
        if not settings.CLERK_SECRET_KEY:
            return ClerkUserPayload(sub=subject, email=f"{subject}@clerk.local")

        try:
            async with httpx.AsyncClient(
                base_url="https://api.clerk.com/v1",
                headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
                timeout=10.0,
            ) as client:
                response = await client.get(f"/users/{subject}")
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning(
                "Failed to fetch Clerk user profile",
                event="clerk_user_fetch_failed",
                user_id=subject,
                error=str(exc),
            )
            return ClerkUserPayload(sub=subject, email=f"{subject}@clerk.local")

        data = response.json()
        return ClerkUserPayload(
            sub=subject,
            email=self._extract_email(data, subject),
            first_name=self._extract_optional_string(data, "first_name"),
            last_name=self._extract_optional_string(data, "last_name"),
        )

    def _extract_email(
        self,
        payload: dict[str, object],
        subject: str,
        fallback_profile: ClerkUserPayload | None = None,
    ) -> str:
        raw_email = payload.get("email")
        if isinstance(raw_email, str) and raw_email:
            return raw_email

        email_address = payload.get("email_address")
        if isinstance(email_address, str) and email_address:
            return email_address

        email_addresses = payload.get("email_addresses")
        if isinstance(email_addresses, list):
            for item in email_addresses:
                if isinstance(item, dict):
                    nested = item.get("email_address")
                    if isinstance(nested, str) and nested:
                        return nested

        if fallback_profile and fallback_profile.email:
            return fallback_profile.email

        return f"{subject}@clerk.local"

    def _extract_optional_string(self, payload: dict[str, object], key: str) -> str | None:
        value = payload.get(key)
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return None
