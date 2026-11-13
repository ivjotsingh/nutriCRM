from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("NUTRIALIMENT_DB", str(tmp_path / "clients.db"))
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
            "name": "Test Client",
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
    tab_ids = [tab["id"] for tab in body["tabs"]]
    assert tab_ids.index("strategy") > tab_ids.index("headtoe")
    headtoe = next(tab for tab in body["tabs"] if tab["id"] == "headtoe")
    assert any(field["id"] == "htt_head_neck_gate" for field in headtoe["fields"])

    medical = next(tab for tab in body["tabs"] if tab["id"] == "medical")
    conditions = next(field for field in medical["fields"] if field["id"] == "conditions")
    assert conditions["columns"][0]["type"] == "combo"
    assert "Diabetes" in conditions["columns"][0]["options"]

    dietary = next(tab for tab in body["tabs"] if tab["id"] == "dietary")
    notes = next(field for field in dietary["fields"] if field["id"] == "medication_notes")
    assert notes["type"] == "textarea"


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
            "name": "Test Client",
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


def test_client_program_dates_persist_and_can_be_updated(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post(
        "/api/clients",
        json={
            "name": "Program Client",
            "start_date": "2026-10-01",
            "end_date": "2027-03-29",
        },
    )
    assert created.status_code == 200
    body = created.json()["client"]
    assert body["start_date"] == "2026-10-01"
    assert body["end_date"] == "2027-03-29"

    client_id = body["id"]
    updated = client.patch(
        f"/api/clients/{client_id}",
        json={"start_date": "2026-11-01", "end_date": "2026-11-30"},
    )
    assert updated.status_code == 200
    assert updated.json()["client"]["start_date"] == "2026-11-01"
    assert updated.json()["client"]["end_date"] == "2026-11-30"


def test_client_program_dates_reject_invalid_ranges_and_formats(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    reversed_range = client.post(
        "/api/clients",
        json={"name": "Reversed", "start_date": "2026-12-01", "end_date": "2026-11-01"},
    )
    assert reversed_range.status_code == 400
    assert "before" in reversed_range.json()["detail"]

    bad_format = client.post(
        "/api/clients",
        json={"name": "Bad format", "start_date": "01/10/2026"},
    )
    assert bad_format.status_code == 400
    assert "YYYY-MM-DD" in bad_format.json()["detail"]
