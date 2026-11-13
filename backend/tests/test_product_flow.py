from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("NUTRIALIMENT_DB", str(tmp_path / "test.db"))
    from app import db
    from app import main

    importlib.reload(db)
    importlib.reload(main)
    db.init_db()
    return TestClient(main.app)


def _normal_payload() -> dict:
    return {
        "name": "Aarav Mehta",
        "phone": "9999999999",
        "age": 32,
        "gender": "Male",
        "city": "Mumbai",
        "consent": True,
        "goals": ["weight_loss", "better_energy"],
        "height_cm": 176,
        "weight_kg": 84,
        "target_weight_kg": 76,
        "diet_type": "eggetarian",
        "cuisine_preferences": ["North Indian", "South Indian"],
        "wake_time": "07:00 AM",
        "sleep_time": "11:00 PM",
        "work_schedule": "Desk job",
        "workout_level": "2-3 days / week",
        "cravings": ["sweet", "evening_snacking"],
        "water_intake": "1-2 Litre",
        "eating_out_frequency": "1-2 Times - Week",
        "cooking_help": "Yes - family support",
        "allergies_dislikes": ["paneer"],
        "medical_risks": [],
        "active_medication": False,
        "abnormal_reports": False,
        "optional_note": "",
    }


def test_normal_user_gets_valid_plan_and_can_upgrade(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    response = client.post("/api/intakes", json=_normal_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["result_type"] == "plan"
    assert data["triage"]["eligible_for_ai_plan"] is True
    assert len(data["result"]["days"]) == 7

    for day in data["result"]["days"]:
        assert day["total_calories"] >= data["result"]["calorie_band"]["min"]
        assert all(meal["items"] for meal in day["meals"])

    lead_id = data["lead_id"]
    check_in = client.post(
        f"/api/leads/{lead_id}/check-ins",
        json={
            "day_number": 1,
            "adherence": "mostly",
            "hunger": "okay",
            "energy": "good",
            "digestion": "okay",
            "cravings": "manageable",
            "notes": "Dinner was easy to follow.",
        },
    )
    assert check_in.status_code == 200

    upgrade = client.post(
        f"/api/leads/{lead_id}/upgrade-intent",
        json={"plan_type": "ai_continuation", "contact_preference": "whatsapp", "message": "Interested"},
    )
    assert upgrade.status_code == 200

    detail = client.get(f"/api/leads/{lead_id}")
    assert detail.status_code == 200
    assert len(detail.json()["check_ins"]) == 1
    assert len(detail.json()["upgrade_intents"]) == 1


def test_risk_user_gets_brief_not_plan(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    payload = _normal_payload()
    payload["medical_risks"] = ["diabetes"]
    payload["active_medication"] = True

    response = client.post("/api/intakes", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["result_type"] == "brief"
    assert data["triage"]["eligible_for_ai_plan"] is False
    assert data["result"]["cta"]["plan_type"] == "human_dietician"
    assert "days" not in data["result"]


def test_catalog_exposes_seed_data(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    response = client.get("/api/catalog")
    assert response.status_code == 200
    data = response.json()
    assert len(data["foods"]) >= 50
    assert len(data["case_examples"]) == 3
