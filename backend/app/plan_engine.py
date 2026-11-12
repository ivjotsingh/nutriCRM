"""Plan data model: defaults, normalisation, totals, guardrails and publish gates."""

from __future__ import annotations

import datetime as dt
import re
import uuid
from typing import Any

from . import plan_reference as reference
from .strategy_engine import client_context

DAY_NAMES = reference.DAY_NAMES
DIET_TAG_CONFLICTS = {
    "vegetarian": {"meat", "fish", "egg"},
    "eggetarian": {"meat", "fish"},
    "vegan": {"meat", "fish", "egg", "dairy"},
    "jain": {"meat", "fish", "egg"},
    "non_vegetarian": set(),
    "non vegetarian": set(),
    "": set(),
}


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _int(value: Any, default: int = 0) -> int:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return default


def _text(value: Any) -> str:
    return str(value or "").strip()


def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def today() -> dt.date:
    return dt.date.today()


def _date(value: Any) -> dt.date | None:
    try:
        return dt.date.fromisoformat(_text(value)[:10])
    except ValueError:
        return None


def _ratio_from_label(label: str) -> dict[str, float] | None:
    numbers = [float(v) for v in re.findall(r"\d+(?:\.\d+)?", _text(label))]
    if not numbers:
        return None
    low = numbers[0]
    high = numbers[1] if len(numbers) > 1 else low
    return {"low": low, "high": high, "mid": (low + high) / 2}


def targets_from_strategy(strategy: dict[str, Any] | None) -> dict[str, Any]:
    """Pull energy and macro guardrails from a published/derived strategy."""
    if not strategy:
        return {}
    derived = strategy.get("derived") or strategy
    calories = _num((derived.get("calories") or {}).get("calories"))
    week = derived.get("week") or []
    first = week[0] if week else {}
    ratio = first.get("ratio") or {}
    if not calories or not ratio:
        return {}
    cho = _num(ratio.get("cho"), 50)
    pro = _num(ratio.get("pro"), 20)
    fat = _num(ratio.get("fat"), 30)
    protein = derived.get("protein") or {}
    return {
        "calories": _int(calories),
        "protein_g": _int(protein.get("mid_g") or (calories * pro / 100 / 4)),
        "carbs_g": _int(calories * cho / 100 / 4),
        "fat_g": _int(calories * fat / 100 / 9),
        "ratio": {"cho": _int(cho), "pro": _int(pro), "fat": _int(fat)},
        "protein_range": _text(protein.get("range")) or _text(first.get("protein_target")),
        "source": "strategy",
        "note": _text((derived.get("calories") or {}).get("note")),
    }


def blank_day(name: str, index: int, start: dt.date | None) -> dict[str, Any]:
    date = (start + dt.timedelta(days=index)).isoformat() if start else ""
    return {
        "day": name,
        "date": date,
        "active": True,
        "fast_day": False,
        "notes": "",
        "slots": [],
    }


def blank_plan(bundle: dict[str, Any], strategy: dict[str, Any] | None = None) -> dict[str, Any]:
    client = bundle.get("client") or {}
    data = bundle.get("data") or {}
    basic = data.get("basic") or {}
    medical = data.get("medical") or {}
    dietary = data.get("dietary") or {}
    context = client_context(bundle)
    start = _date(client.get("start_date")) or today()
    targets = targets_from_strategy(strategy)
    if not targets:
        targets = {
            "calories": 0,
            "protein_g": 0,
            "carbs_g": 0,
            "fat_g": 0,
            "ratio": {"cho": 50, "pro": 20, "fat": 30},
            "protein_range": "",
            "source": "manual",
            "note": "",
        }
    return {
        "meta": {
            "title": f"{client.get('name') or 'Diet plan'} · {start.strftime('%b %Y')}",
            "start_date": start.isoformat(),
            "duration_days": _int(_num((data.get("basic") or {}).get("duration_days")), 0) or 30,
            "description": "",
            "diet_type": _text(context.get("diet")) or _text(basic.get("diet_type")) or "Vegetarian",
            "strategy_id": (strategy or {}).get("strategy", {}).get("id", "") if strategy else "",
            "strategy_name": (strategy or {}).get("strategy", {}).get("name", "") if strategy else "",
            "template_id": "",
            "prepared_by": "Local practitioner",
            "approved_label": "Plan Approved",
        },
        "brand": dict(reference.DEFAULT_BRAND),
        "targets": targets,
        "days": [blank_day(name, index, start) for index, name in enumerate(DAY_NAMES)],
        "extras": {
            "superfoods": [],
            "measurements": True,
            "guidelines": [item["id"] for item in reference.GUIDELINES],
            "disclaimer": True,
            "show_targets": True,
            "custom_notes": [],
        },
        "governance": {
            "reviewed_targets": False,
            "acknowledged_restrictions": False,
            "acknowledged_variance": False,
        },
        "clinical": {
            "conditions": context.get("conditions", []),
            "allergies": context.get("allergies", []),
            "intolerances": context.get("intolerances", []),
            "restrictions": context.get("restrictions", []),
            "weight_kg": _num((data.get("bca") or {}).get("weight_kg")),
            "height_cm": _num((data.get("bca") or {}).get("height_cm")),
            "goal": _text((medical.get("primary_goal")) or ""),
        },
    }


def apply_template(plan: dict[str, Any], template: dict[str, Any]) -> dict[str, Any]:
    days_by_name = {day["day"]: day for day in plan["days"]}
    for template_day in template.get("days", []):
        target = days_by_name.get(template_day["day"])
        if target is None:
            continue
        slots = []
        for slot in template_day.get("slots", []):
            meals = []
            for meal in slot.get("meals", []):
                catalogue = reference.find_dish(meal.get("name", ""))
                meals.append(build_meal(meal, catalogue))
            slots.append(
                {
                    "id": new_id("slot"),
                    "name": slot.get("name", ""),
                    "time": slot.get("time", ""),
                    "note": slot.get("note", ""),
                    "meals": meals,
                }
            )
        target["slots"] = slots
    plan["meta"]["template_id"] = template.get("id", "")
    return plan


def build_meal(payload: dict[str, Any], catalogue: dict[str, Any] | None) -> dict[str, Any]:
    """Create a meal row, resolving portions against the food catalogue."""
    qty = _num(payload.get("qty"), 1.0) or 1.0
    unit = _text(payload.get("unit")) or (catalogue or {}).get("unit") or "Serving"
    name = _text(payload.get("name")) or (catalogue or {}).get("name") or "New item"
    grams_per_unit = _num(payload.get("grams_per_unit"))
    kcal_per_unit = _num(payload.get("kcal_per_unit"))
    protein = _num(payload.get("protein_per_unit"))
    carbs = _num(payload.get("carbs_per_unit"))
    fat = _num(payload.get("fat_per_unit"))
    if catalogue:
        base_unit = catalogue.get("unit") or unit
        base_grams = _num(catalogue.get("grams"), 30.0) or 30.0
        base_kcal = _num(catalogue.get("kcal"))
        if not kcal_per_unit:
            factor = reference.unit_grams(unit) / reference.unit_grams(base_unit) if base_unit != unit else 1.0
            grams_per_unit = base_grams * factor
            kcal_per_unit = base_kcal * factor
            protein = _num(catalogue.get("protein")) * factor
            carbs = _num(catalogue.get("carbs")) * factor
            fat = _num(catalogue.get("fat")) * factor
    explicit_calories = _num(payload.get("calories"))
    if explicit_calories > 0:
        target_per_unit = explicit_calories / qty
        if kcal_per_unit > 0:
            factor = target_per_unit / kcal_per_unit
            protein *= factor
            carbs *= factor
            fat *= factor
        kcal_per_unit = target_per_unit
    elif not kcal_per_unit:
        kcal_per_unit = 0.0
    if not grams_per_unit:
        grams_per_unit = reference.unit_grams(unit)
    alternatives = []
    for alt in payload.get("alternatives", []) or []:
        alternatives.append(
            {
                "id": alt.get("id") or new_id("alt"),
                "name": _text(alt.get("name")),
                "portion": _text(alt.get("portion")),
                "calories": round(_num(alt.get("calories")), 2),
            }
        )
    return {
        "id": payload.get("id") or new_id("meal"),
        "food_id": payload.get("food_id") or (catalogue or {}).get("id", ""),
        "name": name,
        "qty": round(qty, 2),
        "unit": unit,
        "portion": _text(payload.get("portion")) or _portion_text(qty, unit),
        "grams_per_unit": round(grams_per_unit, 2),
        "kcal_per_unit": round(kcal_per_unit, 4),
        "protein_per_unit": round(protein, 4),
        "carbs_per_unit": round(carbs, 4),
        "fat_per_unit": round(fat, 4),
        "calories": round(qty * kcal_per_unit, 2),
        "protein": round(qty * protein, 2),
        "carbs": round(qty * carbs, 2),
        "fat": round(qty * fat, 2),
        "note": _text(payload.get("note")),
        "recipe": _text(payload.get("recipe")),
        "alternatives": alternatives,
    }


def _format_time(value: Any) -> str:
    text = _text(value).upper().replace(" ", "")
    match = re.match(r"^(\d{1,2}):(\d{2})(AM|PM)?$", text)
    if not match:
        return _text(value)
    hour, minute, meridiem = match.groups()
    return f"{int(hour):02d}:{minute}{f' {meridiem}' if meridiem else ''}"


def _portion_text(qty: float, unit: str) -> str:
    amount = f"{qty:g}" if qty != int(qty) else str(int(qty))
    return f"{amount} {unit}".strip()


def normalize(plan: dict[str, Any]) -> dict[str, Any]:
    """Repair structure and recompute every derived value (calories, portions)."""
    plan.setdefault("meta", {})
    plan.setdefault("brand", dict(reference.DEFAULT_BRAND))
    plan.setdefault("targets", {})
    plan.setdefault("extras", {})
    plan.setdefault("governance", {})
    plan.setdefault("clinical", {})

    meta = plan["meta"]
    start = _date(meta.get("start_date"))
    duration = max(1, _int(_num(meta.get("duration_days")), 7))
    meta["duration_days"] = duration
    meta["start_date"] = start.isoformat() if start else ""
    meta["end_date"] = (start + dt.timedelta(days=duration - 1)).isoformat() if start else ""
    meta["title"] = _text(meta.get("title")) or "Diet plan"
    meta["diet_type"] = _text(meta.get("diet_type")) or "Vegetarian"

    brand = plan["brand"]
    for key, value in reference.DEFAULT_BRAND.items():
        brand.setdefault(key, value)

    targets = plan["targets"]
    targets["calories"] = _int(_num(targets.get("calories")))
    targets["protein_g"] = _int(_num(targets.get("protein_g")))
    targets["carbs_g"] = _int(_num(targets.get("carbs_g")))
    targets["fat_g"] = _int(_num(targets.get("fat_g")))
    ratio = targets.get("ratio") or {}
    targets["ratio"] = {
        "cho": _int(_num(ratio.get("cho"), 50)),
        "pro": _int(_num(ratio.get("pro"), 20)),
        "fat": _int(_num(ratio.get("fat"), 30)),
    }
    targets["source"] = _text(targets.get("source")) or "manual"

    days = plan.get("days") or []
    by_name = {str(day.get("day")): day for day in days if isinstance(day, dict)}
    normalized_days = []
    for index, name in enumerate(DAY_NAMES):
        day = by_name.get(name) or blank_day(name, index, start)
        day["day"] = name
        day["active"] = bool(day.get("active", True))
        day["fast_day"] = bool(day.get("fast_day", False))
        day["date"] = day.get("date") or ((start + dt.timedelta(days=index)).isoformat() if start else "")
        day["notes"] = _text(day.get("notes"))
        slots = []
        for slot in day.get("slots") or []:
            if not isinstance(slot, dict):
                continue
            meals = []
            for meal in slot.get("meals") or []:
                if not isinstance(meal, dict):
                    continue
                meals.append(normalize_meal(meal))
            slots.append(
                {
                    "id": slot.get("id") or new_id("slot"),
                    "name": _text(slot.get("name")) or "Meal",
                    "time": _format_time(slot.get("time")),
                    "note": _text(slot.get("note")),
                    "meals": meals,
                }
            )
        day["slots"] = slots
        normalized_days.append(day)
    plan["days"] = normalized_days

    extras = plan["extras"]
    valid_superfoods = {item["id"] for item in reference.SUPERFOODS}
    extras["superfoods"] = [item for item in (extras.get("superfoods") or []) if item in valid_superfoods]
    extras["guidelines"] = [item for item in (extras.get("guidelines") or []) if item in {g["id"] for g in reference.GUIDELINES}]
    extras["measurements"] = bool(extras.get("measurements", True))
    extras["disclaimer"] = bool(extras.get("disclaimer", True))
    extras["show_targets"] = bool(extras.get("show_targets", True))
    extras["custom_notes"] = [
        {"id": note.get("id") or new_id("note"), "heading": _text(note.get("heading")), "body": _text(note.get("body"))}
        for note in (extras.get("custom_notes") or [])
        if isinstance(note, dict) and (_text(note.get("heading")) or _text(note.get("body")))
    ]
    return plan


def normalize_meal(meal: dict[str, Any]) -> dict[str, Any]:
    qty = _num(meal.get("qty"), 1.0) or 1.0
    unit = _text(meal.get("unit")) or "Serving"
    kcal_per_unit = _num(meal.get("kcal_per_unit"))
    if not kcal_per_unit and _num(meal.get("calories")):
        kcal_per_unit = _num(meal["calories"]) / qty
    grams_per_unit = _num(meal.get("grams_per_unit")) or reference.unit_grams(unit)
    return {
        "id": meal.get("id") or new_id("meal"),
        "food_id": _text(meal.get("food_id")),
        "name": _text(meal.get("name")) or "New item",
        "qty": round(qty, 2),
        "unit": unit,
        "portion": _text(meal.get("portion")) or _portion_text(qty, unit),
        "grams_per_unit": round(grams_per_unit, 2),
        "kcal_per_unit": round(kcal_per_unit, 4),
        "protein_per_unit": round(_num(meal.get("protein_per_unit")), 4),
        "carbs_per_unit": round(_num(meal.get("carbs_per_unit")), 4),
        "fat_per_unit": round(_num(meal.get("fat_per_unit")), 4),
        "calories": round(qty * kcal_per_unit, 2),
        "protein": round(qty * _num(meal.get("protein_per_unit")), 2),
        "carbs": round(qty * _num(meal.get("carbs_per_unit")), 2),
        "fat": round(qty * _num(meal.get("fat_per_unit")), 2),
        "note": _text(meal.get("note")),
        "recipe": _text(meal.get("recipe")),
        "alternatives": [
            {
                "id": alt.get("id") or new_id("alt"),
                "name": _text(alt.get("name")),
                "portion": _text(alt.get("portion")),
                "calories": round(_num(alt.get("calories")), 2),
            }
            for alt in (meal.get("alternatives") or [])
            if isinstance(alt, dict)
        ],
    }


def day_totals(day: dict[str, Any]) -> dict[str, Any]:
    meals = [meal for slot in day.get("slots") or [] for meal in slot.get("meals") or []]
    return {
        "calories": round(sum(_num(meal.get("calories")) for meal in meals), 1),
        "protein": round(sum(_num(meal.get("protein")) for meal in meals), 1),
        "carbs": round(sum(_num(meal.get("carbs")) for meal in meals), 1),
        "fat": round(sum(_num(meal.get("fat")) for meal in meals), 1),
        "meals": len(meals),
        "slots": len(day.get("slots") or []),
    }


def _target_for(day: dict[str, Any], plan_targets: dict[str, Any]) -> dict[str, Any]:
    override = day.get("targets") if isinstance(day.get("targets"), dict) else None
    return override or plan_targets


def conflicts(plan: dict[str, Any], context: dict[str, Any]) -> list[dict[str, Any]]:
    diet = _text(context.get("diet")).casefold().replace("-", "_").replace(" ", "_")
    blocked = DIET_TAG_CONFLICTS.get(diet, set())
    allergies = [a.casefold() for a in context.get("allergies") or [] if _text(a)]
    restrictions = [r.casefold() for r in context.get("restrictions") or [] if _text(r)]
    found = []
    for day in plan["days"]:
        for slot in day["slots"]:
            for meal in slot["meals"]:
                catalogue = reference.dish(meal.get("food_id", "")) or reference.find_dish(meal.get("name", ""))
                tags = set((catalogue or {}).get("diet") or [])
                hit = tags & blocked
                reason = ""
                if hit:
                    labels = {"meat": "meat", "fish": "fish", "egg": "egg", "dairy": "dairy"}
                    reason = f"contains {', '.join(labels.get(tag, tag) for tag in sorted(hit))} — client is {diet.replace('_', ' ')}"
                name_low = _text(meal.get("name")).casefold()
                for allergen in allergies:
                    if allergen and allergen in name_low:
                        reason = reason or f"matches recorded allergy: {allergen}"
                for restriction in restrictions:
                    if restriction and restriction in name_low:
                        reason = reason or f"matches recorded restriction: {restriction}"
                if reason:
                    found.append(
                        {
                            "day": day["day"],
                            "slot": slot.get("name", ""),
                            "meal": meal.get("name", ""),
                            "reason": reason,
                        }
                    )
    return found


def derive(plan: dict[str, Any], bundle: dict[str, Any] | None = None) -> dict[str, Any]:
    """Totals, target comparison, guardrails and publish readiness."""
    bundle = bundle or {}
    context = client_context(bundle) if bundle else {}
    plan_targets = plan.get("targets") or {}
    days = []
    for day in plan["days"]:
        totals = day_totals(day)
        target = _target_for(day, plan_targets)
        target_calories = _num(target.get("calories"))
        diff = round(totals["calories"] - target_calories, 1) if target_calories else 0
        pct = round(totals["calories"] / target_calories * 100, 1) if target_calories else 0
        active = bool(day.get("active"))
        if not active:
            status = "rest"
        elif totals["meals"] == 0:
            status = "empty"
        elif not target_calories:
            status = "no-target"
        elif abs(diff) <= target_calories * 0.1:
            status = "on-target"
        elif abs(diff) <= target_calories * 0.2:
            status = "near"
        else:
            status = "off-target"
        days.append(
            {
                "day": day["day"],
                "date": day.get("date", ""),
                "active": active,
                "fast_day": bool(day.get("fast_day")),
                "notes": day.get("notes", ""),
                **totals,
                "target_calories": _int(target_calories),
                "target_protein": _int(_num(target.get("protein_g"))),
                "diff": diff,
                "pct": pct,
                "status": status,
            }
        )

    active_days = [day for day in days if day["active"]]
    totals = {
        "calories": round(sum(day["calories"] for day in active_days), 1),
        "protein": round(sum(day["protein"] for day in active_days), 1),
        "carbs": round(sum(day["carbs"] for day in active_days), 1),
        "fat": round(sum(day["fat"] for day in active_days), 1),
        "meals": sum(day["meals"] for day in active_days),
        "days": len(active_days),
        "days_with_meals": sum(1 for day in active_days if day["meals"] > 0),
        "avg_calories": round(sum(day["calories"] for day in active_days) / len(active_days)) if active_days else 0,
    }

    conflicts_found = conflicts(plan, context) if bundle else []
    warnings: list[dict[str, Any]] = []
    if conflicts_found:
        warnings.append(
            {
                "id": "restrictions",
                "severity": "high",
                "title": "Diet guardrail conflict",
                "message": f"{len(conflicts_found)} item(s) conflict with the client's diet, allergies or restrictions.",
                "ack_key": "acknowledged_restrictions",
                "section": "plan",
            }
        )
    off = [day for day in active_days if day["status"] == "off-target"]
    if off:
        warnings.append(
            {
                "id": "variance",
                "severity": "caution",
                "title": "Days away from the energy target",
                "message": f"{', '.join(day['day'] for day in off)} differ by more than 20% from the daily target.",
                "ack_key": "acknowledged_variance",
                "section": "plan",
            }
        )
    empty = [day for day in active_days if day["meals"] == 0]
    if empty:
        warnings.append(
            {
                "id": "empty_days",
                "severity": "caution",
                "title": "Days without meals",
                "message": f"{', '.join(day['day'] for day in empty)} have no meals yet.",
                "ack_key": None,
                "section": "plan",
            }
        )

    readiness = build_readiness(plan, days, totals, conflicts_found)
    return {
        "days": days,
        "totals": totals,
        "conflicts": conflicts_found,
        "warnings": warnings,
        "readiness": readiness,
        "context": context,
    }


def build_readiness(
    plan: dict[str, Any],
    days: list[dict[str, Any]],
    totals: dict[str, Any],
    conflicts_found: list[dict[str, Any]],
) -> dict[str, Any]:
    meta = plan.get("meta") or {}
    targets = plan.get("targets") or {}
    governance = plan.get("governance") or {}
    checks: list[dict[str, Any]] = []

    def add(check_id: str, label: str, status: str, detail: str, section: str) -> None:
        checks.append({"id": check_id, "label": label, "status": status, "detail": detail, "section": section})

    title_ok = bool(_text(meta.get("title")))
    date_ok = bool(_date(meta.get("start_date")))
    add(
        "details",
        "Plan details",
        "pass" if title_ok and date_ok else "fail",
        "Title and start date are set." if title_ok and date_ok else "Add a plan title and start date.",
        "details",
    )

    calories = _int(_num(targets.get("calories")))
    protein = _int(_num(targets.get("protein_g")))
    add(
        "targets",
        "Energy and protein targets",
        "pass" if calories and protein else "fail",
        f"{calories:,} kcal · {protein} g protein per day." if calories and protein else "Set the daily energy and protein targets.",
        "targets",
    )

    active = [day for day in days if day["active"]]
    filled = [day for day in active if day["meals"] > 0]
    add(
        "days",
        "Seven-day coverage",
        "pass" if active and len(filled) == len(active) else "fail",
        f"{len(filled)} of {len(active)} active days have meals." if active else "Activate at least one day.",
        "plan",
    )

    missing = 0
    for day in plan["days"]:
        if not day.get("active"):
            continue
        for slot in day.get("slots") or []:
            for meal in slot.get("meals") or []:
                if not _text(meal.get("portion")):
                    missing += 1
    add(
        "portions",
        "Portions and calories",
        "pass" if missing == 0 else "fail",
        "Every meal has a portion and a calorie value." if missing == 0 else f"{missing} meal(s) need a portion.",
        "plan",
    )

    on_target = [day for day in active if day["status"] in {"on-target", "near"}]
    off = [day for day in active if day["status"] == "off-target"]
    if not active:
        status, detail = "fail", "No active days."
    elif off and not governance.get("acknowledged_variance"):
        status, detail = "fail", f"{len(off)} day(s) are more than 20% away from target. Adjust or acknowledge."
    elif off:
        status, detail = "warn", "Variance acknowledged."
    else:
        status, detail = "pass", f"{len(on_target)} of {len(active)} days are within 20% of target."
    add("energy", "Energy within target", status, detail, "plan")

    if conflicts_found and not governance.get("acknowledged_restrictions"):
        status, detail = "fail", f"{len(conflicts_found)} guardrail conflict(s) need review."
    elif conflicts_found:
        status, detail = "warn", "Guardrail conflicts acknowledged."
    else:
        status, detail = "pass", "No diet, allergy or restriction conflicts."
    add("guardrails", "Diet guardrails", status, detail, "plan")

    extras = plan.get("extras") or {}
    extras_ok = bool(extras.get("superfoods")) or bool(extras.get("guidelines"))
    add(
        "library",
        "Guidance library",
        "pass" if extras_ok else "warn",
        "Superfoods or guidelines are included." if extras_ok else "Add superfood notes or general guidelines.",
        "extras",
    )

    blockers = [check for check in checks if check["status"] == "fail"]
    passed = sum(1 for check in checks if check["status"] == "pass")
    score = round(passed / len(checks) * 100)
    return {"score": score, "checks": checks, "blockers": blockers, "ready": not blockers}


def validate_publish(plan: dict[str, Any], derived: dict[str, Any]) -> None:
    blockers = list(derived["readiness"]["blockers"])
    if blockers:
        raise PlanValidationError(blockers, derived["readiness"])


class PlanValidationError(Exception):
    def __init__(self, blockers: list[dict[str, Any]], readiness: dict[str, Any]):
        super().__init__("Plan is not ready to publish")
        self.blockers = blockers
        self.readiness = readiness


def summary(plan: dict[str, Any], derived: dict[str, Any], record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "name": record.get("name") or plan["meta"]["title"],
        "status": record["status"],
        "version": record["version"],
        "title": plan["meta"]["title"],
        "start_date": plan["meta"].get("start_date", ""),
        "duration_days": plan["meta"].get("duration_days", 7),
        "diet_type": plan["meta"].get("diet_type", ""),
        "strategy_name": plan["meta"].get("strategy_name", ""),
        "calories": derived["totals"]["avg_calories"],
        "target_calories": plan["targets"].get("calories", 0),
        "protein": plan["targets"].get("protein_g", 0),
        "days_with_meals": derived["totals"]["days_with_meals"],
        "meals": derived["totals"]["meals"],
        "readiness": derived["readiness"]["score"],
        "updated_at": record["updated_at"],
        "created_at": record["created_at"],
        "published_at": record["published_at"],
    }
