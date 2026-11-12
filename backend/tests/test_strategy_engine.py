from __future__ import annotations

from app.strategy_engine import (
    bmi_for,
    bmr_for,
    build_derived,
    build_readiness,
    calorie_plan,
    default_ratio,
    ideal_weight,
    macro_breakdown,
    medication_interactions,
    protein_range,
    rda_lookup,
)


def _body(**overrides):
    data = {
        "meta": {"name": "Test", "diet_type": "Vegetarian", "patient_type": "General", "major_goal": "Weight maintenance", "delivery_at": "2026-12-01T10:00"},
        "clinical": {"goals": ["Weight maintenance"]},
        "body": {
            "height_cm": 160,
            "weight_kg": 60,
            "body_fat_pct": 30,
            "age": 35,
            "sex": "Female",
            "life_stage": "Not pregnant",
            "activity_level": "Sedentary",
            "goal_mode": "maintenance",
            "calorie_method": "thumb",
            "target_weight_kg": 60,
            "protein_target": "1.0-1.2",
            "ideal_weight_method": "devine",
        },
        "macros": {"days": []},
        "food": {"superfoods": []},
        "supplements": [],
        "medications": {"current": []},
        "governance": {},
    }
    data["body"].update(overrides)
    return data


def test_bmi_uses_metres_squared():
    assert bmi_for(55, 147) == 25.5
    assert bmi_for(0, 147) == 0


def test_katch_bmr_matches_reference_formula():
    bmr = bmr_for(_body(body_fat_pct=29.8, weight_kg=55, height_cm=147))
    assert bmr["source"] == "katch"
    assert bmr["fat_free_mass_kg"] == 38.6
    assert bmr["value"] == 1204.0


def test_mifflin_fallback_without_body_fat():
    data = _body(body_fat_pct=0, weight_kg=70, height_cm=170, age=30, sex="Male")
    bmr = bmr_for(data)
    assert bmr["source"] == "mifflin"
    assert bmr["value"] == 1617.5


def test_ideal_weight_methods():
    assert ideal_weight(147, "Female", "devine")["value"] == 45.5
    assert ideal_weight(147, "Female", "bmi22")["value"] == 47.5
    assert ideal_weight(0, "Female", "devine")["value"] == 0


def test_thumb_rule_rounds_like_reference_screen():
    data = _body(weight_kg=63, target_weight_kg=63, goal_mode="gain", activity_level="Sedentary", workout_extra_kcal=100)
    plan = calorie_plan(data, {"value": 0}, 0, None)
    assert plan["calories"] == 2000
    assert "1,890" in plan["note"]
    assert plan["basis"]["factor"] == 30


def test_rounding_is_half_up_not_bankers():
    data = _body(weight_kg=50, target_weight_kg=50, goal_mode="maintenance", activity_level="Sedentary")
    plan = calorie_plan(data, {"value": 0}, 0, None)
    assert plan["calories"] == 1300


def test_thumb_rule_rounds_970_to_1000():
    data = _body(weight_kg=55, target_weight_kg=48.5, goal_mode="loss", activity_level="Sedentary", workout_extra_kcal=0)
    plan = calorie_plan(data, {"value": 0}, 0, None)
    assert plan["calories"] == 1000
    assert plan["below_floor"] is True


def test_macro_split_matches_1000_kcal_reference_row():
    breakdown = macro_breakdown(1000, {"cho": 55, "pro": 19, "fat": 26})
    assert breakdown["kcal"] == {"cho": 550.0, "pro": 190.0, "fat": 260.0}
    assert breakdown["grams"] == {"cho": 137, "pro": 47, "fat": 28}


def test_macro_split_matches_2000_kcal_reference_row():
    breakdown = macro_breakdown(2000, {"cho": 55, "pro": 15, "fat": 30})
    assert breakdown["kcal"] == {"cho": 1100.0, "pro": 300.0, "fat": 600.0}
    assert breakdown["grams"] == {"cho": 275, "pro": 75, "fat": 66}


def test_rda_practice_chart_lookup():
    women = rda_lookup(64, "Female", "Sedentary")
    assert women is not None
    assert women["energy_kcal"] == 1900
    assert women["protein_g"] == 55
    child = rda_lookup(8, "Male", "Sedentary")
    assert child is not None
    assert child["energy_kcal"] == 1690
    assert child["protein_g"] == 29.5
    pregnancy = rda_lookup(30, "Female", "Sedentary", "Pregnant")
    assert pregnancy is not None
    assert pregnancy["energy_kcal"] == 2250
    assert pregnancy["protein_g"] == 78
    infant = rda_lookup(0, "Female", "Sedentary", "Not pregnant", 6)
    assert infant is not None
    assert infant["energy_kcal"] == 552


def test_protein_range_is_per_target_weight():
    target = protein_range("1.2-1.4", 63)
    assert target["min_g"] == 75.6
    assert target["max_g"] == 88.2
    assert target["mid_g"] == 81.9


def test_default_ratio_hits_protein_target_midpoint():
    ratio = default_ratio(2000, 63, "1.2-1.4", "gain")
    assert sum(ratio.values()) == 100
    breakdown = macro_breakdown(2000, ratio)
    assert 75 <= breakdown["grams"]["pro"] <= 82
    assert ratio["fat"] == 30


def test_low_calorie_and_macro_warnings_surface_in_derived():
    data = _body(weight_kg=55, target_weight_kg=48.5, goal_mode="loss", body_fat_pct=30)
    derived = build_derived(data, {"allergies": [], "diet": "Vegetarian"}, {"consent": True})
    ids = {item["id"] for item in derived["warnings"]}
    assert "low_calorie" in ids
    assert derived["calories"]["calories"] == 1000
    assert derived["readiness"]["can_publish"] is False


def test_medication_interaction_rules():
    data = _body()
    data["medications"]["current"] = [
        {"name": "Tab Thyronorm 50"},
        {"name": "Tab Shelcal 500"},
        {"name": "Tab Metformin 500"},
    ]
    interactions = medication_interactions(data)
    labels = {item["label"] for item in interactions}
    assert "Thyroid medication timing" in labels
    assert "Calcium absorption conflicts" in labels
    assert "Metformin and vitamin B12" in labels
    assert interactions[0]["severity"] in {"high", "moderate"}


def test_food_conflict_flags_allergen_and_vegan_mismatch():
    data = _body()
    data["food"]["superfoods"] = [{"name": "Almonds"}, {"name": "Paneer"}]
    derived = build_derived(data, {"allergies": ["Nuts"], "diet": "Vegan"}, {"consent": True})
    messages = " ".join(item["message"] for item in derived["conflicts"])
    assert "Nuts" in messages
    assert "Vegan" in messages


def test_readiness_blocks_without_consent_and_review():
    data = _body()
    readiness = build_readiness(
        data,
        {},
        {"consent": False},
        {"week": [], "warnings": [], "calories": 0},
    )
    assert readiness["can_publish"] is False
    ids = {item["id"] for item in readiness["blockers"]}
    assert "consent" in ids
    assert "clinical_review" in ids


def test_low_calorie_plan_requires_explicit_acknowledgement():
    data = _body(weight_kg=55, target_weight_kg=48.5, goal_mode="loss", activity_level="Sedentary", protein_target="1.0-1.2")
    data["macros"]["days"] = [
        {
            "day": day,
            "formula": "thumb",
            "calories": 1000,
            "protein_target": "1.0-1.2",
            "ratio": {"cho": 55, "pro": 20, "fat": 25},
            "note": "reference low-calorie day",
            "active": True,
        }
        for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    ]
    context = {"allergies": [], "diet": "Vegetarian"}
    client = {"consent": True}
    derived = build_derived(data, context, client)
    warning = next(item for item in derived["warnings"] if item["id"] == "low_calorie")
    assert warning["ack_key"] == "acknowledged_low_calorie"
    blocker_ids = {item["id"] for item in derived["readiness"]["blockers"]}
    assert "low_calorie" in blocker_ids

    data["governance"]["reviewed_clinical"] = True
    data["governance"]["acknowledged_low_calorie"] = True
    acknowledged = build_derived(data, context, client)
    assert "low_calorie" not in {item["id"] for item in acknowledged["readiness"]["blockers"]}
