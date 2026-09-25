"""Sync a client's Google Drive folder into the `photos` collection.

The sync is *incremental*: a photo already stored keeps its row (and therefore its
stable id), new Drive files are appended, and files removed from Drive are dropped.
That keeps the gallery from flickering while it auto-refreshes in the background.
"""

import logging
import uuid
from datetime import datetime, timezone

from lib.db import db
from lib.drive import list_drive_photos
from models.clients import Client

logger = logging.getLogger(__name__)


async def sync_client_photos(client: Client) -> int:
    """Reconcile this client's Drive-backed photos with the folder's current contents.

    Photo rows without a `drive_file_id` (demo/manual URL photos) are preserved.
    Returns the number of Drive photos now attached.
    """
    if not client.drive_folder_id:
        return 0

    items = await list_drive_photos(client.drive_folder_id)
    live_ids = [item.drive_file_id for item in items]

    existing: dict[str, dict] = {}
    async for doc in db.photos.find({"client_id": client.id, "drive_file_id": {"$ne": None}}):
        existing[doc["drive_file_id"]] = doc

    # 1. files no longer in the folder
    stale = [fid for fid in existing if fid not in set(live_ids)]
    if stale:
        await db.photos.delete_many(
            {"client_id": client.id, "drive_file_id": {"$in": stale}}
        )

    # 2. insert newcomers. If an admin arranged the order manually, existing rows keep their
    #    positions and new arrivals are appended at the end instead of re-sorting the gallery.
    manual = client.custom_photo_order
    next_position = (max((d.get("position", 0) for d in existing.values()), default=-1) + 1)
    new_docs = []
    for position, item in enumerate(items):
        current = existing.get(item.drive_file_id)
        if current is None:
            new_docs.append(
                {
                    "id": str(uuid.uuid4()),
                    "client_id": client.id,
                    "drive_file_id": item.drive_file_id,
                    "name": item.name,
                    "url": "",
                    "position": next_position if manual else position,
                    "album_id": item.album_id,
                    "album_name": item.album_name,
                }
            )
            next_position += 1
        elif not manual and (
            current.get("position") != position
            or current.get("name") != item.name
            or current.get("album_id") != item.album_id
        ):
            await db.photos.update_one(
                {"id": current["id"]},
                {
                    "$set": {
                        "position": position,
                        "name": item.name,
                        "album_id": item.album_id,
                        "album_name": item.album_name,
                    }
                },
            )
        elif manual and (
            current.get("name") != item.name or current.get("album_id") != item.album_id
        ):
            await db.photos.update_one(
                {"id": current["id"]},
                {
                    "$set": {
                        "name": item.name,
                        "album_id": item.album_id,
                        "album_name": item.album_name,
                    }
                },
            )
    if new_docs:
        await db.photos.insert_many(new_docs)

    await db.clients.update_one(
        {"id": client.id}, {"$set": {"synced_at": datetime.now(timezone.utc)}}
    )
    if new_docs or stale:
        logger.info(
            "client %s: +%d new / -%d removed drive photos (total %d)",
            client.id, len(new_docs), len(stale), len(items),
        )
    return len(items)


async def sync_photos_quietly(client: Client) -> int:
    """Background-safe variant: log failures, never raise into a caller's response."""
    try:
        return await sync_client_photos(client)
    except Exception as exc:
        logger.warning("background drive sync failed for %s: %s", client.drive_folder_id, exc)
        return -1
