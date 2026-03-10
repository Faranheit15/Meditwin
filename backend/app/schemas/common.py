from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

from app.utils.helpers import to_camel_case

T = TypeVar("T")


class CamelModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel_case,
    )


class ErrorDetail(CamelModel):
    code: str
    message: str


class APIErrorResponse(CamelModel):
    success: bool = False
    error: ErrorDetail


class APIResponse(CamelModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None


class PaginatedResponse(APIResponse[list[T]], Generic[T]):
    total: int
    page: int
    page_size: int


class PaginationParams(CamelModel):
    page: int = 1
    page_size: int = 10
