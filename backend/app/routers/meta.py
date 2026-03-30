from fastapi import APIRouter

from app.capabilities import build_meta_payload
from app.config import get_settings

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("")
async def get_meta():
    settings = get_settings()
    return build_meta_payload(settings)
