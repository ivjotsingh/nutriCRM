from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def _client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("NUTRIALIGN_DB", str(tmp_path / "plans.db"))
    from app import db
    from app import main

    importlib.reload(db)
    importlib.reload(main)
    db.init_db()
    return TestClient(main.app)


def _create_client(client: TestClient, *, diet: str = "Non-vegetarian") -> str:
    response = client.post(
        "/api/clients",
        json={
            "name": "Demo Client",
            "phone": "+91 9000000000",
            "email": "demo@example.com",
            "city": "Mumbai",
            "consent": True,
            "start_date": "2026-11-16",
            "end_date": "2027-05-14",
        },
    )
    assert response.status_code == 200
    client_id = response.json()["client"]["id"]
    data = {
        "basic": {"dob": "2004-02-11", "gender": "Male", "blood_group": "A+", "diet_type": diet},
        "bca": {"height_cm": 180.3, "weight_kg": 80.1, "body_fat_pct": 14.2},
        "dietary": {"food_preference": diet, "allergies": ["None"], "restrictions": ["No beef"]},
        "medical": {"primary_goal": "Maintenance", "activity_level": "Athlete"},
    }
    assert client.patch(f"/api/clients/{client_id}", json={"data": data}).status_code == 200
    return client_id


def _targets(calories: int = 3000) -> dict:
    return {
        "calories": calories,
        "protein_g": 150,
        "carbs_g": 375,
        "fat_g": 100,
        "ratio": {"cho": 50, "pro": 20, "fat": 30},
        "source": "manual",
        "protein_range": "1.6-1.8",
        "note": "test targets",
    }


def _create_plan(client: TestClient, client_id: str, *, template: bool = True) -> dict:
    payload = {"template_id": "sports-tennis-7day"} if template else {"name": "Blank plan"}
    response = client.post(f"/api/clients/{client_id}/plans", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def test_reference_catalogue_and_template_are_complete():
    from app import plan_reference

    dishes = plan_reference.dishes()
    assert len(dishes) > 80
    assert all(dish["grams"] > 0 for dish in dishes)
    assert all(dish["kcal"] >= 0 for dish in dishes)
    # every catalogue macro set reconciles with its calorie value within 1 kcal
    for dish in dishes:
        energy = 4 * dish["protein"] + 4 * dish["carbs"] + 9 * dish["fat"]
        assert abs(energy - dish["kcal"]) <= max(2.5, dish["kcal"] * 0.02), dish["name"]

    templates = plan_reference.templates()
    assert templates
    days = templates[0]["days"]
    assert [day["day"] for day in days] == plan_reference.DAY_NAMES
    assert sum(len(slot["meals"]) for day in days for slot in day["slots"]) > 250
    assert all(slot["time"] for day in days for slot in day["slots"])


def test_create_plan_from_template_matches_reference_calories(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_plan(client, client_id)
    derived = detail["derived"]
    totals = {day["day"]: day for day in derived["days"]}
    # Values come straight from the reference PDF portions.
    assert totals["Monday"]["calories"] == 1806.6
    assert totals["Tuesday"]["calories"] == 3042.6
    assert totals["Monday"]["meals"] == 22
    assert derived["totals"]["days_with_meals"] == 7
    assert derived["totals"]["meals"] > 250
    assert detail["plan"]["status"] == "draft"
    assert detail["plan"]["data"]["meta"]["title"]


def test_plan_targets_follow_the_published_strategy(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    strategy = client.post(f"/api/clients/{client_id}/strategies", json={"name": "Tennis block"}).json()
    strategy_id = strategy["strategy"]["id"]
    data = strategy["strategy"]["data"]
    data["body"].update(
        {
            "height_cm": 180,
            "weight_kg": 80,
            "target_weight_kg": 80,
            "age": 19,
            "sex": "Male",
            "activity_level": "Athlete",
            "protein_target": "1.6-1.8",
            "calorie_method": "thumb",
            "workout_extra_kcal": 300,
        }
    )
    for key in data["governance"]:
        data["governance"][key] = True
    client.patch(f"/api/clients/{client_id}/strategies/{strategy_id}", json={"data": data})
    published = client.post(f"/api/clients/{client_id}/strategies/{strategy_id}/publish", json={"attestation": True, "note": ""})
    assert published.status_code == 200

    detail = _create_plan(client, client_id)
    targets = detail["plan"]["data"]["targets"]
    assert targets["source"] == "strategy"
    assert targets["calories"] > 0
    assert detail["plan"]["data"]["meta"]["strategy_id"] == strategy_id
    assert detail["strategy"]["id"] == strategy_id


def test_publish_gate_requires_targets_and_attestation(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_plan(client, client_id)
    plan_id = detail["plan"]["id"]
    data = detail["plan"]["data"]
    data["targets"] = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "ratio": {"cho": 50, "pro": 20, "fat": 30}, "source": "manual"}

    blocked = client.post(f"/api/clients/{client_id}/plans/{plan_id}/publish", json={"attestation": True, "note": ""})
    assert blocked.status_code == 409
    data["targets"] = _targets()
    data["governance"]["acknowledged_variance"] = True
    client.patch(f"/api/clients/{client_id}/plans/{plan_id}", json={"data": data})

    no_attestation = client.post(f"/api/clients/{client_id}/plans/{plan_id}/publish", json={"attestation": False, "note": ""})
    assert no_attestation.status_code == 409
    assert any(item["id"] == "attestation" for item in no_attestation.json()["detail"]["blockers"])

    published = client.post(f"/api/clients/{client_id}/plans/{plan_id}/publish", json={"attestation": True, "note": "Reviewed"})
    assert published.status_code == 200
    assert published.json()["plan"]["status"] == "published"
    assert published.json()["plan"]["version"] == 1


def test_published_plan_is_locked_and_revision_copies_it(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_plan(client, client_id)
    plan_id = detail["plan"]["id"]
    data = detail["plan"]["data"]
    data["targets"] = _targets()
    data["governance"]["acknowledged_variance"] = True
    client.patch(f"/api/clients/{client_id}/plans/{plan_id}", json={"data": data})
    assert client.post(f"/api/clients/{client_id}/plans/{plan_id}/publish", json={"attestation": True, "note": ""}).status_code == 200

    locked = client.patch(f"/api/clients/{client_id}/plans/{plan_id}", json={"data": data})
    assert locked.status_code == 409
    assert client.delete(f"/api/clients/{client_id}/plans/{plan_id}").status_code == 409

    revision = client.post(f"/api/clients/{client_id}/plans/{plan_id}/revisions")
    assert revision.status_code == 200
    revised = revision.json()
    assert revised["plan"]["status"] == "draft"
    assert revised["plan"]["id"] != plan_id
    assert [(day["day"], day["calories"]) for day in revised["derived"]["days"]] == [
        (day["day"], day["calories"]) for day in detail["derived"]["days"]
    ]
    assert revised["plan"]["data"]["meta"]["revision_of"] == plan_id


def test_vegetarian_guardrail_blocks_non_veg_template(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client, diet="Vegetarian")
    detail = _create_plan(client, client_id)
    assert detail["derived"]["conflicts"]
    reasons = " ".join(item["reason"] for item in detail["derived"]["conflicts"])
    assert "vegetarian" in reasons

    data = detail["plan"]["data"]
    data["targets"] = _targets()
    data["governance"]["acknowledged_variance"] = True
    client.patch(f"/api/clients/{client_id}/plans/{detail['plan']['id']}", json={"data": data})
    blocked = client.post(f"/api/clients/{client_id}/plans/{detail['plan']['id']}/publish", json={"attestation": True, "note": ""})
    assert blocked.status_code == 409
    assert any(item["id"] == "guardrails" for item in blocked.json()["detail"]["blockers"])

    data["governance"]["acknowledged_restrictions"] = True
    client.patch(f"/api/clients/{client_id}/plans/{detail['plan']['id']}", json={"data": data})
    ok = client.post(f"/api/clients/{client_id}/plans/{detail['plan']['id']}/publish", json={"attestation": True, "note": ""})
    assert ok.status_code == 200


def test_manual_meal_and_unit_conversion_recalculate_calories(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_plan(client, client_id, template=False)
    data = detail["plan"]["data"]
    data["targets"] = _targets()
    data["days"][0]["slots"] = [
        {
            "name": "Breakfast",
            "time": "08:00",
            "note": "post workout",
            "meals": [
                {
                    "name": "MANUAL ITEM",
                    "qty": 2,
                    "unit": "Piece",
                    "portion": "2 Piece",
                    "grams_per_unit": 50,
                    "kcal_per_unit": 90,
                    "protein_per_unit": 5,
                    "carbs_per_unit": 10,
                    "fat_per_unit": 3,
                    "note": "test note",
                    "alternatives": [{"name": "ALT ITEM", "portion": "1 Piece", "calories": 45}],
                }
            ],
        }
    ]
    saved = client.patch(f"/api/clients/{client_id}/plans/{detail['plan']['id']}", json={"data": data}).json()
    monday = saved["derived"]["days"][0]
    assert monday["calories"] == 180
    assert monday["protein"] == 10
    meal = saved["plan"]["data"]["days"][0]["slots"][0]["meals"][0]
    assert meal["calories"] == 180
    assert meal["portion"] == "2 Piece"
    assert meal["alternatives"][0]["calories"] == 45


def test_plan_pdf_renders_the_branded_document(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_plan(client, client_id)
    plan_id = detail["plan"]["id"]
    data = detail["plan"]["data"]
    data["targets"] = _targets()
    data["governance"]["acknowledged_variance"] = True
    data["extras"]["superfoods"] = ["banana", "brazil-nuts"]
    data["days"][0]["notes"] = "Keep dinner early."
    client.patch(f"/api/clients/{client_id}/plans/{plan_id}", json={"data": data})
    published = client.post(f"/api/clients/{client_id}/plans/{plan_id}/publish", json={"attestation": True, "note": ""})
    assert published.status_code == 200, published.text

    response = client.get(f"/api/clients/{client_id}/plans/{plan_id}/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" not in response.headers["content-disposition"]
    body = response.content
    assert body[:5] == b"%PDF-"
    assert len(body) > 40_000

    download = client.get(f"/api/clients/{client_id}/plans/{plan_id}/pdf?download=true")
    assert "attachment" in download.headers["content-disposition"]

    import pymupdf

    document = pymupdf.open(stream=body, filetype="pdf")
    assert document.page_count > 20
    cover = document[0].get_text()
    assert "Demo Client" in cover
    assert "Plan Approved" in cover
    assert "3,000" in cover
    day_two = document[1].get_text()
    assert "Monday" in day_two
    assert "Portion" in day_two and "Calories" in day_two
    assert "KALONJI WATER" in day_two
    # the day note from the studio prints with its day
    last_pages = "".join(document[page].get_text() for page in range(1, 4))
    assert "Diet notes" in last_pages


def test_plan_history_and_duplicate(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    client_id = _create_client(client)
    detail = _create_plan(client, client_id)
    listing = client.get(f"/api/clients/{client_id}/plans").json()
    assert len(listing["plans"]) == 1
    assert listing["plans"][0]["meals"] > 250
    assert listing["templates"]

    duplicate = client.post(f"/api/clients/{client_id}/plans/{detail['plan']['id']}/duplicate")
    assert duplicate.status_code == 200
    assert duplicate.json()["plan"]["id"] != detail["plan"]["id"]
    assert len(client.get(f"/api/clients/{client_id}/plans").json()["plans"]) == 2

    assert client.delete(f"/api/clients/{client_id}/plans/{duplicate.json()['plan']['id']}").status_code == 204
    assert len(client.get(f"/api/clients/{client_id}/plans").json()["plans"]) == 1


def test_reference_payload_exposes_the_pdf_sections(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    payload = client.get("/api/plan-reference").json()
    assert len(payload["guidelines"]) == 37
    assert len(payload["superfoods"]) >= 10
    assert len(payload["measurement_guide"]) == 7
    assert len(payload["disclaimer"]) == 5
    assert {item["name"] for item in payload["slot_presets"]} >= {"Breakfast", "Dinner", "Bedtime"}
    catalogue = client.get("/api/plan-catalog").json()
    assert len(catalogue["dishes"]) > 80
    assert "Egg White" in {unit["unit"] for unit in catalogue["units"]}
