from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.core.exceptions import AppException
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.simulation import FullSimulationRequest, PreScreenRequest, SimulationRead

router = APIRouter()


@router.post("/pre-screen", response_model=APIResponse[None])
async def pre_screen_patient(
    _payload: PreScreenRequest,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[None]:
    raise AppException(501, "Pre-screen simulation is not implemented yet.", "NOT_IMPLEMENTED")


@router.post("/full", response_model=APIResponse[None])
async def run_full_simulation(
    _payload: FullSimulationRequest,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[None]:
    raise AppException(501, "Full simulation is not implemented yet.", "NOT_IMPLEMENTED")


@router.get("/{simulation_id}", response_model=APIResponse[SimulationRead])
async def get_simulation_result(
    simulation_id: UUID,
    _current_user: User = Depends(get_current_user),
) -> APIResponse[SimulationRead]:
    raise AppException(501, f"Simulation retrieval for {simulation_id} is not implemented yet.", "NOT_IMPLEMENTED")
