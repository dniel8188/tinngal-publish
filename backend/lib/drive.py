"""Google Drive helpers — read a PUBLIC ("anyone with the link") folder as an album tree.

Two strategies, tried in order:
1. Drive API v3 `files.list` with a simple API key (`GOOGLE_DRIVE_API_KEY` in
   backend/.env) — the reliable path for large galleries.
2. Zero-credential fallback: walk the public "embedded folder view" pages.

Every photo is tagged with the TOP-LEVEL subfolder it came from (`album_id` /
`album_name`), so the gallery can present folders (Akad, Resepsi, …) before photos.
Photos sitting directly in the client's folder have `album_id = None`.
"""

import logging
import os
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

_FOLDER_IN_URL = re.compile(r"/folders/([\w-]{10,})")
_ID_IN_URL = re.compile(r"[?&]id=([\w-]{10,})")
_RAW_ID = re.compile(r"^[\w-]{10,}$")
_ENTRY_ID = re.compile(r'id="entry-([\w-]{20,})"')
_ENTRY_TITLE = re.compile(r'class="flip-entry-title">\s*([^<]*?)\s*<')
_ENTRY_MIME = re.compile(r"/type/([\w/.-]+)")
_IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".bmp", ".tif", ".tiff")
FOLDER_MIME = "application/vnd.google-apps.folder"

_MAX_DEPTH = 4  # subfolder levels to walk
_MAX_PHOTOS = 3000  # global safety cap per client
_UA_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}


@dataclass
class DrivePhoto:
    drive_file_id: str
    name: str
    album_id: str | None = None
    album_name: str | None = None


@dataclass
class DriveFolder:
    id: str
    name: str


class DriveError(Exception):
    """The folder could not be listed (not shared publicly, bad id, network, ...)."""


def parse_folder_id(text: str | None) -> str | None:
    """Accept a full folder URL, a bare folder id, or nothing."""
    text = (text or "").strip()
    if not text:
        return None
    for pattern in (_FOLDER_IN_URL, _ID_IN_URL):
        m = pattern.search(text)
        if m:
            return m.group(1)
    if _RAW_ID.match(text):
        return text
    return None


def thumb_url(file_id: str) -> str:
    return f"https://lh3.googleusercontent.com/d/{file_id}=w1200"


def full_url(file_id: str) -> str:
    return f"https://lh3.googleusercontent.com/d/{file_id}=w2000"


def alt_url(file_id: str) -> str:
    """Fallback renderer used by the frontend if the primary image CDN fails."""
    return f"https://drive.google.com/thumbnail?id={file_id}&sz=w1600"


def _is_image_name(name: str) -> bool:
    return name.lower().endswith(_IMAGE_EXTS)


async def list_drive_photos(folder_id: str) -> list[DrivePhoto]:
    """Every image in the folder tree, each tagged with its top-level album."""
    api_key = os.environ.get("GOOGLE_DRIVE_API_KEY", "").strip()
    photos: list[DrivePhoto] = []
    if api_key:
        try:
            async with httpx.AsyncClient(timeout=30) as http:
                await _walk_api(folder_id, api_key, http, photos, depth=0, album=None)
            return photos
        except DriveError as exc:
            logger.warning("Drive API listing failed for %s (%s) — trying scrape fallback", folder_id, exc)
            photos = []
    seen: set[str] = set()
    await _walk_scrape(folder_id, photos, seen, depth=0, album=None)
    return photos


# ---- Strategy 1: official API with a simple (non-OAuth) key ----


async def _walk_api(
    folder_id: str,
    api_key: str,
    http: httpx.AsyncClient,
    out: list[DrivePhoto],
    depth: int,
    album: DriveFolder | None,
) -> None:
    if depth > _MAX_DEPTH or len(out) >= _MAX_PHOTOS:
        return
    subfolders: list[DriveFolder] = []
    params: dict[str, str] = {
        "q": f"'{folder_id}' in parents and trashed = false",
        "fields": "nextPageToken, files(id, name, mimeType)",
        "pageSize": "1000",
        "orderBy": "folder, name_natural",
        "key": api_key,
    }
    while True:  # paginate past 1000 entries
        res = await http.get("https://www.googleapis.com/drive/v3/files", params=params)
        if res.status_code != 200:
            try:
                message = res.json()["error"]["message"]
            except Exception:
                message = res.text[:200]
            raise DriveError(f"Google Drive API error {res.status_code}: {message}")
        data = res.json()
        for f in data.get("files", []):
            mime = f.get("mimeType", "")
            if mime == FOLDER_MIME:
                subfolders.append(DriveFolder(id=f["id"], name=f.get("name", "Folder")))
            elif mime.startswith("image/"):
                out.append(
                    DrivePhoto(
                        drive_file_id=f["id"],
                        name=f.get("name", ""),
                        album_id=album.id if album else None,
                        album_name=album.name if album else None,
                    )
                )
                if len(out) >= _MAX_PHOTOS:
                    return
        token = data.get("nextPageToken")
        if not token:
            break
        params["pageToken"] = token
    for sub in subfolders:
        # depth 0 subfolders become the albums; anything deeper keeps its ancestor album
        await _walk_api(sub.id, api_key, http, out, depth + 1, album or sub)


# ---- Strategy 2: zero-credential embedded folder view ----


def _parse_folder_html(html: str) -> tuple[list[DrivePhoto], list[DriveFolder]]:
    """Parse one embedded-folder-view page into (images, subfolders)."""
    images: list[DrivePhoto] = []
    subfolders: list[DriveFolder] = []
    matches = list(_ENTRY_ID.finditer(html))
    for i, m in enumerate(matches):
        block = html[m.end(): matches[i + 1].start() if i + 1 < len(matches) else len(html)]
        title_m = _ENTRY_TITLE.search(block)
        title = title_m.group(1).strip() if title_m else ""
        mime_m = _ENTRY_MIME.search(block)
        mime = mime_m.group(1) if mime_m else ""
        if mime == FOLDER_MIME or FOLDER_MIME in block:
            subfolders.append(DriveFolder(id=m.group(1), name=title or "Folder"))
            continue
        if mime.startswith("image/") or _is_image_name(title):
            images.append(
                DrivePhoto(drive_file_id=m.group(1), name=title or f"Foto {len(images) + 1}")
            )
    return images, subfolders


async def _walk_scrape(
    folder_id: str,
    out: list[DrivePhoto],
    seen: set[str],
    depth: int,
    album: DriveFolder | None,
) -> None:
    if depth > _MAX_DEPTH or len(out) >= _MAX_PHOTOS:
        return
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=_UA_HEADERS) as http:
        res = await http.get(f"https://drive.google.com/embeddedfolderview?id={folder_id}#grid")
    if res.status_code != 200:
        raise DriveError(
            f"Folder tidak dapat diakses (HTTP {res.status_code}) — pastikan folder dibagikan "
            "ke 'Siapa saja yang memiliki link'"
        )
    if "flip-entry" not in res.text:
        if depth == 0:
            raise DriveError(
                "Folder tidak berisi file, atau belum dibagikan ke 'Siapa saja yang memiliki link'"
            )
        return  # an empty subfolder is fine
    images, subfolders = _parse_folder_html(res.text)
    for photo in images:
        if photo.drive_file_id in seen:
            continue
        seen.add(photo.drive_file_id)
        photo.album_id = album.id if album else None
        photo.album_name = album.name if album else None
        out.append(photo)
        if len(out) >= _MAX_PHOTOS:
            return
    for sub in subfolders:
        await _walk_scrape(sub.id, out, seen, depth + 1, album or sub)
