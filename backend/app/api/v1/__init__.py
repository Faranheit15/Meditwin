from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.patients import router as patients_router
from app.api.v1.protocols import router as protocols_router
from app.api.v1.simulation import router as simulation_router

router = APIRouter()
router.include_router(health_router, tags=["health"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(protocols_router, prefix="/protocols", tags=["protocols"])
router.include_router(patients_router, prefix="/patients", tags=["patients"])
router.include_router(simulation_router, prefix="/simulation", tags=["simulation"])

__all__ = ["router"]
