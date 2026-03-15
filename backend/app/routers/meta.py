from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("")
async def get_meta():
    settings = get_settings()
    return {
        "app_name": settings.app_name,
        "demo_mode": settings.demo_mode,
    }
