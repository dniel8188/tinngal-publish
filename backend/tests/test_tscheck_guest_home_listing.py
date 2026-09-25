"""Guest home lists clients with no login: GET /clients returns fields required for
name/date/venue/photo count display, and clicking through works via GET /clients/{id}."""
import uuid

import httpx

BASE = "http://localhost:8001/api"


def test_public_clients_listing_has_required_fields():
    with httpx.Client(base_url=BASE, timeout=30.0) as c:
        r = c.get("/clients")
        assert r.status_code == 200, r.text
        clients = r.json()
        assert isinstance(clients, list)
        assert len(clients) >= 1
        for cl in clients:
            for field in ("id", "name", "photo_count"):
                assert field in cl, cl
        # detail fetch works with no auth/cookies
        cid = clients[0]["id"]
        r2 = c.get(f"/clients/{cid}")
        assert r2.status_code == 200
        assert r2.json()["id"] == cid


def test_public_listing_grows_with_new_client_no_auth_needed_to_view():
    admin = httpx.Client(base_url=BASE, timeout=30.0)
    r = admin.post("/admin/login", json={"pin": "1234"})
    assert r.status_code == 200

    suffix = uuid.uuid4().hex[:8]
    name = f"tscheck-homelist-{suffix}"
    r = admin.post("/admin/clients", json={"name": name, "venue": "Balai Kartini", "event_date": "2026-05-01"})
    assert r.status_code in (200, 201), r.text
    client_id = r.json()["id"]

    try:
        with httpx.Client(base_url=BASE, timeout=30.0) as guest:
            r2 = guest.get("/clients")
            assert r2.status_code == 200
            found = next((c for c in r2.json() if c["id"] == client_id), None)
            assert found is not None, "newly created client not visible to unauthenticated guest"
            assert found["name"] == name
    finally:
        admin.delete(f"/admin/clients/{client_id}")
