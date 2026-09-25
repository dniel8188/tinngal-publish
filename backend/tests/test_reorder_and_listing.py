"""Regression tests for:
- GET /api/clients (photos cursor now has .limit(20000)) — still returns all clients with cover + photo_count
- PUT /api/admin/clients/{client_id}/photos/order — bulk_write correctness, ownership check, auth gate
"""
import os
import httpx
import pytest

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("preview_endpoint")
    or "http://localhost:8001"
).rstrip("/") + "/api"

ADMIN_PIN = os.environ.get("ADMIN_PIN", "200604")


@pytest.fixture
def admin_client():
    c = httpx.Client(base_url=BASE_URL, timeout=30)
    r = c.post("/admin/login", json={"pin": ADMIN_PIN})
    if r.status_code != 200:
        c.close()
        pytest.skip(f"admin login failed: {r.status_code} {r.text}")
    yield c
    c.close()


# ---------- Listing regression ----------

class TestClientsListingRegression:
    def test_list_clients_returns_all_with_cover_and_count(self):
        r = httpx.get(f"{BASE_URL}/clients", timeout=30)
        assert r.status_code == 200
        clients = r.json()
        assert isinstance(clients, list)
        assert len(clients) >= 6, f"expected >=6 seeded clients, got {len(clients)}"

        with_photos = [c for c in clients if c.get("photo_count", 0) > 0]
        assert len(with_photos) >= 5, f"expected >=5 clients with photos, got {len(with_photos)}"

        for c in clients:
            assert "id" in c and "name" in c
            assert isinstance(c.get("photo_count"), int)
            # cover may be None only if client has 0 photos AND no cover_url
            if c["photo_count"] > 0:
                assert c.get("cover"), f"client {c['name']} with photos missing cover"

    def test_photo_counts_match_detail(self):
        r = httpx.get(f"{BASE_URL}/clients", timeout=30)
        for c in r.json():
            if c.get("photo_count", 0) > 0:
                d = httpx.get(f"{BASE_URL}/clients/{c['id']}", timeout=30).json()
                assert d["photo_count"] == c["photo_count"], (
                    f"listing vs detail mismatch for {c['name']}: {c['photo_count']} vs {d['photo_count']}"
                )
                break


# ---------- Reorder endpoint ----------

def _pick_client_with_photos(admin):
    r = admin.get("/admin/clients")
    assert r.status_code == 200
    for c in r.json():
        if c.get("photo_count", 0) >= 3:
            return c
    pytest.skip("no client with >=3 photos to test reorder")


class TestAdminReorder:
    def test_reorder_requires_admin(self):
        r = httpx.put(
            f"{BASE_URL}/admin/clients/anything/photos/order",
            json={"photo_ids": ["x"]},
            timeout=30,
        )
        assert r.status_code == 401

    def test_reorder_rejects_foreign_photo_ids(self, admin_client):
        c = _pick_client_with_photos(admin_client)
        r = admin_client.put(
            f"/admin/clients/{c['id']}/photos/order",
            json={"photo_ids": ["not-a-real-photo-id"]},
        )
        assert r.status_code == 400, r.text

    def test_reorder_persists_and_returns_new_order(self, admin_client):
        c = _pick_client_with_photos(admin_client)
        cid = c["id"]

        detail = httpx.get(f"{BASE_URL}/clients/{cid}", timeout=30).json()
        original_ids = [p["id"] for p in detail["photos"]]
        assert len(original_ids) >= 3

        # Reverse the first 3 and leave rest to trail behind
        reordered_head = list(reversed(original_ids[:3]))
        payload_ids = reordered_head  # partial payload — remaining must trail after

        r = admin_client.put(
            f"/admin/clients/{cid}/photos/order",
            json={"photo_ids": payload_ids},
        )
        assert r.status_code == 200, r.text
        returned = r.json()
        returned_ids = [p["id"] for p in returned]

        # First 3 must match our payload order exactly
        assert returned_ids[:3] == payload_ids, (
            f"head order mismatch: {returned_ids[:3]} vs {payload_ids}"
        )
        # All original photos still present
        assert set(returned_ids) == set(original_ids), "returned set differs from original set"
        # Remaining photos come after the listed ones (contain those not in payload)
        remaining = set(original_ids) - set(payload_ids)
        assert set(returned_ids[3:]) == remaining

        # Persistence: subsequent GET /clients/{id} reflects the new order
        detail2 = httpx.get(f"{BASE_URL}/clients/{cid}", timeout=30).json()
        persisted_ids = [p["id"] for p in detail2["photos"]]
        assert persisted_ids[:3] == payload_ids, (
            f"persisted head mismatch: {persisted_ids[:3]} vs {payload_ids}"
        )

        # Restore original order (best-effort)
        try:
            admin_client.put(
                f"/admin/clients/{cid}/photos/order",
                json={"photo_ids": original_ids},
            )
        except Exception:
            pass

    def test_login_wrong_pin(self):
        r = httpx.post(f"{BASE_URL}/admin/login", json={"pin": "000000"}, timeout=30)
        assert r.status_code == 401

    def test_login_correct_pin_sets_cookie(self):
        with httpx.Client(base_url=BASE_URL, timeout=30) as c:
            r = c.post("/admin/login", json={"pin": ADMIN_PIN})
            assert r.status_code == 200, r.text
            assert "admin_session" in c.cookies
