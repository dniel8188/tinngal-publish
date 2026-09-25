"""Background Drive watcher.

Every `DRIVE_POLL_SECONDS` (default 60) it re-reads each client's Google Drive
folder, so photos exported from Capture One straight into Drive show up on the
site on their own — no admin action and no "open in Drive" step.
"""

import asyncio
import logging
import os

from lib.db import db
from lib.sync import sync_photos_quietly
from models.clients import Client

logger = logging.getLogger(__name__)


def poll_interval() -> int:
    try:
        return max(15, int(os.environ.get("DRIVE_POLL_SECONDS", "60")))
    except ValueError:
        return 60


async def poll_drive_folders_forever() -> None:
    interval = poll_interval()
    logger.info("drive poller started — every %ss", interval)
    while True:
        try:
            docs = await db.clients.find({"drive_folder_id": {"$ne": None}}).to_list(500)
            for doc in docs:
                await sync_photos_quietly(Client(**doc))
                await asyncio.sleep(0.5)  # be gentle with Drive between folders
        except asyncio.CancelledError:
            logger.info("drive poller stopped")
            raise
        except Exception as exc:  # a bad cycle must never kill the loop
            logger.warning("drive poll cycle failed: %s", exc)
        await asyncio.sleep(interval)
