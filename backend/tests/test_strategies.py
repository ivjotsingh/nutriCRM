from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("NUTRIALIMENT_DB", str(tmp_path / "strategies.db"))
    from app import db
    from app import main

    importlib.reload(db)
    importlib.reload(main)
    db.init_db()
    return TestClient(main.app)


def _create_client(client: TestClient, *, consent: bool = True) -> str:
    response = client.post(
        "/api/clients",
        json={
            "name": "Test Client",
            "phone": "+91 90000 00000",
            "email": "test.client@example.com",
            "city": "Mumbai",
            "consent": consent,
        },
    )
    assert response.status_code == 200
    client_id = response.json()["client"]["id"]
    data = {
        "basic": {"dob": "1961-11-29", "gender": "Female", "diet_type": "Vegetarian"},
        "bca": {"height_cm": 147, "weight_kg": 55, "body_fat_pct": 29.8},
        "medical": {
            "primary_goal": "Medical condition",
            "fitness_goal": "Muscle gain",
            "specific_areas": "Improvement of gut health\nImprovement of diabetic management",
            "activity_level": "Low",
            "conditions": [{"disease": "Diabetes"}, {"disease": "Hypertension (High BP)"}],
        },
        "dietary": {
            "food_preference": "Vegetarian",
            "allergies": ["Milk / dairy"],
            "medications": [
                {"name": "Tab Calaptin 40", "dosage": "40 mg", "frequency": "Once daily", "meal_time": "Before breakfast", "since": "2024-07-09"},
                {"name": "Tab Telmisartan 40", "dosage": "40 mg", "frequency": "Once daily", "meal_time": "After breakfast", "since": "2024-07-09"},
            ],
            "supplements": [{"name": "Plant protein", "dosage": "1 scoop"}],
        },
        "blood": {
            "report_date": "2026-09-13",
            "parameters": [
                {"category": "Diabetes", "test_name": "Glucose Fasting", "value": "116", "unit": "mg/dL", "reference_range": "70-100", "flag": "High"},
                {"category": "Complete Blood Count", "test_name": "Hemoglobin", "value": "11", "unit": "g/dL", "reference_range": "12-14", "flag": "Low"},
            ],
        },
        "headtoe": {
            "htt_head_neck_gate": "Yes",
            "htt_head_neck_findings": ["Migraine"],
            "htt_energy_mood_gate": "Yes",
            "htt_energy_mood_findings": ["Low energy"],
        },
    }
    assert client.patch(f"/api/clients/{client_id}", json={"data": data}).status_code == 200
    return client_id


def _create_strategy(client: TestClient, client_id: str) -> dict:
    response = client.post(f"/api/clients/{client_id}/strategies", json={})
    assert response.status_code == 200, response.text
    return response.json()


def _ready_payload(detail: dict) -> dict:
    data = detail["strategy"]["data"]
    data["governance"]["reviewed_clinical"] = True
    data["governance"]["acknowledged_interactions"] = True
    data["meta"]["delivery_at"] = "2026-12-20T10:00"
    return data


def test_create_strategy_prefills_the_practice_brief(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_strategy(client, client_id)
    strategy = detail["strategy"]
    data = strategy["data"]
    assert strategy["status"] == "draft"
    assert strategy["version"] == 0
    assert data["meta"]["patient_type"] == "Diabetic + hypertensive"
    assert data["meta"]["diet_type"] == "Vegetarian"
    assert data["body"]["height_cm"] == 147
    assert data["body"]["weight_kg"] == 55
    assert data["body"]["target_weight_kg"] == 55
    assert data["clinical"]["conditions"] == ["Diabetes", "Hypertension (High BP)"]
    assert data["clinical"]["symptoms"] == ["Migraine", "Low energy"]
    assert [row["test"] for row in data["clinical"]["deranged"]] == ["Glucose Fasting", "Hemoglobin"]
    assert [row["name"] for row in data["medications"]["current"]] == ["Tab Calaptin 40", "Tab Telmisartan 40"]
    assert [row["name"] for row in data["supplements"]] == ["Plant protein"]
    assert detail["derived"]["calories"]["calories"] == 1400
    assert detail["derived"]["bmr"]["source"] == "katch"
    assert len(detail["derived"]["week"]) == 7
    assert detail["derived"]["week"][0]["complete"] is True
    assert detail["reference"]["protein_targets"][0] == "0.6-0.8"
    assert detail["readiness"]["can_publish"] is False


def test_patch_recalculates_week_and_supports_macro_overrides(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_strategy(client, client_id)
    data = detail["strategy"]["data"]
    data["body"]["target_weight_kg"] = 63
    data["body"]["goal_mode"] = "gain"
    data["body"]["activity_level"] = "Moderate"
    data["macros"]["days"][0]["calories"] = 2200
    data["macros"]["days"][0]["ratio"] = {"cho": 55, "pro": 15, "fat": 30}
    response = client.patch(f"/api/clients/{client_id}/strategies/{detail['strategy']['id']}", json={"data": data})
    assert response.status_code == 200, response.text
    updated = response.json()
    monday = updated["derived"]["week"][0]
    assert monday["calories"] == 2200
    assert monday["breakdown"]["grams"] == {"cho": 302, "pro": 82, "fat": 73}
    assert updated["derived"]["calories"]["calories"] == 2200


def test_publish_is_blocked_when_strict_signoff_is_enabled(tmp_path, monkeypatch):
    monkeypatch.setenv("NUTRIALIMENT_REQUIRE_SIGNOFF", "1")
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_strategy(client, client_id)
    strategy_id = detail["strategy"]["id"]

    blocked = client.post(
        f"/api/clients/{client_id}/strategies/{strategy_id}/publish",
        json={"attestation": True},
    )
    assert blocked.status_code == 409
    body = blocked.json()
    assert body["detail"]["message"] == "Strategy is not ready to publish"
    labels = [item["id"] for item in body["detail"]["blockers"]]
    assert "clinical_review" in labels

    data = _ready_payload(detail)
    patched = client.patch(f"/api/clients/{client_id}/strategies/{strategy_id}", json={"data": data})
    assert patched.status_code == 200

    no_attestation = client.post(
        f"/api/clients/{client_id}/strategies/{strategy_id}/publish",
        json={"attestation": False},
    )
    assert no_attestation.status_code == 409

    published = client.post(
        f"/api/clients/{client_id}/strategies/{strategy_id}/publish",
        json={"attestation": True, "note": "Reviewed with Dr. Shah."},
    )
    assert published.status_code == 200, published.text
    record = published.json()["strategy"]
    assert record["status"] == "published"
    assert record["version"] == 1
    assert record["published_at"]


def test_published_strategy_is_locked_and_revision_becomes_next_version(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_strategy(client, client_id)
    strategy_id = detail["strategy"]["id"]
    data = _ready_payload(detail)
    assert client.patch(f"/api/clients/{client_id}/strategies/{strategy_id}", json={"data": data}).status_code == 200
    assert client.post(
        f"/api/clients/{client_id}/strategies/{strategy_id}/publish",
        json={"attestation": True},
    ).status_code == 200

    locked = client.patch(f"/api/clients/{client_id}/strategies/{strategy_id}", json={"data": data})
    assert locked.status_code == 409
    assert "revision" in locked.json()["detail"].lower()

    revision = client.post(f"/api/clients/{client_id}/strategies/{strategy_id}/revisions")
    assert revision.status_code == 200
    revised = revision.json()["strategy"]
    assert revised["status"] == "draft"
    assert revised["version"] == 1
    assert revised["id"] != strategy_id
    revised_data = revised["data"]
    assert revised_data["meta"]["name"].endswith("· Revision")
    assert revised_data["governance"]["reviewed_clinical"] is False
    revised_data["governance"]["reviewed_clinical"] = True
    revised_data["governance"]["acknowledged_interactions"] = True
    assert client.patch(
        f"/api/clients/{client_id}/strategies/{revised['id']}",
        json={"data": revised_data},
    ).status_code == 200
    published = client.post(
        f"/api/clients/{client_id}/strategies/{revised['id']}/publish",
        json={"attestation": True},
    )
    assert published.status_code == 200
    assert published.json()["strategy"]["version"] == 2

    listed = client.get(f"/api/clients/{client_id}/strategies").json()["strategies"]
    statuses = {item["id"]: item["status"] for item in listed}
    assert statuses[strategy_id] == "archived"
    assert statuses[revised["id"]] == "published"

    versions = client.get(f"/api/clients/{client_id}/strategies/{revised['id']}/versions").json()["versions"]
    assert [item["version"] for item in versions] == [2]


def test_missing_consent_blocks_publish(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client, consent=False)
    detail = _create_strategy(client, client_id)
    strategy_id = detail["strategy"]["id"]
    data = _ready_payload(detail)
    client.patch(f"/api/clients/{client_id}/strategies/{strategy_id}", json={"data": data})
    blocked = client.post(
        f"/api/clients/{client_id}/strategies/{strategy_id}/publish",
        json={"attestation": True},
    )
    assert blocked.status_code == 409
    ids = [item["id"] for item in blocked.json()["detail"]["blockers"]]
    assert "consent" in ids


def test_refresh_pulls_latest_clinical_record_without_touching_published(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_strategy(client, client_id)
    strategy_id = detail["strategy"]["id"]

    fetched = client.get(f"/api/clients/{client_id}").json()
    data = fetched["data"]
    data["medical"]["conditions"].append({"disease": "PCOS"})
    client.patch(f"/api/clients/{client_id}", json={"data": data})

    refreshed = client.post(
        f"/api/clients/{client_id}/strategies/{strategy_id}/refresh",
        json={"scope": "clinical"},
    )
    assert refreshed.status_code == 200
    assert "PCOS" in refreshed.json()["strategy"]["data"]["clinical"]["conditions"]


def test_publish_is_optional_by_default_without_signoff_or_attestation(tmp_path, monkeypatch):
    monkeypatch.delenv("NUTRIALIMENT_REQUIRE_SIGNOFF", raising=False)
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_strategy(client, client_id)
    strategy_id = detail["strategy"]["id"]
    data = detail["strategy"]["data"]
    data["governance"]["reviewed_clinical"] = False
    data["governance"]["acknowledged_interactions"] = True
    data["meta"]["delivery_at"] = "2026-12-20T10:00"
    patched = client.patch(f"/api/clients/{client_id}/strategies/{strategy_id}", json={"data": data})
    assert patched.status_code == 200
    published = client.post(
        f"/api/clients/{client_id}/strategies/{strategy_id}/publish",
        json={"attestation": False},
    )
    assert published.status_code == 200, published.text
    assert published.json()["strategy"]["status"] == "published"
    assert published.json()["strategy"]["version"] == 1
