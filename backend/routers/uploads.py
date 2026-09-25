"""Public image serving for admin-uploaded pictures."""

from fastapi import APIRouter

from lib.uploads import fetch_upload

router = APIRouter(tags=["uploads"])


@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: str):
    return await fetch_upload(upload_id)
