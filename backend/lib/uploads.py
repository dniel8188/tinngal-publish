"""Image uploads — stored in Mongo (not on disk, so they survive restarts/redeploys).

The admin uploads a hero cover straight from a phone gallery; Pillow normalises the
orientation and compresses it to a web-friendly JPEG before it is stored.
"""

import io
import logging
import uuid
from datetime import datetime, timezone

from bson.binary import Binary
from fastapi import HTTPException, Response, UploadFile
from PIL import Image, ImageOps

from lib.db import db

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB straight off a phone camera
MAX_EDGE = 2200  # plenty for a full-screen hero
JPEG_QUALITY = 82


async def store_upload(file: UploadFile) -> dict:
    """Validate, compress and persist an uploaded image. Returns `{id, url, bytes}`."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar (JPG, PNG, HEIC, …)")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File kosong — coba pilih foto lain")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Ukuran foto maksimal 20 MB")

    try:
        image = Image.open(io.BytesIO(raw))
        image = ImageOps.exif_transpose(image)  # respect the phone's rotation flag
        image = image.convert("RGB")
        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("upload decode failed: %s", exc)
        raise HTTPException(status_code=400, detail="Gambar tidak dapat dibaca — coba format JPG/PNG")

    data = buffer.getvalue()
    upload_id = str(uuid.uuid4())
    await db.uploads.insert_one(
        {
            "id": upload_id,
            "content_type": "image/jpeg",
            "data": Binary(data),
            "width": image.width,
            "height": image.height,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"id": upload_id, "url": f"/api/uploads/{upload_id}", "bytes": len(data)}


async def fetch_upload(upload_id: str) -> Response:
    doc = await db.uploads.find_one({"id": upload_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc.get("content_type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
