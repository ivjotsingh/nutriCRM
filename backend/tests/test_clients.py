from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("NUTRIALIGN_DB", str(tmp_path / "clients.db"))
    from app import db
    from app import main

    importlib.reload(db)
    importlib.reload(main)
    db.init_db()
    return TestClient(main.app)


def _create(client: TestClient) -> dict:
    response = client.post(
        "/api/clients",
        json={
            "name": "Aarti Mehta",
            "phone": "+91 90000 00000",
            "email": "test.client@example.com",
            "city": "Mumbai",
            "consent": True,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_client_can_be_created_with_only_required_fields(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    response = client.post(
        "/api/clients",
        json={"name": "Minimal Client", "phone": "9999999999", "consent": True},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["client"]["name"] == "Minimal Client"
    assert body["client"]["email"] == ""
    assert body["tabs"][0]["id"] == "basic"
    assert any(tab["id"] == "forms" for tab in body["tabs"])
    assert any(tab["id"] == "headtoe" for tab in body["tabs"])
    headtoe = next(tab for tab in body["tabs"] if tab["id"] == "headtoe")
    assert any(field["id"] == "htt_head_neck_gate" for field in headtoe["fields"])


def test_client_creation_allows_no_consent_and_empty_fields(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    response = client.post("/api/clients", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["client"]["name"] == ""
    assert body["client"]["phone"] == ""
    assert body["client"]["consent"] is False


def test_client_profile_persists_optional_data(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = _create(client)
    client_id = created["client"]["id"]

    response = client.patch(
        f"/api/clients/{client_id}",
        json={
            "name": "Aarti Mehta",
            "phone": "+91 90000 00000",
            "email": "test.client@example.com",
            "city": "Mumbai",
            "consent": True,
            "data": {
                "basic": {"gender": "Female"},
                "medical": {
                    "conditions": [{"disease": "SIBO", "since": "2022", "grading": "3"}],
                },
            },
        },
    )
    assert response.status_code == 200

    fetched = client.get(f"/api/clients/{client_id}").json()
    assert fetched["data"]["medical"]["conditions"][0]["disease"] == "SIBO"


def test_custom_option_and_dynamic_tab(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create(client)["client"]["id"]

    option = client.post(
        f"/api/clients/{client_id}/options",
        json={"category": "medical.conditions.disease", "value": "SIBO"},
    )
    assert option.status_code == 200
    assert "SIBO" in option.json()["options"]

    tab = client.post(
        f"/api/clients/{client_id}/tabs",
        json={
            "label": "Supplement Trial",
            "description": "Custom tracking",
            "fields": [
                {"label": "Supplement", "type": "text"},
                {"label": "Response", "type": "select", "options": ["Better", "Same", "Worse"]},
            ],
        },
    )
    assert tab.status_code == 200
    custom_tab = tab.json()["tab"]
    assert custom_tab["custom"] is True
    assert [field["id"] for field in custom_tab["fields"]] == ["supplement", "response"]

    fetched = client.get(f"/api/clients/{client_id}").json()
    assert any(item["id"] == custom_tab["id"] for item in fetched["tabs"])
    assert fetched["options"]["medical.conditions.disease"] == ["SIBO"]
