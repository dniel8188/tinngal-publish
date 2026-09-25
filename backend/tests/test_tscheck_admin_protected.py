"""Admin is protected by a PIN (backend/.env ADMIN_PIN)."""
import os

import httpx


def test_wrong_pin_rejected(client):
    resp = client.post("/admin/login", json={"pin": "9999"})
    assert resp.status_code in (400, 401, 403), resp.text
    body = resp.json()
    assert "detail" in body
    # Indonesian error message expected
    assert body["detail"], body


def test_correct_pin_accepted(client):
    resp = client.post("/admin/login", json={"pin": os.environ.get("ADMIN_PIN", "1234")})
    assert resp.status_code == 200, resp.text
    assert resp.json().get("ok") is True


def test_admin_endpoint_requires_session():
    # No cookie -> should not reveal client manager data
    with httpx.Client(base_url="http://localhost:8001/api", timeout=30.0) as c:
        resp = c.get("/admin/clients")
        assert resp.status_code in (401, 403), resp.text
