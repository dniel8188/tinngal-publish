"""Public site settings — the guest landing page reads its hero copy from here."""

from fastapi import APIRouter

from lib.db import db
from models.settings import SiteSettings

router = APIRouter(tags=["settings"])

SETTINGS_KEY = "site"


async def load_settings() -> SiteSettings:
    doc = await db.settings.find_one({"key": SETTINGS_KEY})
    if not doc:
        return SiteSettings()
    doc.pop("_id", None)
    doc.pop("key", None)
    return SiteSettings(**doc)


@router.get("/settings", response_model=SiteSettings)
async def get_settings():
    return await load_settings()
