"""Admin endpoints — one shared PIN, httpOnly-cookie session, full client CRUD + Drive sync."""

import hashlib
import hmac
import logging
import os

from fastapi import APIRouter, Cookie, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field

from lib.db import db
from lib.drive import DriveError, parse_folder_id
from lib.sync import sync_client_photos
from lib.uploads import store_upload
from models.clients import (
    AdminClient,
    Client,
    ClientCreate,
    ClientUpdate,
    Photo,
    PhotoOut,
    to_photo_out,
    utcnow,
)
from models.settings import SiteSettings
from routers.settings import SETTINGS_KEY, load_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

SESSION_COOKIE = "admin_session"
SESSION_MAX_AGE = 7 * 24 * 60 * 60


def _session_token() -> str:
    secret = os.environ.get("SESSION_SECRET", "dev-secret")
    return hmac.new(secret.encode(), b"admin-session-v1", hashlib.sha256).hexdigest()


def _is_admin(admin_session: str | None) -> bool:
    return bool(admin_session) and hmac.compare_digest(admin_session, _session_token())


def require_admin(admin_session: str | None = Cookie(default=None)) -> None:
    if not _is_admin(admin_session):
        raise HTTPException(status_code=401, detail="Sesi admin tidak valid — masuk kembali")


class LoginInput(BaseModel):
    pin: str = Field(min_length=1)


@router.post("/login")
async def admin_login(input: LoginInput, response: Response):
    expected = os.environ.get("ADMIN_PIN", "").strip()
    if not expected or input.pin.strip() != expected:
        raise HTTPException(status_code=401, detail="PIN salah")
    response.set_cookie(
        SESSION_COOKIE,
        _session_token(),
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        path="/",
    )
    return {"ok": True}


@router.post("/logout")
async def admin_logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
async def admin_me(admin_session: str | None = Cookie(default=None)):
    return {"authenticated": _is_admin(admin_session)}


async def _photo_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    async for doc in db.photos.aggregate([{"$group": {"_id": "$client_id", "n": {"$sum": 1}}}]):
        counts[doc["_id"]] = doc["n"]
    return counts


def _admin_out(client: Client, photo_count: int) -> AdminClient:
    return AdminClient(**client.model_dump(), photo_count=photo_count)


def _apply_folder(client: Client, raw: str | None) -> str:
    """Parse the pasted link onto the client; returns the raw string to persist."""
    raw = (raw or "").strip()
    folder_id = parse_folder_id(raw)
    if raw and not folder_id:
        raise HTTPException(status_code=400, detail="Link folder Google Drive tidak valid")
    client.drive_folder_id = folder_id
    client.drive_folder_url = raw or None
    return raw


@router.get("/clients", response_model=list[AdminClient], dependencies=[Depends(require_admin)])
async def admin_list_clients():
    counts = await _photo_counts()
    docs = await db.clients.find().sort([("sort_order", 1), ("name", 1)]).to_list(500)
    return [_admin_out(Client(**d), counts.get(d["id"], 0)) for d in docs]


@router.post("/clients", response_model=AdminClient, dependencies=[Depends(require_admin)])
async def admin_create_client(input: ClientCreate):
    client = Client(
        name=input.name.strip(),
        event_date=(input.event_date or "").strip() or None,
        venue=(input.venue or "").strip() or None,
        cover_url=(input.cover_url or "").strip() or None,
    )
    _apply_folder(client, input.drive_folder)
    last = await db.clients.find_one({}, sort=[("sort_order", -1)])
    client.sort_order = (int(last["sort_order"]) + 1) if last else 1
    await db.clients.insert_one(client.model_dump())
    if client.drive_folder_id:
        try:
            await sync_client_photos(client)
        except DriveError as exc:
            await db.clients.delete_one({"id": client.id})  # bad link — let the admin retry
            raise HTTPException(status_code=400, detail=str(exc))
    counts = await _photo_counts()
    return _admin_out(client, counts.get(client.id, 0))


@router.put("/clients/{client_id}", response_model=AdminClient, dependencies=[Depends(require_admin)])
async def admin_update_client(client_id: str, input: ClientUpdate):
    doc = await db.clients.find_one({"id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    client = Client(**doc)
    updates = input.model_dump(exclude_unset=True)
    folder_changed = False
    if "drive_folder" in updates:
        raw = _apply_folder(client, updates.pop("drive_folder"))
        folder_changed = raw != (client.drive_folder_url or "")
    if "name" in updates:
        name = (updates["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Nama klien wajib diisi")
        updates["name"] = name
    if "event_date" in updates:
        updates["event_date"] = (updates["event_date"] or "").strip() or None
    if "venue" in updates:
        updates["venue"] = (updates["venue"] or "").strip() or None
    if "cover_url" in updates:
        updates["cover_url"] = (updates["cover_url"] or "").strip() or None
    for key, value in updates.items():
        setattr(client, key, value)
    await db.clients.replace_one({"id": client_id}, client.model_dump())
    if folder_changed and client.drive_folder_id:
        try:
            await sync_client_photos(client)
        except DriveError as exc:  # keep the saved client; the sync button surfaces the error
            logger.warning("sync after update failed: %s", exc)
    counts = await _photo_counts()
    return _admin_out(client, counts.get(client.id, 0))


@router.delete("/clients/{client_id}", dependencies=[Depends(require_admin)])
async def admin_delete_client(client_id: str):
    await db.clients.delete_one({"id": client_id})
    await db.photos.delete_many({"client_id": client_id})
    return {"ok": True}


class ReorderInput(BaseModel):
    photo_ids: list[str] = Field(min_length=1)


class CoverInput(BaseModel):
    photo_id: str | None = None  # null clears the pick and falls back to the first photo


@router.put(
    "/clients/{client_id}/photos/order",
    response_model=list[PhotoOut],
    dependencies=[Depends(require_admin)],
)
async def admin_reorder_photos(client_id: str, input: ReorderInput):
    """Persist the admin's chosen photo order; Drive sync stops re-sorting afterwards."""
    doc = await db.clients.find_one({"id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    owned = {
        d["id"] async for d in db.photos.find({"client_id": client_id}, {"id": 1})
    }
    unknown = [pid for pid in input.photo_ids if pid not in owned]
    if unknown:
        raise HTTPException(status_code=400, detail="Ada foto yang bukan milik klien ini")
    for position, photo_id in enumerate(input.photo_ids):
        await db.photos.update_one({"id": photo_id}, {"$set": {"position": position}})
    # photos not named in the payload keep following the listed ones
    for offset, photo_id in enumerate(sorted(owned - set(input.photo_ids))):
        await db.photos.update_one(
            {"id": photo_id}, {"$set": {"position": len(input.photo_ids) + offset}}
        )
    await db.clients.update_one({"id": client_id}, {"$set": {"custom_photo_order": True}})
    photos = await db.photos.find({"client_id": client_id}).sort([("position", 1)]).to_list(5000)
    return [to_photo_out(Photo(**p)) for p in photos]


@router.put("/clients/{client_id}/cover", response_model=AdminClient, dependencies=[Depends(require_admin)])
async def admin_set_cover(client_id: str, input: CoverInput):
    """Pick one of the client's photos as the card cover (or clear the pick)."""
    doc = await db.clients.find_one({"id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    client = Client(**doc)
    if input.photo_id:
        owned = await db.photos.find_one({"id": input.photo_id, "client_id": client_id})
        if not owned:
            raise HTTPException(status_code=400, detail="Foto tidak ditemukan pada klien ini")
        client.cover_photo_id = input.photo_id
        client.cover_url = None  # a picked photo replaces any external cover URL
    else:
        client.cover_photo_id = None
    await db.clients.replace_one({"id": client_id}, client.model_dump())
    counts = await _photo_counts()
    return _admin_out(client, counts.get(client_id, 0))


@router.get("/settings", response_model=SiteSettings, dependencies=[Depends(require_admin)])
async def admin_get_settings():
    return await load_settings()


@router.put("/settings", response_model=SiteSettings, dependencies=[Depends(require_admin)])
async def admin_update_settings(input: SiteSettings):
    """Replace the guest-facing presentation settings (all texts + palette + hero image)."""
    await db.settings.update_one(
        {"key": SETTINGS_KEY}, {"$set": {"key": SETTINGS_KEY, **input.model_dump()}}, upsert=True
    )
    return input


@router.post("/settings/reset", response_model=SiteSettings, dependencies=[Depends(require_admin)])
async def admin_reset_settings():
    """Back to the shipped defaults."""
    fresh = SiteSettings()
    await db.settings.update_one(
        {"key": SETTINGS_KEY}, {"$set": {"key": SETTINGS_KEY, **fresh.model_dump()}}, upsert=True
    )
    return fresh


@router.post("/uploads", dependencies=[Depends(require_admin)])
async def admin_upload_image(file: UploadFile = File(...)):
    """Accept a photo straight from the admin's device; returns the URL to use."""
    return await store_upload(file)


@router.post("/clients/{client_id}/sync", dependencies=[Depends(require_admin)])
async def admin_sync_client(client_id: str):
    doc = await db.clients.find_one({"id": client_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Klien tidak ditemukan")
    client = Client(**doc)
    if not client.drive_folder_id:
        raise HTTPException(
            status_code=400,
            detail="Klien ini belum memiliki folder Google Drive — tambahkan link foldernya dahulu",
        )
    try:
        count = await sync_client_photos(client)
    except DriveError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"photo_count": count, "synced_at": utcnow().isoformat()}
