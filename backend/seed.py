"""Seed demo clients so the gallery preview is instantly populated.

Run:  cd /app/backend && python seed.py

Demo clients ship with hand-picked sample photos (no Drive folder attached yet).
An admin adds a real Google Drive folder link per client from /admin — the
gallery then syncs that folder's photos automatically. Idempotent: it resets
the `clients` and `photos` collections each run.
"""

import asyncio
import uuid
from datetime import datetime, timezone

from lib.db import db, ensure_indexes

CLIENTS = [
    {
        "name": "Aditya & Clarissa",
        "event_date": "2024-07-14",
        "venue": "The Glass House, Bali",
        "cover": "https://images.unsplash.com/photo-1606490208247-b65be3d94cd1?crop=entropy&cs=srgb&fm=jpg&q=85",
        "count": 28,
    },
    {
        "name": "Bimantara & Alyssa",
        "event_date": "2024-09-28",
        "venue": "Plataran Hutan Kota, Jakarta",
        "cover": "https://images.unsplash.com/photo-1672288336066-8cd91b57b510?crop=entropy&cs=srgb&fm=jpg&q=85",
        "count": 24,
    },
    {
        "name": "Reza & Nadia",
        "event_date": "2024-10-10",
        "venue": "Amanjiwo Resort, Magelang",
        "cover": "https://images.unsplash.com/photo-1648154164366-d067faecdc51?crop=entropy&cs=srgb&fm=jpg&q=85",
        "count": 30,
    },
    {
        "name": "Dimas & Keisha",
        "event_date": "2024-11-05",
        "venue": "Pine Hill, Lembang Bandung",
        "cover": "https://images.pexels.com/photos/35553660/pexels-photo-35553660.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "count": 22,
    },
    {
        "name": "Farhan & Zahra",
        "event_date": "2024-12-18",
        "venue": "Sampoerna Strategic Square, Jakarta",
        "cover": "https://images.pexels.com/photos/28824204/pexels-photo-28824204.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "count": 26,
    },
    {
        "name": "Jonathan & Valerie",
        "event_date": "2025-01-20",
        "venue": "Alila Villas Uluwatu, Bali",
        "cover": "https://images.unsplash.com/photo-1606217239582-d9f72323bcd7?crop=entropy&cs=srgb&fm=jpg&q=85",
        "count": 32,
    },
]

PHOTO_POOL = [
    "https://images.unsplash.com/photo-1672288336066-8cd91b57b510?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1606217239582-d9f72323bcd7?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1474867985807-96ca17098cc9?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1606490208247-b65be3d94cd1?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.pexels.com/photos/35553660/pexels-photo-35553660.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "https://images.pexels.com/photos/30772210/pexels-photo-30772210.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "https://images.unsplash.com/photo-1648154164366-d067faecdc51?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1439539698758-ba2680ecadb9?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1714972383570-44ddc9738355?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.pexels.com/photos/13434437/pexels-photo-13434437.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "https://images.pexels.com/photos/28824204/pexels-photo-28824204.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "https://images.unsplash.com/photo-1595407753234-0882f1e77954?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1573676048035-9c2a72b6a12a?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.unsplash.com/photo-1583939411023-14783179e581?crop=entropy&cs=srgb&fm=jpg&q=85",
    "https://images.pexels.com/photos/34635470/pexels-photo-34635470.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "https://images.pexels.com/photos/18322549/pexels-photo-18322549.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
]


async def seed() -> None:
    await db.clients.delete_many({})
    await db.photos.delete_many({})
    total_photos = 0
    for order, spec in enumerate(CLIENTS, start=1):
        client_id = str(uuid.uuid4())
        await db.clients.insert_one(
            {
                "id": client_id,
                "name": spec["name"],
                "event_date": spec["event_date"],
                "venue": spec["venue"],
                "drive_folder_id": None,
                "drive_folder_url": None,
                "cover_url": spec["cover"],
                "sort_order": order,
                "synced_at": None,
                "created_at": datetime.now(timezone.utc),
            }
        )
        docs = [
            {
                "id": str(uuid.uuid4()),
                "client_id": client_id,
                "drive_file_id": None,
                "url": PHOTO_POOL[(i + order) % len(PHOTO_POOL)],
                "name": f"IMG_{i + 1:04d}.JPG",
                "position": i,
            }
            for i in range(spec["count"])
        ]
        await db.photos.insert_many(docs)
        total_photos += len(docs)
    await ensure_indexes()
    print(f"seeded {len(CLIENTS)} clients / {total_photos} photos")


if __name__ == "__main__":
    asyncio.run(seed())
