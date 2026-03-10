from __future__ import annotations

import logging
import os
import sys
from contextvars import ContextVar, Token
from datetime import datetime

from app.config.settings import get_settings

REQUEST_ID_CONTEXT: ContextVar[str | None] = ContextVar("request_id", default=None)

LEVEL_EMOJI = {
    "DEBUG": "",
    "INFO": "✅",
    "WARNING": "⚠️",
    "ERROR": "❌",
    "CRITICAL": "❌",
}

LEVEL_COLOR = {
    "DEBUG": "\033[36m",
    "INFO": "\033[32m",
    "WARNING": "\033[33m",
    "ERROR": "\033[31m",
    "CRITICAL": "\033[1;31m",
}

RESET = "\033[0m"

_configured = False


def _supports_color() -> bool:
    return sys.stderr.isatty() and os.getenv("NO_COLOR") is None


def bind_request_id(request_id: str) -> Token[str | None]:
    return REQUEST_ID_CONTEXT.set(request_id)


def clear_request_id(token: Token[str | None]) -> None:
    REQUEST_ID_CONTEXT.reset(token)


class StructuredFormatter(logging.Formatter):
    def __init__(self) -> None:
        super().__init__()
        self._use_color = _supports_color()

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        level_name = "WARN" if record.levelname == "WARNING" else record.levelname
        emoji = LEVEL_EMOJI.get(record.levelname, "")
        prefix = f"[{timestamp}] {emoji} {level_name:<5}".replace("  ", " ")
        message = record.getMessage()
        request_id = getattr(record, "request_id", None)

        if getattr(record, "request_log", False):
            module_name = record.name.split(".")[-1]
            status_code = getattr(record, "status_code", "-")
            duration_ms = getattr(record, "duration_ms", "-")
            line = f"{prefix} | {module_name} | {message} | {status_code} | {duration_ms}ms"
            if request_id:
                line = f"{line} | request_id={request_id}"
            return self._colorize(record.levelname, line)

        event = getattr(record, "event", None) or record.funcName
        module_name = record.name.split(".")[-1]
        extra_data = getattr(record, "extra_data", None) or {}
        extras = self._format_extras(extra_data, request_id)
        line = f"{prefix} | {module_name}:{event} | {message}"
        if extras:
            line = f"{line} | {extras}"
        return self._colorize(record.levelname, line)

    def _format_extras(self, extra_data: dict[str, object], request_id: str | None) -> str:
        items = [f"{key}={self._format_value(value)}" for key, value in extra_data.items()]
        if request_id:
            items.append(f"request_id={request_id}")
        return " ".join(items)

    def _format_value(self, value: object) -> str:
        if isinstance(value, str) and (" " in value or '"' in value):
            escaped = value.replace('"', '\\"')
            return f'"{escaped}"'
        return str(value)

    def _colorize(self, level: str, line: str) -> str:
        if not self._use_color:
            return line
        color = LEVEL_COLOR.get(level, "")
        return f"{color}{line}{RESET}"


class AppLogger:
    def __init__(self, logger: logging.Logger) -> None:
        self._logger = logger

    def debug(self, message: str, *, event: str | None = None, **extra_data: object) -> None:
        self._log(logging.DEBUG, message, event=event, extra_data=extra_data)

    def info(self, message: str, *, event: str | None = None, **extra_data: object) -> None:
        self._log(logging.INFO, message, event=event, extra_data=extra_data)

    def warning(self, message: str, *, event: str | None = None, **extra_data: object) -> None:
        self._log(logging.WARNING, message, event=event, extra_data=extra_data)

    def error(self, message: str, *, event: str | None = None, **extra_data: object) -> None:
        self._log(logging.ERROR, message, event=event, extra_data=extra_data)

    def exception(self, message: str, *, event: str | None = None, **extra_data: object) -> None:
        self._log(logging.ERROR, message, event=event, extra_data=extra_data, exc_info=True)

    def request(self, method: str, path: str, status_code: int, duration_ms: float) -> None:
        self._logger.info(
            f"{method} {path}",
            extra={
                "request_log": True,
                "status_code": status_code,
                "duration_ms": round(duration_ms, 2),
                "request_id": REQUEST_ID_CONTEXT.get(),
            },
            stacklevel=2,
        )

    def _log(
        self,
        level: int,
        message: str,
        *,
        event: str | None,
        extra_data: dict[str, object],
        exc_info: bool = False,
    ) -> None:
        self._logger.log(
            level,
            message,
            extra={
                "event": event,
                "extra_data": extra_data,
                "request_id": REQUEST_ID_CONTEXT.get(),
            },
            exc_info=exc_info,
            stacklevel=3,
        )


def configure_logging() -> None:
    global _configured
    if _configured:
        return

    settings = get_settings()
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(StructuredFormatter())

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    _configured = True


def get_logger(name: str) -> AppLogger:
    configure_logging()
    return AppLogger(logging.getLogger(name))
