from __future__ import annotations

from typing import Any

from app.models import IntakePayload, PlanValidationResult
from app.seed import food_catalog, meal_templates, plan_format_examples


def _normalize(value: str) -> str:
    return value.lower().strip().replace(" ", "_").replace("-", "_")


def _allergy_terms(intake: IntakePayload) -> set[str]:
    terms = {_normalize(item) for item in intake.allergies_dislikes}
    mapped: set[str] = set()
    for term in terms:
        if term in {"milk", "paneer", "curd", "dairy", "lactose"}:
            mapped.add("dairy")
        if term in {"egg", "eggs"}:
            mapped.add("egg")
        if term in {"gluten", "wheat"}:
            mapped.add("gluten")
        if term in {"soy", "soya"}:
            mapped.add("soy")
    return terms | mapped


def _is_food_allowed(food: dict[str, Any], intake: IntakePayload) -> bool:
    if food.get("is_supplement"):
        return False

    diet_type = intake.diet_type
    if diet_type not in food.get("diet_compatibility", []):
        return False

    blocked_terms = _allergy_terms(intake)
    food_terms = {_normalize(food["name"]), *food.get("allergens", []), *food.get("avoid_if", [])}
    if blocked_terms & food_terms:
        return False

    name = _normalize(food["name"])
    return not any(term and term in name for term in blocked_terms)


def _catalog_index() -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in food_catalog()}


def _fallback_for_slot(slot: str, intake: IntakePayload, used_ids: set[str]) -> dict[str, Any] | None:
    for food in food_catalog():
        if slot in food["meal_slots"] and _is_food_allowed(food, intake) and food["id"] not in used_ids:
            return food
    for food in food_catalog():
        if slot in food["meal_slots"] and _is_food_allowed(food, intake):
            return food
    return None


def _items_from_ids(ids: list[str], slot: str, intake: IntakePayload) -> list[dict[str, Any]]:
    index = _catalog_index()
    used: set[str] = set()
    items: list[dict[str, Any]] = []

    for food_id in ids:
        food = index.get(food_id)
        if food and _is_food_allowed(food, intake):
            items.append(_render_food(food))
            used.add(food_id)

    if not items:
        fallback = _fallback_for_slot(slot, intake, used)
        if fallback:
            items.append(_render_food(fallback))

    return items


def _render_food(food: dict[str, Any]) -> dict[str, Any]:
    return {
        "food_id": food["id"],
        "name": food["name"],
        "portion": food["portion"],
        "calories": food["calories"],
        "preparation_note": food.get("preparation_note", ""),
    }


def _target_band(intake: IntakePayload) -> dict[str, int]:
    goals = {_normalize(goal) for goal in intake.goals}
    if "sports_performance" in goals or "muscle_gain" in goals or intake.workout_level in {"Athlete training", "5+ days / week"}:
        return {"min": 1550, "max": 2300, "label": "performance"}
    if "weight_loss" in goals or "fat_loss" in goals:
        return {"min": 1100, "max": 1500, "label": "fat_loss"}
    return {"min": 1200, "max": 1700, "label": "balanced"}


def generate_plan(intake: IntakePayload) -> dict[str, Any]:
    templates = meal_templates()
    band = _target_band(intake)
    days: list[dict[str, Any]] = []

    for day_index, day_name in enumerate(templates["days"]):
        meals: list[dict[str, Any]] = []
        for slot in templates["slots"]:
            combo_pool = templates["slot_combos"][slot["key"]]
            combo = combo_pool[day_index % len(combo_pool)]
            items = _items_from_ids(combo, slot["key"], intake)
            meals.append(
                {
                    "slot": slot["label"],
                    "slot_key": slot["key"],
                    "time": slot.get("time_overrides", {}).get(intake.work_schedule, slot["default_time"]),
                    "items": items,
                    "slot_calories": sum(item["calories"] for item in items),
                }
            )

        daily_total = sum(meal["slot_calories"] for meal in meals)
        if daily_total < band["min"]:
            daily_total = _boost_day(meals, intake, band["min"])

        days.append(
            {
                "day": day_name,
                "total_calories": daily_total,
                "meals": meals,
            }
        )

    plan = {
        "title": "Free 7-day nutrition preview",
        "subtitle": "Generated from approved dietician-style templates for low-risk users.",
        "currency": "INR",
        "duration_days": 7,
        "source": {
            "mode": "structured_seed_generation",
            "format_reference": plan_format_examples()["renderer"],
        },
        "profile_snapshot": {
            "name": intake.name,
            "age": intake.age,
            "gender": intake.gender,
            "city": intake.city,
            "goals": intake.goals,
            "diet_type": intake.diet_type,
            "cuisine_preferences": intake.cuisine_preferences,
            "height_cm": intake.height_cm,
            "weight_kg": intake.weight_kg,
            "target_weight_kg": intake.target_weight_kg,
        },
        "calorie_band": band,
        "days": days,
        "safety_note": "This preview is for low-risk nutrition planning only and is not a diagnosis, treatment, or substitute for medical advice.",
        "upgrade_options": [
            {"plan_type": "ai_continuation", "label": "AI continuation", "price": "Rs 9,000 / 3 months"},
            {"plan_type": "human_dietician", "label": "Human dietician", "price": "Rs 18,000 / 3 months"},
        ],
    }
    validation = validate_plan(plan, intake)
    if not validation.valid:
        raise ValueError("; ".join(validation.issues))
    return plan


def _boost_day(meals: list[dict[str, Any]], intake: IntakePayload, minimum: int) -> int:
    index = _catalog_index()
    booster_ids = ["fresh_coconut_water", "soaked_almonds", "jowar_roti", "cooked_brown_rice", "greek_yogurt"]
    current_total = sum(meal["slot_calories"] for meal in meals)
    lunch = next((meal for meal in meals if meal["slot_key"] == "lunch"), meals[-1])

    for food_id in booster_ids:
        food = index.get(food_id)
        if not food or not _is_food_allowed(food, intake):
            continue
        rendered = _render_food(food)
        lunch["items"].append(rendered)
        lunch["slot_calories"] += rendered["calories"]
        current_total += rendered["calories"]
        if current_total >= minimum:
            break
    return current_total


def validate_plan(plan: dict[str, Any], intake: IntakePayload) -> PlanValidationResult:
    issues: list[str] = []
    index = _catalog_index()
    allowed = {food["id"] for food in food_catalog() if _is_food_allowed(food, intake)}
    required_slots = {slot["key"] for slot in meal_templates()["slots"]}
    band = plan["calorie_band"]

    if len(plan.get("days", [])) != 7:
        issues.append("Plan must contain exactly 7 days.")

    for day in plan.get("days", []):
        slots = {meal.get("slot_key") for meal in day.get("meals", [])}
        missing = required_slots - slots
        if missing:
            issues.append(f"{day.get('day', 'Day')} is missing meal slots: {', '.join(sorted(missing))}.")

        total = day.get("total_calories", 0)
        if total < band["min"] or total > band["max"] + 350:
            issues.append(f"{day.get('day', 'Day')} calories are outside the safe preview range.")

        for meal in day.get("meals", []):
            for item in meal.get("items", []):
                food_id = item.get("food_id")
                if food_id not in index:
                    issues.append(f"Unknown food id: {food_id}.")
                elif food_id not in allowed:
                    issues.append(f"Food is not allowed for this intake: {index[food_id]['name']}.")

    return PlanValidationResult(valid=not issues, issues=issues)

