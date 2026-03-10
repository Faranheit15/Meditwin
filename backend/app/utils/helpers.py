from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_camel_case(value: str) -> str:
    if "_" not in value:
        return value

    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)
