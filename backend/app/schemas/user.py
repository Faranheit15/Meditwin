from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.schemas.common import CamelModel


class UserRead(CamelModel):
    id: UUID
    clerk_id: str
    email: str
    first_name: str | None
    last_name: str | None
    role: str
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime
