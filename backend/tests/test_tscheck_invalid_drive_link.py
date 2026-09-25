"""Invalid Drive link is rejected clearly with an Indonesian error, no broken client created."""
import os
import uuid

import httpx

BASE = "http://localhost:8001/api"


def _admin_client():
    c = httpx.Client(base_url=BASE, timeout=30.0)
    r = c.post("/admin/login", json={"pin": os.environ.get("ADMIN_PIN", "1234")})
    assert r.status_code == 200, r.text
    return c


def test_invalid_drive_link_rejected():
    c = _admin_client()
    suffix = uuid.uuid4().hex[:8]
    name = f"tscheck-badlink-{suffix}"

    r = c.post(
        "/admin/clients",
        json={"name": name, "drive_folder": "https://example.com/nope"},
    )
    assert r.status_code >= 400, f"expected rejection, got {r.status_code}: {r.text}"
    body = r.json()
    assert "detail" in body and body["detail"], body

    # confirm no client with this name got created
    r2 = c.get("/clients")
    assert r2.status_code == 200
    assert not any(cl["name"] == name for cl in r2.json())
