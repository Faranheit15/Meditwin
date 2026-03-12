from __future__ import annotations

import asyncio
import time

from groq import APIError, Groq, RateLimitError

from app.config.settings import get_settings
from app.core.exceptions import ExternalServiceError
from app.core.logging import get_logger

logger = get_logger(__name__)


class GroqLLMService:
    """Singleton service for Groq API calls."""

    _instance: GroqLLMService | None = None

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.GROQ_API_KEY:
            raise ExternalServiceError("GROQ_API_KEY is not configured.")

        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.model = "llama-3.3-70b-versatile"

    @classmethod
    def get_instance(cls) -> GroqLLMService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def chat(self, system_prompt: str, user_prompt: str, temperature: float = 0.1) -> str:
        """Send a chat completion request with retries and timing logs."""
        for attempt in range(1, 4):
            started_at = time.perf_counter()
            try:
                response = await asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=self.model,
                    temperature=temperature,
                    max_tokens=4096,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                )
                duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
                logger.info(
                    "Groq chat completion succeeded",
                    event="groq_chat",
                    attempt=attempt,
                    duration_ms=duration_ms,
                    model=self.model,
                )
                content = response.choices[0].message.content if response.choices else None
                if not content:
                    raise ExternalServiceError("Groq returned an empty response.")
                return content
            except RateLimitError as exc:
                duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
                logger.warning(
                    "Groq rate limit encountered",
                    event="groq_rate_limit",
                    attempt=attempt,
                    duration_ms=duration_ms,
                )
                if attempt == 3:
                    raise ExternalServiceError("Groq rate limit exceeded. Please retry shortly.") from exc
            except APIError as exc:
                duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
                logger.warning(
                    "Groq API request failed",
                    event="groq_error",
                    attempt=attempt,
                    duration_ms=duration_ms,
                    error=str(exc),
                )
                if attempt == 3:
                    raise ExternalServiceError("Groq request failed after retries.") from exc

            await asyncio.sleep(2 ** (attempt - 1))

        raise ExternalServiceError("Groq request failed after retries.")
