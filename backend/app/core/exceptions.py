from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppException(Exception):
    def __init__(
        self,
        status_code: int = 500,
        message: str = "An unexpected error occurred.",
        error_code: str = "INTERNAL_ERROR",
    ) -> None:
        self.status_code = status_code
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication failed.") -> None:
        super().__init__(401, message, "AUTH_INVALID_TOKEN")


class AuthorizationError(AppException):
    def __init__(self, message: str = "Insufficient permissions.") -> None:
        super().__init__(403, message, "FORBIDDEN")


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found.") -> None:
        super().__init__(404, message, "NOT_FOUND")


class ValidationError(AppException):
    def __init__(self, message: str = "Validation error.") -> None:
        super().__init__(422, message, "VALIDATION_ERROR")


class ExternalServiceError(AppException):
    def __init__(self, message: str = "External service error.") -> None:
        super().__init__(502, message, "EXTERNAL_SERVICE_ERROR")


def _error_response(status_code: int, error_code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": error_code, "message": message}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
        logger.warning(
            "Handled application exception",
            event="handled",
            code=exc.error_code,
            detail=exc.message,
        )
        return _error_response(exc.status_code, exc.error_code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def request_validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        message = exc.errors()[0]["msg"] if exc.errors() else "Validation error."
        logger.warning("Request validation failed", event="validation", errors=len(exc.errors()))
        return _error_response(422, "VALIDATION_ERROR", message)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", event="unhandled", error=str(exc))
        return _error_response(500, "INTERNAL_ERROR", "An unexpected error occurred.")
