"""Pydantic models for wedding clients and their Google-Drive-backed photo galleries."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from lib.drive import alt_url, full_url, thumb_url


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Client(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    event_date: str | None = None  # ISO "YYYY-MM-DD"
    venue: str | None = None
    drive_folder_id: str | None = None
    drive_folder_url: str | None = None  # the link as pasted by admin
    cover_url: str | None = None  # external-URL override; defaults to the first photo
    cover_photo_id: str | None = None  # a photo picked as cover by the admin (wins over cover_url)
    custom_photo_order: bool = False  # True once an admin reorders: Drive sync stops re-sorting
    sort_order: int = 0
    synced_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Photo(BaseModel):
    id: str = Field(default_factory=new_id)
    client_id: str
    drive_file_id: str | None = None  # None for demo/manual-URL photos
    url: str = ""
    name: str = ""
    position: int = 0
    album_id: str | None = None  # top-level Drive subfolder this photo lives in
    album_name: str | None = None


# ---- Response shapes (mirrored by frontend/src/lib/types.ts — keep in sync) ----


class PhotoOut(BaseModel):
    id: str
    name: str
    thumb: str
    full: str
    alt: str | None = None  # fallback URL if the primary image CDN fails
    album_id: str | None = None
    album_name: str | None = None


class AlbumOut(BaseModel):
    """A folder inside the client's Drive folder, shown as a card before the photos."""

    id: str  # the Drive subfolder id, or "__root__" for loose photos
    name: str
    photo_count: int
    cover: str | None = None


class ClientSummary(BaseModel):
    id: str
    name: str
    event_date: str | None
    venue: str | None
    cover: str | None
    photo_count: int


class ClientDetail(BaseModel):
    id: str
    name: str
    event_date: str | None
    venue: str | None
    drive_folder_id: str | None
    drive_folder_url: str | None
    cover: str | None
    cover_photo_id: str | None = None
    photo_count: int
    synced_at: datetime | None
    albums: list[AlbumOut] = []
    photos: list[PhotoOut]


class AdminClient(Client):
    photo_count: int


# ---- Input shapes ----


class ClientCreate(BaseModel):
    name: str = Field(min_length=1)
    event_date: str | None = None
    venue: str | None = None
    drive_folder: str | None = None  # folder URL or bare id, parsed server-side
    cover_url: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    event_date: str | None = None
    venue: str | None = None
    drive_folder: str | None = None
    cover_url: str | None = None


def to_photo_out(photo: Photo) -> PhotoOut:
    if photo.drive_file_id:
        return PhotoOut(
            id=photo.id,
            name=photo.name,
            thumb=thumb_url(photo.drive_file_id),
            full=full_url(photo.drive_file_id),
            alt=alt_url(photo.drive_file_id),
            album_id=photo.album_id,
            album_name=photo.album_name,
        )
    return PhotoOut(
        id=photo.id,
        name=photo.name,
        thumb=photo.url,
        full=photo.url,
        album_id=photo.album_id,
        album_name=photo.album_name,
    )


ROOT_ALBUM_ID = "__root__"


def albums_for(photos: list[Photo]) -> list[AlbumOut]:
    """Group photos into folder cards, Drive subfolders first, loose photos last."""
    buckets: dict[str, list[Photo]] = {}
    names: dict[str, str] = {}
    for photo in photos:
        key = photo.album_id or ROOT_ALBUM_ID
        buckets.setdefault(key, []).append(photo)
        names[key] = photo.album_name or "Foto Lainnya"
    albums = [
        AlbumOut(
            id=key,
            name=names[key],
            photo_count=len(items),
            cover=to_photo_out(items[0]).thumb,
        )
        for key, items in buckets.items()
    ]
    albums.sort(key=lambda a: (a.id == ROOT_ALBUM_ID, a.name.lower()))
    return albums


def cover_for(client: Client, photos: list[Photo]) -> str | None:
    """Cover precedence: admin-picked photo → external URL override → first photo."""
    if client.cover_photo_id:
        picked = next((p for p in photos if p.id == client.cover_photo_id), None)
        if picked:
            return to_photo_out(picked).thumb
    if client.cover_url:
        return client.cover_url
    if photos:
        return to_photo_out(photos[0]).thumb
    return None
