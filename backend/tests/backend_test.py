"""Comprehensive backend API tests for the FixJadi/Anyar wedding gallery.

Covers public endpoints, admin auth+gating, admin client CRUD, settings admin,
and the image upload endpoint. Uses the external preview URL when available and
falls back to localhost so the same suite works everywhere.
"""
import io
import os
import uuid

import httpx
import pytest

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("preview_endpoint")
    or "http://localhost:8001"
).rstrip("/") + "/api"

ADMIN_PIN = os.environ.get("ADMIN_PIN", "246810")


# ---------- Public endpoints ----------

class TestPublic:
    def test_get_clients_returns_seeded_galleries(self):
        r = httpx.get(f"{BASE_URL}/clients", timeout=30)
        assert r.status_code == 200
        clients = r.json()
        assert isinstance(clients, list)
        assert len(clients) >= 6, f"expected >=6 seeded clients, got {len(clients)}"
        for c in clients:
            assert "id" in c and "name" in c and "photo_count" in c
            assert "cover" in c

    def test_get_client_detail_returns_photos(self):
        r = httpx.get(f"{BASE_URL}/clients", timeout=30)
        client_id = r.json()[0]["id"]
        r = httpx.get(f"{BASE_URL}/clients/{client_id}", timeout=30)
        assert r.status_code == 200
        detail = r.json()
        assert detail["id"] == client_id
        assert isinstance(detail.get("photos"), list)
        assert detail.get("photo_count", 0) == len(detail["photos"])

    def test_get_client_detail_404_unknown(self):
        r = httpx.get(f"{BASE_URL}/clients/does-not-exist", timeout=30)
        assert r.status_code == 404

    def test_get_settings_public(self):
        r = httpx.get(f"{BASE_URL}/settings", timeout=30)
        assert r.status_code == 200
        s = r.json()
        assert "brand_name" in s and isinstance(s["brand_name"], str)


# ---------- Admin login / session gating ----------

class TestAdminAuth:
    def test_admin_endpoints_require_session(self):
        r = httpx.get(f"{BASE_URL}/admin/clients", timeout=30)
        assert r.status_code == 401

    def test_admin_settings_put_requires_session(self):
        r = httpx.put(f"{BASE_URL}/admin/settings", json={}, timeout=30)
        assert r.status_code == 401

    def test_login_wrong_pin(self):
        r = httpx.post(f"{BASE_URL}/admin/login", json={"pin": "000000"}, timeout=30)
        assert r.status_code == 401

    def test_login_correct_pin_sets_cookie_and_me(self):
        with httpx.Client(base_url=BASE_URL, timeout=30) as c:
            r = c.post("/admin/login", json={"pin": ADMIN_PIN})
            assert r.status_code == 200, r.text
            assert r.json().get("ok") is True
            assert "admin_session" in c.cookies
            me = c.get("/admin/me")
            assert me.status_code == 200
            assert me.json().get("authenticated") is True

    def test_logout_clears_session(self):
        with httpx.Client(base_url=BASE_URL, timeout=30) as c:
            c.post("/admin/login", json={"pin": ADMIN_PIN})
            c.post("/admin/logout")
            r = c.get("/admin/clients")
            assert r.status_code == 401


# ---------- Admin client CRUD ----------

@pytest.fixture
def admin_client():
    c = httpx.Client(base_url=BASE_URL, timeout=30)
    r = c.post("/admin/login", json={"pin": ADMIN_PIN})
    if r.status_code != 200:
        c.close()
        pytest.skip("admin login failed")
    yield c
    c.close()


class TestAdminClientCRUD:
    def test_admin_list_clients(self, admin_client):
        r = admin_client.get("/admin/clients")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for d in data:
            assert "id" in d and "name" in d and "photo_count" in d

    def test_create_update_delete_client(self, admin_client):
        name = f"TEST_{uuid.uuid4().hex[:8]}"
        # CREATE
        r = admin_client.post("/admin/clients", json={"name": name})
        assert r.status_code in (200, 201), r.text
        created = r.json()
        cid = created["id"]
        assert created["name"] == name

        # Verify via public GET
        r = httpx.get(f"{BASE_URL}/clients/{cid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["name"] == name

        # UPDATE (venue)
        r = admin_client.put(f"/admin/clients/{cid}", json={"venue": "TEST_Venue"})
        assert r.status_code == 200, r.text
        assert r.json()["venue"] == "TEST_Venue"

        # Verify persistence
        r = httpx.get(f"{BASE_URL}/clients/{cid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["venue"] == "TEST_Venue"

        # DELETE
        r = admin_client.delete(f"/admin/clients/{cid}")
        assert r.status_code in (200, 204)

        # Verify gone
        r = httpx.get(f"{BASE_URL}/clients/{cid}", timeout=30)
        assert r.status_code == 404

    def test_create_client_bad_drive_link_returns_400(self, admin_client):
        r = admin_client.post(
            "/admin/clients",
            json={"name": f"TEST_bad_{uuid.uuid4().hex[:6]}", "drive_folder": "not-a-link"},
        )
        assert r.status_code == 400


# ---------- Settings admin ----------

class TestSettingsAdmin:
    def test_get_put_reset_settings(self, admin_client):
        # GET
        r = admin_client.get("/admin/settings")
        assert r.status_code == 200
        settings = r.json()
        assert "brand_name" in settings

        # PUT
        new_brand = f"TEST_Brand_{uuid.uuid4().hex[:6]}"
        settings["brand_name"] = new_brand
        r = admin_client.put("/admin/settings", json=settings)
        assert r.status_code == 200, r.text
        assert r.json()["brand_name"] == new_brand

        # Public reflects
        r = httpx.get(f"{BASE_URL}/settings", timeout=30)
        assert r.json()["brand_name"] == new_brand

        # RESET
        r = admin_client.post("/admin/settings/reset")
        assert r.status_code == 200
        default_brand = r.json()["brand_name"]
        assert default_brand and default_brand != new_brand


# ---------- Upload endpoint ----------

def _make_png() -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), (200, 100, 50)).save(buf, format="PNG")
    return buf.getvalue()


_PNG_1x1 = _make_png()


class TestUploads:
    def test_upload_requires_admin(self):
        files = {"file": ("t.png", io.BytesIO(_PNG_1x1), "image/png")}
        r = httpx.post(f"{BASE_URL}/admin/uploads", files=files, timeout=30)
        assert r.status_code == 401

    def test_upload_and_fetch(self, admin_client):
        files = {"file": ("t.png", io.BytesIO(_PNG_1x1), "image/png")}
        r = admin_client.post("/admin/uploads", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expect either {url, id} or just {url}; extract id from url if needed
        url = data.get("url") or ""
        upload_id = data.get("id")
        if not upload_id and "/uploads/" in url:
            upload_id = url.rsplit("/uploads/", 1)[-1].split("?")[0]
        assert upload_id, f"no upload id returned: {data}"

        r = httpx.get(f"{BASE_URL}/uploads/{upload_id}", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 0
