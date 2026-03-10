from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.core.exceptions import AppException
from app.models.user import User
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.patient import PatientRead

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[PatientRead])
async def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    _current_user: User = Depends(get_current_user),
) -> PaginatedResponse[PatientRead]:
    raise AppException(501, f"Patient list is not implemented yet for page {page}.", "NOT_IMPLEMENTED")


@router.get("/{patient_id}", response_model=APIResponse[PatientRead])
async def get_patient(
    patient_id: UUID,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[PatientRead]:
    raise AppException(501, f"Patient retrieval for {patient_id} is not implemented yet.", "NOT_IMPLEMENTED")


@router.post("/{patient_id}/documents", response_model=APIResponse[None])
async def upload_patient_document(
    patient_id: UUID,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[None]:
    raise AppException(501, f"Document upload for patient {patient_id} is not implemented yet.", "NOT_IMPLEMENTED")


@router.post("/{patient_id}/confirm-enrichment", response_model=APIResponse[None])
async def confirm_patient_enrichment(
    patient_id: UUID,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[None]:
    raise AppException(501, f"Patient enrichment confirmation for {patient_id} is not implemented yet.", "NOT_IMPLEMENTED")
