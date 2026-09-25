"""Admin CRUD: create a client, edit its name, delete it. Uses tscheck- prefixed fixture only."""
import uuid

import httpx

BASE = "http://localhost:8001/api"


def _admin_client():
    c = httpx.Client(base_url=BASE, timeout=30.0)
    r = c.post("/admin/login", json={"pin": "1234"})
    assert r.status_code == 200, r.text
    return c


def test_admin_crud_create_edit_delete():
    c = _admin_client()
    suffix = uuid.uuid4().hex[:8]
    name = f"tscheck-crud-{suffix}"

    # CREATE
    r = c.post("/admin/clients", json={"name": name, "event_date": None, "venue": "Test Venue"})
    assert r.status_code in (200, 201), r.text
    created = r.json()
    client_id = created["id"]
    assert created["name"] == name

    try:
        # verify visible via public endpoint
        r = c.get("/clients")
        assert r.status_code == 200
        assert any(cl["id"] == client_id for cl in r.json())

        # EDIT
        new_name = name + "-edited"
        r = c.put(f"/admin/clients/{client_id}", json={"name": new_name})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name

        r = c.get(f"/clients/{client_id}")
        assert r.status_code == 200
        assert r.json()["name"] == new_name
    finally:
        # DELETE (cleanup)
        r = c.delete(f"/admin/clients/{client_id}")
        assert r.status_code in (200, 204), r.text

    # confirm gone
    r = c.get(f"/clients/{client_id}")
    assert r.status_code == 404
