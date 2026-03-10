from __future__ import annotations

from functools import lru_cache
from typing import Annotated
from typing import Literal
from urllib.parse import quote_plus

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "MediTwin"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    ENVIRONMENT: Literal["dev", "staging", "prod"] = "dev"

    DATABASE_URL: str | None = None

    # Legacy fallback so the existing local .env keeps working.
    DB_USER: str | None = None
    DB_PASSWORD: str | None = None
    DB_HOST: str | None = None
    DB_PORT: int = 5432
    DB_NAME: str | None = None

    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_SECRET_KEY: str = ""
    CLERK_JWKS_URL: str = ""

    GROQ_API_KEY: str = ""

    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str] | None) -> list[str]:
        if value is None:
            return ["http://localhost:3000"]
        if isinstance(value, list):
            return value

        cleaned = value.strip()
        if not cleaned:
            return ["http://localhost:3000"]
        if cleaned.startswith("[") and cleaned.endswith("]"):
            return [
                item.strip().strip("'\"")
                for item in cleaned[1:-1].split(",")
                if item.strip()
            ] or ["http://localhost:3000"]
        return [item.strip() for item in cleaned.split(",") if item.strip()]

    @property
    def resolved_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL

        required_parts = [self.DB_USER, self.DB_PASSWORD, self.DB_HOST, self.DB_NAME]
        if not all(required_parts):
            raise ValueError("DATABASE_URL is not configured and legacy DB_* values are incomplete.")

        password = quote_plus(self.DB_PASSWORD or "")
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{password}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
