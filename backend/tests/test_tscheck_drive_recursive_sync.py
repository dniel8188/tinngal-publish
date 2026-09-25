"""BUG FIX regression: a client linked to a real public Drive folder shows ALL photos
(recursive subfolder walk + pagination), not just one. Also verifies manual re-sync
keeps the full photo set."""
import uuid

import httpx

BASE = "http://localhost:8001/api"
DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1tto2XSxREQHgTa7CRyjMftifVK8jzeyi"
EXPECTED_COUNT = 22


def _admin_client():
    c = httpx.Client(base_url=BASE, timeout=60.0)
    r = c.post("/admin/login", json={"pin": "1234"})
    assert r.status_code == 200, r.text
    return c


def test_drive_recursive_listing_full_photo_set():
    c = _admin_client()
    suffix = uuid.uuid4().hex[:8]
    name = f"tscheck-drive-{suffix}"

    r = c.post("/admin/clients", json={"name": name, "drive_folder": DRIVE_FOLDER_URL})
    assert r.status_code in (200, 201), r.text
    created = r.json()
    client_id = created["id"]

    try:
        r = c.get("/admin/clients")
        assert r.status_code == 200
        row = next(cl for cl in r.json() if cl["id"] == client_id)
        assert row["photo_count"] == EXPECTED_COUNT, f"expected {EXPECTED_COUNT} photos, got {row['photo_count']}"

        r = c.get(f"/clients/{client_id}")
        assert r.status_code == 200
        detail = r.json()
        photos = detail.get("photos", [])
        assert len(photos) == EXPECTED_COUNT, f"gallery detail has {len(photos)} photos, expected {EXPECTED_COUNT}"
        # each photo should have thumb/full fallback urls
        sample = photos[0]
        assert "thumb" in sample and "full" in sample, sample

        # manual re-sync should keep the same count
        r = c.post(f"/admin/clients/{client_id}/sync")
        assert r.status_code == 200, r.text
        r = c.get("/admin/clients")
        row2 = next(cl for cl in r.json() if cl["id"] == client_id)
        assert row2["photo_count"] == EXPECTED_COUNT, f"after resync expected {EXPECTED_COUNT}, got {row2['photo_count']}"
    finally:
        c.delete(f"/admin/clients/{client_id}")
