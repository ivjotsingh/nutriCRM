"""Deterministic calculations, prefill, and publish gates for strategies."""

from __future__ import annotations

import datetime as dt
import math
import re
from typing import Any

from .strategy_reference import (
    ACTIVITY_LEVELS,
    ALLERGEN_LABELS,
    CONDITION_RULES,
    DEFAULT_PROTEIN_TARGET,
    DIETS,
    MEDICATION_INTERACTION_RULES,
    PROTEIN_TARGETS,
    RDA_ROWS,
    SUPERFOODS,
    THUMB_FACTORS,
)

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
CALORIE_FLOOR_FEMALE = 1200
CALORIE_FLOOR_MALE = 1500


# --------------------------------------------------------------------------- helpers


def _num(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _int(value: Any, default: int = 0) -> int:
    try:
        return int(round(_num(value, default)))
    except (TypeError, ValueError):
        return default


def _text(value: Any) -> str:
    return str(value or "").strip()


def _list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in re.split(r"[\n,;]+", value) if item.strip()]
    return []


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.casefold()
        if key and key not in seen:
            seen.add(key)
            result.append(value)
    return result


def _round_100(value: float) -> int:
    return int(math.floor(value / 100.0 + 0.5) * 100)


def _round1(value: float) -> float:
    return round(value + 1e-9, 1)


def _sex(value: Any) -> str:
    text = _text(value).casefold()
    if text.startswith("m"):
        return "Male"
    return "Female"


def _goal_mode(value: Any, target: float, current: float) -> str:
    text = _text(value).casefold()
    if text in {"loss", "weight / fat loss", "weight loss", "fat loss"}:
        return "loss"
    if text in {"gain", "weight / muscle gain", "weight gain", "muscle gain"}:
        return "gain"
    if text == "maintenance":
        return "maintenance"
    if target and current:
        if target < current - 0.5:
            return "loss"
        if target > current + 0.5:
            return "gain"
    return "maintenance"


def age_from_dob(dob: Any, today: dt.date | None = None) -> int:
    text = _text(dob)
    if not text:
        return 0
    try:
        born = dt.date.fromisoformat(text[:10])
    except ValueError:
        return 0
    today = today or dt.date.today()
    years = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return max(0, min(years, 120))


def bmi_category(bmi: float) -> str:
    if bmi <= 0:
        return "Not calculated"
    if bmi < 18.5:
        return "Underweight"
    if bmi < 23:
        return "Normal"
    if bmi < 25:
        return "Overweight"
    return "Obese"


def bmi_for(weight: float, height_cm: float) -> float:
    if weight <= 0 or height_cm <= 0:
        return 0.0
    metres = height_cm / 100.0
    return round(weight / (metres * metres), 1)


def ideal_weight(height_cm: float, sex: str, method: str = "devine", manual: Any = None) -> dict[str, Any]:
    if method == "manual" and _num(manual) > 0:
        value = _round1(_num(manual))
        return {"value": value, "method": "manual", "detail": "Manual clinical override."}
    if height_cm <= 0:
        return {"value": 0.0, "method": method, "detail": "Add height to calculate."}
    if method == "bmi22":
        metres = height_cm / 100.0
        return {"value": _round1(22 * metres * metres), "method": "bmi22", "detail": "22 × height (m)²."}
    inches = height_cm / 2.54
    base = 45.5 if sex == "Female" else 50.0
    value = base + max(0.0, inches - 60.0) * 2.3
    return {
        "value": _round1(value),
        "method": "devine",
        "detail": f"{base:g} kg at 5 ft + 2.3 kg per inch above 5 ft.",
    }


def bmr_for(data: dict[str, Any]) -> dict[str, Any]:
    body = data.get("body") or {}
    weight = _num(body.get("weight_kg"))
    height = _num(body.get("height_cm"))
    age = _int(body.get("age"))
    sex = _sex(body.get("sex"))
    body_fat = _num(body.get("body_fat_pct"))
    if weight <= 0 or height <= 0:
        return {"value": 0.0, "source": "measurements_missing", "label": "Add height and weight"}
    if 0 < body_fat < 70:
        fat_free = weight * (1 - body_fat / 100.0)
        value = 370 + 21.6 * fat_free
        return {
            "value": round(value, 1),
            "source": "katch",
            "label": "Katch-McArdle",
            "fat_free_mass_kg": round(fat_free, 1),
        }
    if age <= 0:
        return {"value": 0.0, "source": "age_missing", "label": "Add date of birth for Mifflin-St Jeor"}
    value = 10 * weight + 6.25 * height - 5 * age + (5 if sex == "Male" else -161)
    return {"value": round(value, 1), "source": "mifflin", "label": "Mifflin-St Jeor"}


def activity_factor(level: str) -> float:
    for item in ACTIVITY_LEVELS:
        if item["value"].casefold() == _text(level).casefold():
            return float(item["factor"])
    return 1.2


def thumb_band(level: str) -> str:
    for item in ACTIVITY_LEVELS:
        if item["value"].casefold() == _text(level).casefold():
            return str(item["thumb"])
    return "sedentary"


def rda_activity(level: str) -> str:
    text = _text(level).casefold()
    if text in {"moderate"}:
        return "Moderate"
    if text in {"high", "athlete"}:
        return "Heavy"
    return "Sedentary"


def rda_lookup(
    age: int,
    sex: str,
    activity: str,
    life_stage: str = "Not pregnant",
    weight_kg: float = 0.0,
) -> dict[str, Any] | None:
    """Return the practice RDA row for a person, including per-kg infant scaling."""
    if age < 0:
        return None
    life = _text(life_stage)
    if age >= 18 and sex == "Female" and life not in {"", "Not pregnant"}:
        category = "Lactation < 6 months" if life.startswith("Lactation <") else life
        if life.startswith("Lactation 6"):
            category = "Lactation 6–12 months"
        for row in RDA_ROWS:
            if row.get("group") == "Women" and row.get("category") == category:
                return _rda_row_payload(row, weight_kg, life)
    if age < 18:
        groups = {"Children", "Boys", "Girls"} if age >= 1 else {"Infants"}
        matches = [
            row
            for row in RDA_ROWS
            if row.get("age_min", 99) <= age <= row.get("age_max", -1)
            and row.get("group") in groups
        ]
        if not matches:
            return None
        preferred = [row for row in matches if row.get("sex") in {"Any", sex}]
        row = preferred[0] if preferred else matches[0]
        return _rda_row_payload(row, weight_kg, life)
    group = "Man" if sex == "Male" else "Women"
    band = rda_activity(activity)
    for row in RDA_ROWS:
        if row.get("group") == group and row.get("category") == band:
            return _rda_row_payload(row, weight_kg, life)
    return None


def _rda_row_payload(row: dict[str, Any], weight_kg: float, life: str) -> dict[str, Any]:
    payload = dict(row)
    if row.get("energy_per_kg"):
        used_weight = weight_kg if weight_kg > 0 else _num(row.get("body_weight_kg"))
        payload["effective_weight_kg"] = round(used_weight, 1)
        payload["energy_kcal"] = round(_num(row.get("energy_per_kg")) * used_weight)
        payload["protein_g"] = round(_num(row.get("protein_per_kg")) * used_weight, 1)
    payload["label"] = f"{row.get('group')} · {row.get('category')}"
    if life and life != "Not pregnant" and row.get("group") == "Women":
        payload["label"] += f" · {life}"
    return payload


def protein_range(label: str, basis_weight: float) -> dict[str, Any]:
    text = _text(label) or "1.2-1.4"
    numbers = [float(value) for value in re.findall(r"\d+(?:\.\d+)?", text)]
    low = numbers[0] if numbers else 1.2
    high = numbers[1] if len(numbers) > 1 else low + 0.2
    if basis_weight <= 0:
        return {"range": text, "low": low, "high": high, "min_g": 0, "max_g": 0, "mid_g": 0}
    return {
        "range": text,
        "low": low,
        "high": high,
        "min_g": round(low * basis_weight, 1),
        "max_g": round(high * basis_weight, 1),
        "mid_g": round(((low + high) / 2) * basis_weight, 1),
    }


def default_ratio(calories: float, basis_weight: float, protein_label: str, goal_mode: str) -> dict[str, int]:
    if calories <= 0 or basis_weight <= 0:
        return {"cho": 55, "pro": 20, "fat": 25}
    target = protein_range(protein_label, basis_weight)
    protein_pct = (target["mid_g"] * 4 / calories) * 100 if calories else 20
    protein = max(10, min(40, int(round(protein_pct))))
    fat = 30 if goal_mode == "gain" else 25
    carbs = 100 - protein - fat
    if carbs < 20:
        fat = max(20, fat - (20 - carbs))
        carbs = 20
        protein = 100 - carbs - fat
    if carbs > 72:
        protein = max(10, 100 - fat - 72)
        carbs = 100 - protein - fat
    return {"cho": int(carbs), "pro": int(protein), "fat": int(fat)}


def macro_breakdown(calories: float, ratio: dict[str, Any]) -> dict[str, Any]:
    cho_pct = max(0.0, _num(ratio.get("cho")))
    pro_pct = max(0.0, _num(ratio.get("pro")))
    fat_pct = max(0.0, _num(ratio.get("fat")))
    cho_kcal = calories * cho_pct / 100.0
    pro_kcal = calories * pro_pct / 100.0
    fat_kcal = calories * fat_pct / 100.0
    return {
        "ratio": {"cho": round(cho_pct), "pro": round(pro_pct), "fat": round(fat_pct)},
        "pct_total": round(cho_pct + pro_pct + fat_pct, 1),
        "kcal": {
            "cho": round(cho_kcal, 1),
            "pro": round(pro_kcal, 1),
            "fat": round(fat_kcal, 1),
        },
        "grams": {
            "cho": int(cho_kcal // 4),
            "pro": int(pro_kcal // 4),
            "fat": int(fat_kcal // 9),
        },
    }


def calorie_plan(data: dict[str, Any], bmr: dict[str, Any], tdee: float, rda: dict[str, Any] | None) -> dict[str, Any]:
    body = data.get("body") or {}
    target = _num(body.get("target_weight_kg"))
    current = _num(body.get("weight_kg"))
    goal = _goal_mode(body.get("goal_mode"), target, current)
    activity = _text(body.get("activity_level")) or "Sedentary"
    method = _text(body.get("calorie_method")) or "thumb"
    extra = max(0.0, _num(body.get("workout_extra_kcal")))
    age = _int(body.get("age"))
    sex = _sex(body.get("sex"))
    life = _text(body.get("life_stage")) or "Not pregnant"

    if target <= 0:
        return {
            "method": method,
            "calories": 0,
            "goal_mode": goal,
            "note": "Add a target weight to calculate calories.",
            "basis": {},
        }

    if method == "bmr":
        base = tdee
        if age < 18 or life not in {"", "Not pregnant"}:
            adjustment = 0.0
        else:
            adjustment = {"loss": -0.15, "gain": 0.10, "maintenance": 0.0}.get(goal, 0.0)
        raw = base * (1 + adjustment)
        calories = _round_100(raw)
        note = f"TDEE {tdee:,.0f} kcal × {1 + adjustment:.2f} goal adjustment = {raw:,.0f} kcal → {calories:,} kcal."
        basis = {"method": "bmr", "tdee": round(tdee, 1), "adjustment": adjustment, "raw": round(raw)}
    elif method == "rda":
        base = _num((rda or {}).get("energy_kcal"))
        if base <= 0:
            return {
                "method": "rda",
                "calories": 0,
                "goal_mode": goal,
                "note": "RDA row unavailable. Add age and sex, or choose another formula.",
                "basis": {},
            }
        if age < 18 or life not in {"", "Not pregnant"}:
            adjustment = 0.0
        else:
            adjustment = {"loss": -0.15, "gain": 0.10, "maintenance": 0.0}.get(goal, 0.0)
        raw = base * (1 + adjustment)
        calories = _round_100(raw)
        label = (rda or {}).get("label", "RDA")
        note = f"{label}: {base:,.0f} kcal × {1 + adjustment:.2f} = {raw:,.0f} kcal → {calories:,} kcal."
        basis = {"method": "rda", "rda_energy": base, "adjustment": adjustment, "raw": round(raw)}
    else:
        band = thumb_band(activity)
        factor = THUMB_FACTORS.get(goal, THUMB_FACTORS["maintenance"]).get(band, 25)
        raw = target * factor + extra
        calories = _round_100(raw)
        extra_note = f" + {extra:,.0f} kcal workouts" if extra > 0 else ""
        note = f"{target:g} kg target × {factor} kcal/kg = {target * factor:,.0f} kcal{extra_note} → {calories:,} kcal."
        basis = {
            "method": "thumb",
            "factor": factor,
            "band": band,
            "target_weight_kg": target,
            "workout_extra_kcal": extra,
            "raw": round(raw),
        }

    floor = CALORIE_FLOOR_MALE if sex == "Male" else CALORIE_FLOOR_FEMALE
    return {
        "method": method,
        "calories": calories,
        "goal_mode": goal,
        "note": note,
        "basis": basis,
        "floor": floor,
        "below_floor": calories < floor and age >= 18 and life in {"", "Not pregnant"},
    }


def build_week(data: dict[str, Any], calories: float, goal: dict[str, Any], protein_label: str, basis_weight: float) -> list[dict[str, Any]]:
    macros = data.get("macros") or {}
    rows = macros.get("days") if isinstance(macros.get("days"), list) else []
    if not rows:
        ratio = default_ratio(calories, basis_weight, protein_label, goal["goal_mode"])
        rows = [
            {
                "day": day,
                "formula": goal["method"],
                "calories": calories,
                "protein_target": protein_label,
                "ratio": ratio,
                "note": goal["note"],
                "active": True,
            }
            for day in DAY_NAMES
        ]
    by_day: dict[str, dict[str, Any]] = {}
    for row in rows:
        if isinstance(row, dict) and row.get("day"):
            by_day[str(row["day"])] = row
    result: list[dict[str, Any]] = []
    for index, day in enumerate(DAY_NAMES):
        row = by_day.get(day) or {
            "day": day,
            "formula": goal["method"],
            "calories": calories,
            "protein_target": protein_label,
            "ratio": default_ratio(calories, basis_weight, protein_label, goal["goal_mode"]),
            "note": goal["note"],
            "active": True,
        }
        ratio = row.get("ratio") if isinstance(row.get("ratio"), dict) else {}
        day_calories = _num(row.get("calories"), calories)
        breakdown = macro_breakdown(day_calories, ratio)
        p_range = protein_range(_text(row.get("protein_target")) or protein_label, basis_weight)
        protein_g = breakdown["grams"]["pro"]
        per_kg = round(protein_g / basis_weight, 2) if basis_weight > 0 else 0
        if per_kg and per_kg < p_range["low"]:
            status = "below"
        elif per_kg and per_kg > p_range["high"]:
            status = "above"
        elif per_kg:
            status = "within"
        else:
            status = "unknown"
        complete = day_calories > 0 and abs(breakdown["pct_total"] - 100) < 0.5 and row.get("active", True) is not False
        result.append(
            {
                **row,
                "day": day,
                "day_short": DAY_SHORT[index],
                "calories": int(day_calories),
                "ratio": breakdown["ratio"],
                "breakdown": breakdown,
                "protein_range": p_range,
                "protein_per_kg": per_kg,
                "protein_status": status,
                "complete": complete,
            }
        )
    return result


# --------------------------------------------------------------------------- clinical intelligence


def clinical_flags(data: dict[str, Any]) -> list[dict[str, Any]]:
    body = data.get("body") or {}
    clinical = data.get("clinical") or {}
    flags: list[dict[str, Any]] = []
    seen: set[str] = set()
    for condition in _list(clinical.get("conditions")):
        lowered = condition.casefold()
        for rule in CONDITION_RULES:
            if rule["label"] in seen:
                continue
            if any(keyword in lowered for keyword in rule["keywords"]):
                seen.add(rule["label"])
                flags.append(
                    {
                        "code": rule["label"].casefold().replace(" ", "_"),
                        "label": rule["label"],
                        "severity": rule["severity"],
                        "message": rule["message"],
                        "source": "clinical.conditions",
                    }
                )
                break
    age = _int(body.get("age"))
    life = _text(body.get("life_stage"))
    if age and age < 18 and "Paediatric" not in seen:
        flags.append(
            {
                "code": "paediatric",
                "label": "Paediatric client",
                "severity": "high",
                "message": "No calorie deficit is applied for under-18s. Growth and puberty needs take priority.",
                "source": "body.age",
            }
        )
    if life and life != "Not pregnant":
        flags.append(
            {
                "code": "pregnancy_lactation",
                "label": "Pregnancy / lactation",
                "severity": "high",
                "message": "Use the pregnancy or lactation RDA allowance; no deficit without obstetric review.",
                "source": "body.life_stage",
            }
        )
    current_bmi = bmi_for(_num(body.get("weight_kg")), _num(body.get("height_cm")))
    if current_bmi and current_bmi < 18.5:
        flags.append(
            {
                "code": "underweight",
                "label": "Underweight",
                "severity": "high",
                "message": "A weight-loss target is inappropriate at this BMI without clinical oversight.",
                "source": "body.bmi",
            }
        )
    return flags


def medication_interactions(data: dict[str, Any]) -> list[dict[str, Any]]:
    meds = data.get("medications") or []
    rows = meds.get("current") if isinstance(meds, dict) else None
    rows = rows if isinstance(rows, list) else []
    names = [_text(row.get("name")) for row in rows if isinstance(row, dict)]
    supplements = data.get("supplements") if isinstance(data.get("supplements"), list) else []
    names.extend(
        _text(row.get("name"))
        for row in supplements
        if isinstance(row, dict) and _text(row.get("name"))
    )
    names = _unique(names)
    combined = " | ".join(names).casefold()
    found: list[dict[str, Any]] = []
    seen: set[str] = set()
    for rule in MEDICATION_INTERACTION_RULES:
        if rule["label"] in seen:
            continue
        if any(keyword in combined for keyword in rule["keywords"]):
            seen.add(rule["label"])
            matched = [
                name
                for name in names
                if any(keyword in name.casefold() for keyword in rule["keywords"])
            ]
            found.append(
                {
                    "label": rule["label"],
                    "severity": rule["severity"],
                    "message": rule["message"],
                    "recommendation": rule["recommendation"],
                    "medications": matched,
                }
            )
    order = {"high": 0, "moderate": 1, "low": 2}
    found.sort(key=lambda item: order.get(str(item["severity"]), 3))
    return found


def _client_allergens(context: dict[str, Any]) -> list[str]:
    values = _list(context.get("allergies")) + _list(context.get("intolerances")) + _list(context.get("restrictions"))
    lowered = " | ".join(values).casefold()
    found: list[str] = []
    for key, label in ALLERGEN_LABELS.items():
        if key in lowered or label.casefold() in lowered:
            found.append(key)
    if "nut" in lowered and "nuts" not in found:
        found.append("nuts")
    if "milk" in lowered or "dairy" in lowered or "lactose" in lowered:
        if "dairy" not in found:
            found.append("dairy")
    if "gluten" in lowered and "gluten" not in found:
        found.append("gluten")
    return _unique(found)


def food_conflicts(data: dict[str, Any], context: dict[str, Any]) -> list[dict[str, Any]]:
    food = data.get("food") or {}
    rows = food.get("superfoods") if isinstance(food.get("superfoods"), list) else []
    allergens = _client_allergens(context)
    diet = _text(context.get("diet")) or _text((data.get("meta") or {}).get("diet_type")) or "Vegetarian"
    diet_key = "vegan" if diet.casefold() == "vegan" else "vegetarian" if diet.casefold() in {"vegetarian", "jain"} else ""
    conflicts: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = _text(row.get("name"))
        library = next((item for item in SUPERFOODS if item["name"].casefold() == name.casefold()), None)
        tags = library.get("allergens", []) if library else []
        for allergen in tags:
            if allergen in allergens:
                conflicts.append(
                    {
                        "type": "allergen",
                        "severity": "high",
                        "superfood": name,
                        "message": f"{name} conflicts with the client's {ALLERGEN_LABELS.get(allergen, allergen)} allergy or intolerance.",
                    }
                )
        if library and diet_key and diet_key not in library.get("diet", []):
            conflicts.append(
                {
                    "type": "diet",
                    "severity": "moderate",
                    "superfood": name,
                    "message": f"{name} is not compatible with a {diet} diet.",
                }
            )
    return conflicts


def supplement_totals(data: dict[str, Any], calories: float) -> dict[str, Any]:
    rows = data.get("supplements") if isinstance(data.get("supplements"), list) else []
    totals = {"cal": 0.0, "pro": 0.0, "fat": 0.0, "carb": 0.0, "fibre": 0.0}
    for row in rows:
        if not isinstance(row, dict):
            continue
        qty = _num(row.get("quantity"), 1)
        for key in totals:
            totals[key] += _num(row.get(key)) * qty
    totals = {key: round(value, 1) for key, value in totals.items()}
    totals["share_of_calories"] = round(totals["cal"] / calories * 100, 1) if calories else 0.0
    return totals


# --------------------------------------------------------------------------- derived payload


def build_derived(data: dict[str, Any], context: dict[str, Any] | None = None, client: dict[str, Any] | None = None) -> dict[str, Any]:
    context = context or {}
    client = client or {}
    body = data.get("body") or {}
    meta = data.get("meta") or {}
    weight = _num(body.get("weight_kg"))
    height = _num(body.get("height_cm"))
    bf = _num(body.get("body_fat_pct"))
    age = _int(body.get("age"))
    sex = _sex(body.get("sex"))
    target = _num(body.get("target_weight_kg"))
    goal_mode = _goal_mode(body.get("goal_mode"), target, weight)
    activity = _text(body.get("activity_level")) or "Sedentary"
    factor = activity_factor(activity)
    bmr = bmr_for(data)
    tdee = round(bmr["value"] * factor, 1) if bmr["value"] else 0.0
    rda = rda_lookup(age, sex, activity, _text(body.get("life_stage")) or "Not pregnant", weight) if age > 0 else None
    ideal = ideal_weight(
        height,
        sex,
        _text(body.get("ideal_weight_method")) or "devine",
        body.get("ideal_weight_manual"),
    )
    ideal_value = _num(body.get("ideal_weight_kg")) or ideal["value"]
    calories = calorie_plan(data, bmr, tdee, rda)
    protein_label = _text(body.get("protein_target")) or DEFAULT_PROTEIN_TARGET.get(goal_mode, "1.2-1.4")
    basis_weight = target or ideal_value or weight
    protein = protein_range(protein_label, basis_weight)
    week = build_week(data, calories["calories"], {**calories, "goal_mode": goal_mode}, protein_label, basis_weight)
    totals = {
        "avg_calories": round(sum(day["calories"] for day in week) / 7) if week else 0,
        "min_calories": min((day["calories"] for day in week), default=0),
        "max_calories": max((day["calories"] for day in week), default=0),
        "avg_protein": round(sum(day["breakdown"]["grams"]["pro"] for day in week) / 7) if week else 0,
        "avg_cho": round(sum(day["breakdown"]["grams"]["cho"] for day in week) / 7) if week else 0,
        "avg_fat": round(sum(day["breakdown"]["grams"]["fat"] for day in week) / 7) if week else 0,
        "days_complete": sum(1 for day in week if day["complete"]),
        "within_protein": sum(1 for day in week if day["protein_status"] == "within"),
    }
    macros = data.get("macros") or {}
    interactions = medication_interactions(data)
    conflicts = food_conflicts(data, context)
    flags = clinical_flags(data)
    supplements = supplement_totals(data, calories["calories"])
    target_bmi = bmi_for(target, height) if target and height else 0.0
    current_bmi = bmi_for(weight, height)
    age_for_timeline = age or 30
    weeks_to_target = 0
    if weight and target and weight > target:
        weekly_loss = max(0.3, weight * 0.0075)
        weeks_to_target = max(1, math.ceil((weight - target) / weekly_loss))
    elif weight and target and target > weight:
        weekly_gain = max(0.2, weight * 0.005)
        weeks_to_target = max(1, math.ceil((target - weight) / weekly_gain))

    warnings: list[dict[str, Any]] = []
    calorie_value = calories["calories"]
    floor = CALORIE_FLOOR_MALE if sex == "Male" else CALORIE_FLOOR_FEMALE
    if calorie_value and age >= 18 and (body.get("life_stage") or "Not pregnant") == "Not pregnant":
        if calorie_value < floor:
            severe = "critical" if calorie_value < 1000 else "caution"
            warnings.append(
                {
                    "id": "low_calorie",
                    "severity": severe,
                    "title": "Very low calorie target",
                    "message": f"{calorie_value:,} kcal is below the {floor:,} kcal safety floor for this client. Record the clinical justification.",
                    "ack_key": "acknowledged_low_calorie",
                    "section": "targets",
                }
            )
    under_target_protein = [day for day in week if day["protein_status"] in {"below", "above"}]
    if under_target_protein:
        labels = ", ".join(f"{day['day_short']} {day['protein_per_kg']:g} g/kg" for day in under_target_protein[:4])
        warnings.append(
            {
                "id": "protein_deviation",
                "severity": "caution",
                "title": "Protein outside target on some days",
                "message": f"{labels}{'…' if len(under_target_protein) > 4 else ''}. Adjust the ratio or acknowledge the deviation.",
                "ack_key": "acknowledged_macro_deviation",
                "section": "macros",
            }
        )
    if interactions:
        high = [item for item in interactions if item["severity"] == "high"]
        warnings.append(
            {
                "id": "interactions",
                "severity": "high" if high else "caution",
                "title": "Medication review required",
                "message": f"{len(interactions)} medication or nutrient interaction{'s' if len(interactions) != 1 else ''} detected. Review timing and monitoring.",
                "ack_key": "acknowledged_interactions",
                "section": "support",
            }
        )
    if conflicts:
        warnings.append(
            {
                "id": "food_conflicts",
                "severity": "high",
                "title": "Food guardrail conflict",
                "message": f"{len(conflicts)} superfood selection{'s' if len(conflicts) != 1 else ''} conflict with the client's allergies, intolerances, or diet.",
                "ack_key": "acknowledged_allergies",
                "section": "food",
            }
        )
    if supplements["share_of_calories"] > 15:
        warnings.append(
            {
                "id": "supplement_load",
                "severity": "info",
                "title": "High supplement calorie share",
                "message": f"Supplements contribute {supplements['share_of_calories']}% of daily calories. Check whether food should replace some of them.",
                "ack_key": None,
                "section": "support",
            }
        )
    if target and height and target_bmi < 18.5:
        warnings.append(
            {
                "id": "target_bmi",
                "severity": "high",
                "title": "Target BMI is underweight",
                "message": f"A {target:g} kg target gives BMI {target_bmi:g}. Choose a target at or above BMI 18.5 unless clinically justified.",
                "ack_key": "acknowledged_target_bmi",
                "section": "targets",
            }
        )
    life = _text(body.get("life_stage")) or "Not pregnant"
    if life != "Not pregnant" and (
        goal_mode == "loss" or (rda and calorie_value and calorie_value < _num(rda.get("energy_kcal")) * 0.9)
    ):
        warnings.append(
            {
                "id": "pregnancy_calories",
                "severity": "high",
                "title": "Pregnancy / lactation energy review",
                "message": "No calorie deficit is appropriate during pregnancy or lactation. Use the RDA allowance and record the obstetric review.",
                "ack_key": "acknowledged_pregnancy",
                "section": "targets",
            }
        )
    if age and age < 18 and goal_mode == "loss":
        warnings.append(
            {
                "id": "paediatric_deficit",
                "severity": "high",
                "title": "No deficit for under-18s",
                "message": "Switch the goal to maintenance or growth and record the paediatric review.",
                "ack_key": "acknowledged_paediatric",
                "section": "targets",
            }
        )
    report_date = _text(meta.get("blood_report_at"))[:10]
    if report_date:
        try:
            report_age = (dt.date.today() - dt.date.fromisoformat(report_date)).days
            if report_age > 183:
                warnings.append(
                    {
                        "id": "stale_bloods",
                        "severity": "info",
                        "title": "Blood report is over 6 months old",
                        "message": "Consider a repeat panel before the next phase.",
                        "ack_key": None,
                        "section": "clinical",
                    }
                )
        except ValueError:
            pass
    if totals["days_complete"] and totals["max_calories"] - totals["min_calories"] > 300:
        warnings.append(
            {
                "id": "week_variance",
                "severity": "info",
                "title": "Calories vary across the week",
                "message": f"{totals['min_calories']:,}–{totals['max_calories']:,} kcal. That can be intentional; confirm it is.",
                "ack_key": None,
                "section": "macros",
            }
        )

    readiness = build_readiness(data, context, client, {
        "calories": calorie_value,
        "week": week,
        "totals": totals,
        "interactions": interactions,
        "conflicts": conflicts,
        "flags": flags,
        "protein": protein,
        "target_bmi": target_bmi,
        "goal_mode": goal_mode,
        "age": age,
        "warnings": warnings,
    })

    return {
        "age": age,
        "sex": sex,
        "bmi": current_bmi,
        "bmi_category": bmi_category(current_bmi),
        "target_bmi": target_bmi,
        "target_bmi_category": bmi_category(target_bmi),
        "bmr": bmr,
        "tdee": tdee,
        "activity_factor": factor,
        "rda": rda,
        "ideal_weight": {**ideal, "value": ideal_value},
        "goal_mode": goal_mode,
        "weeks_to_target": weeks_to_target,
        "calories": calories,
        "protein": protein,
        "week": week,
        "totals": totals,
        "interactions": interactions,
        "conflicts": conflicts,
        "flags": flags,
        "supplements": supplements,
        "warnings": warnings,
        "readiness": readiness,
        "age_for_timeline": age_for_timeline,
    }


def build_readiness(
    data: dict[str, Any],
    context: dict[str, Any],
    client: dict[str, Any],
    metrics: dict[str, Any],
) -> dict[str, Any]:
    meta = data.get("meta") or {}
    body = data.get("body") or {}
    clinical = data.get("clinical") or {}
    governance = data.get("governance") or {}
    week = metrics.get("week") or []
    checks: list[dict[str, Any]] = []

    def add(check_id: str, label: str, passed: bool, detail: str, section: str, required: bool = True) -> None:
        checks.append(
            {
                "id": check_id,
                "label": label,
                "status": "pass" if passed else ("fail" if required else "warn"),
                "detail": detail,
                "section": section,
                "required": required,
            }
        )

    add("consent", "Client consent on file", bool(client.get("consent")), "Consent is required before a plan can be delivered.", "review")
    identity_ok = all(_text(meta.get(key)) for key in ("name", "diet_type", "patient_type", "major_goal"))
    add("identity", "Strategy identity", identity_ok, "Add a name, diet type, patient type, and major goal.", "brief")
    measurements_ok = _num(body.get("height_cm")) > 0 and _num(body.get("weight_kg")) > 0 and _num(body.get("target_weight_kg")) > 0
    add("measurements", "Height, weight, and target", measurements_ok, "Add the current and target measurements.", "targets")
    goals_ok = bool(_list(clinical.get("goals")))
    add("goals", "Client goals captured", goals_ok, "Add at least one clinical goal.", "clinical")
    reviewed = bool(governance.get("reviewed_clinical"))
    add("clinical_review", "Clinical context reviewed", reviewed, "Confirm the conditions, labs, and food guardrails are current.", "review")
    week_ok = len(week) == 7 and all(day.get("complete") for day in week)
    add("week", "Full macro week", week_ok, "All seven days need a calorie target and a ratio that totals 100%.", "macros")
    delivery_ok = bool(_text(meta.get("delivery_at")))
    add("delivery", "Plan delivery scheduled", delivery_ok, "Set the date and time the plan goes to the client.", "brief")

    warnings = metrics.get("warnings") or []
    for warning in warnings:
        ack_key = warning.get("ack_key")
        acknowledged = bool(governance.get(ack_key)) if ack_key else True
        checks.append(
            {
                "id": warning["id"],
                "label": warning["title"],
                "status": "pass" if acknowledged else "warn",
                "detail": warning["message"],
                "section": warning["section"],
                "required": bool(ack_key),
                "ack_key": ack_key,
                "acknowledged": acknowledged,
            }
        )

    delivered_at = _text(meta.get("delivery_at"))
    delivery_past = False
    if delivered_at:
        try:
            delivery_past = dt.datetime.fromisoformat(delivered_at) < dt.datetime.now()
        except ValueError:
            delivery_past = False
    if delivery_past:
        checks.append(
            {
                "id": "delivery_past",
                "label": "Delivery date is in the past",
                "status": "warn",
                "detail": "Move the delivery date forward or confirm this is a backdated record.",
                "section": "brief",
                "required": False,
            }
        )

    blockers = [check for check in checks if check["status"] == "fail"]
    unacked = [check for check in checks if check["status"] == "warn" and check.get("required")]
    warnings_only = [check for check in checks if check["status"] == "warn" and not check.get("required")]
    required_checks = [check for check in checks if check.get("required")]
    passed_required = [check for check in required_checks if check["status"] == "pass"]
    score = round(len(passed_required) / len(required_checks) * 100) if required_checks else 0
    return {
        "score": score,
        "checks": checks,
        "blockers": blockers + unacked,
        "warnings": warnings_only,
        "can_publish": not blockers and not unacked,
        "required_total": len(required_checks),
        "required_passed": len(passed_required),
    }


# --------------------------------------------------------------------------- prefill


def blank_strategy_data() -> dict[str, Any]:
    return {
        "meta": {
            "name": "",
            "patient_type": "General",
            "major_goal": "Weight maintenance",
            "diet_type": "Vegetarian",
            "description": "",
            "blood_report_at": "",
            "delivery_at": "",
            "reason_for_delay": "",
            "duration_days": 180,
        },
        "clinical": {
            "goals": [],
            "areas": [],
            "conditions": [],
            "symptoms": [],
            "deranged": [],
            "notes": "",
            "synced_at": "",
            "client_updated_at": "",
        },
        "body": {
            "height_cm": 0,
            "weight_kg": 0,
            "body_fat_pct": 0,
            "fat_free_mass_kg": 0,
            "target_weight_kg": 0,
            "ideal_weight_kg": 0,
            "ideal_weight_manual": 0,
            "ideal_weight_method": "devine",
            "age": 0,
            "sex": "Female",
            "life_stage": "Not pregnant",
            "activity_level": "Sedentary",
            "goal_mode": "maintenance",
            "calorie_method": "thumb",
            "workout_extra_kcal": 0,
            "protein_target": "1.2-1.4",
        },
        "macros": {"days": [], "template": {"formula": "thumb", "protein_target": "1.2-1.4"}},
        "food": {
            "food_wise": [],
            "other_goals": [],
            "next_phase": [],
            "superfoods": [],
        },
        "supplements": [],
        "medications": {"current": []},
        "recommendations": {"weight": "ALL", "medical": "ALL", "symptoms": "ALL", "immunity": "ALL"},
        "notes": {"client_request": "", "other": "", "internal": ""},
        "governance": {
            "reviewed_clinical": False,
            "acknowledged_interactions": False,
            "acknowledged_low_calorie": False,
            "acknowledged_macro_deviation": False,
            "acknowledged_allergies": False,
            "acknowledged_target_bmi": False,
            "acknowledged_paediatric": False,
            "acknowledged_pregnancy": False,
        },
    }


def _split_areas(value: Any) -> list[str]:
    return _unique(_list(value))


def _patient_type(conditions: list[str]) -> str:
    text = " | ".join(conditions).casefold()
    diabetic = "diabet" in text
    hypertensive = "hypertension" in text or "high bp" in text
    if diabetic and hypertensive:
        return "Diabetic + hypertensive"
    if diabetic:
        return "Diabetic"
    if hypertensive:
        return "Hypertensive"
    if "pcos" in text or "pcod" in text:
        return "PCOS"
    if "thyroid" in text:
        return "Thyroid"
    if "kidney" in text or "renal" in text:
        return "Renal"
    if "cardiac" in text or "heart" in text:
        return "Cardiac"
    if "pregnan" in text or "lactat" in text:
        return "Pregnancy / lactation"
    if "gut" in text or "ibs" in text or "sibo" in text:
        return "Gut health"
    return "General"


def _major_goal(primary: str, conditions: list[str]) -> str:
    text = primary.casefold()
    if "fat loss" in text:
        return "Fat loss"
    if "weight loss" in text:
        return "Weight loss"
    if "muscle" in text:
        return "Muscle gain"
    if "maintenance" in text:
        return "Weight maintenance"
    if "sports" in text:
        return "Sports performance"
    if "medical" in text:
        return "Medical condition management"
    if conditions:
        return "Medical condition management"
    return "Weight maintenance"


def _title_case(value: str) -> str:
    return value[:1].upper() + value[1:] if value else value


def build_prefill(bundle: dict[str, Any], today: dt.date | None = None) -> dict[str, Any]:
    today = today or dt.date.today()
    client = bundle.get("client") or {}
    raw = bundle.get("data") or {}
    basic = raw.get("basic") if isinstance(raw.get("basic"), dict) else {}
    bca = raw.get("bca") if isinstance(raw.get("bca"), dict) else {}
    medical = raw.get("medical") if isinstance(raw.get("medical"), dict) else {}
    dietary = raw.get("dietary") if isinstance(raw.get("dietary"), dict) else {}
    blood = raw.get("blood") if isinstance(raw.get("blood"), dict) else {}
    headtoe = raw.get("headtoe") if isinstance(raw.get("headtoe"), dict) else {}

    data = blank_strategy_data()
    meta = data["meta"]
    body = data["body"]
    clinical = data["clinical"]

    age = age_from_dob(basic.get("dob"), today)
    sex = _sex(basic.get("gender"))
    height = _num(bca.get("height_cm"))
    weight = _num(bca.get("weight_kg")) or _num(bca.get("weight"))
    body_fat = _num(bca.get("body_fat_pct"))
    fat_free = _num(bca.get("fat_free_mass_kg"))

    conditions = _unique(
        [
            _text(row.get("disease"))
            for row in (medical.get("conditions") or [])
            if isinstance(row, dict) and _text(row.get("disease"))
        ]
    )
    symptoms: list[str] = []
    for key, value in headtoe.items():
        if key.endswith("_findings") and isinstance(value, list):
            symptoms.extend(str(item) for item in value if str(item).strip())
        if key.endswith("_other") and _text(value):
            symptoms.append(_text(value))
    symptoms = _unique(symptoms)

    deranged = []
    for row in (blood.get("parameters") or []):
        if not isinstance(row, dict):
            continue
        if _text(row.get("flag")) in {"Low", "High", "Critical"}:
            deranged.append(
                {
                    "group": _text(row.get("category")) or "Other",
                    "test": _text(row.get("test_name")),
                    "value": _text(row.get("value")),
                    "unit": _text(row.get("unit")),
                    "range": _text(row.get("reference_range")),
                    "flag": _text(row.get("flag")),
                }
            )

    goals = _unique(
        [
            _text(medical.get("primary_goal")),
            _text(medical.get("fitness_goal")),
        ]
    )
    areas = _split_areas(medical.get("specific_areas"))
    diet = _text(dietary.get("food_preference")) or _text(basic.get("diet_type")) or "Vegetarian"
    activity = _text(medical.get("activity_level")) or "Sedentary"
    activity_map = {"low": "Sedentary", "light": "Light", "moderate": "Moderate", "high": "High", "athlete": "Athlete"}
    activity = activity_map.get(activity.casefold(), _title_case(activity))
    goal = _major_goal(_text(medical.get("primary_goal")), conditions)
    patient = _patient_type(conditions)

    body.update(
        {
            "height_cm": round(height, 1),
            "weight_kg": round(weight, 1),
            "body_fat_pct": round(body_fat, 1) if body_fat else 0,
            "fat_free_mass_kg": round(fat_free, 1) if fat_free else 0,
            "age": age,
            "sex": sex,
            "activity_level": activity,
        }
    )
    ideal = ideal_weight(height, sex, "devine")
    body["ideal_weight_kg"] = ideal["value"]
    if weight:
        if goal in {"Weight loss", "Fat loss"}:
            body["target_weight_kg"] = _round1(max(ideal["value"] or 0, weight * 0.95))
        elif goal in {"Weight gain", "Muscle gain"}:
            body["target_weight_kg"] = _round1(max(weight + 2, ideal["value"] or 0))
        else:
            body["target_weight_kg"] = _round1(weight)
    if age and age < 18:
        body["goal_mode"] = "maintenance"
        body["life_stage"] = "Not pregnant"
    goal_mode = _goal_mode(body.get("goal_mode"), body["target_weight_kg"], weight)
    body["goal_mode"] = goal_mode
    body["protein_target"] = DEFAULT_PROTEIN_TARGET.get(goal_mode, "1.2-1.4")
    body["workout_extra_kcal"] = 100 if _list(dietary.get("workout_schedule")) else 0
    body["ideal_weight_method"] = "devine"

    days = [
        {
            "day": day,
            "formula": "thumb",
            "calories": 0,
            "protein_target": body["protein_target"],
            "ratio": {"cho": 55, "pro": 20, "fat": 25},
            "note": "",
            "active": True,
        }
        for day in DAY_NAMES
    ]
    # Fill the suggested week once the core measurements exist.
    if height and weight and body["target_weight_kg"]:
        provisional = {**data, "body": body, "macros": {"days": []}}
        bmr = bmr_for(provisional)
        factor = activity_factor(activity)
        tdee = bmr["value"] * factor
        rda = rda_lookup(age, sex, activity, "Not pregnant", weight)
        plan = calorie_plan(provisional, bmr, tdee, rda)
        ratio = default_ratio(plan["calories"], body["target_weight_kg"], body["protein_target"], goal_mode)
        for row in days:
            row["calories"] = plan["calories"]
            row["ratio"] = ratio
            row["note"] = plan["note"]

    data["macros"]["days"] = days

    description_lines = []
    for condition in conditions[:4]:
        description_lines.append(f"{condition} management")
    if goal and goal not in {"Weight maintenance", "Medical condition management"}:
        description_lines.append(goal)
    if areas:
        description_lines.append(areas[0])
    meta.update(
        {
            "name": f"{goal} — {today.strftime('%b %Y')}",
            "patient_type": patient,
            "major_goal": goal,
            "diet_type": diet if diet in DIETS else "Vegetarian",
            "description": "\n".join(f"{index + 1}. {line}" for index, line in enumerate(_unique(description_lines))),
        }
    )
    report_date = _text(blood.get("report_date"))
    if report_date:
        try:
            received = dt.datetime.fromisoformat(f"{report_date}T10:00")
            meta["blood_report_at"] = received.strftime("%Y-%m-%dT%H:%M")
            delivery = received + dt.timedelta(days=5)
            if delivery.date() < today:
                delivery = dt.datetime.combine(today + dt.timedelta(days=5), dt.time(10, 0))
            meta["delivery_at"] = delivery.strftime("%Y-%m-%dT%H:%M")
        except ValueError:
            pass
    if not meta["delivery_at"]:
        meta["delivery_at"] = dt.datetime.combine(today + dt.timedelta(days=5), dt.time(10, 0)).strftime("%Y-%m-%dT%H:%M")

    clinical.update(
        {
            "goals": goals,
            "areas": areas,
            "conditions": conditions,
            "symptoms": symptoms,
            "deranged": deranged,
            "synced_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "client_updated_at": _text(client.get("updated_at")),
        }
    )

    food = data["food"]
    food_goal_map = {
        "Weight loss": "Weight: Fat burning",
        "Fat loss": "Weight: Fat burning",
        "Weight gain": "Weight: Muscle gain",
        "Muscle gain": "Weight: Muscle gain",
        "Medical condition management": "Improved blood parameters",
        "Gut health": "Gut health",
        "Sports performance": "Better energy",
    }
    food["other_goals"] = _unique(
        [
            food_goal_map.get(goal, "Better energy"),
            food_goal_map.get(_text(medical.get("fitness_goal")), ""),
        ]
    )
    food["food_wise"] = ["Low oil & low spice meals"]
    if any("diabet" in condition.casefold() for condition in conditions):
        food["food_wise"].append("Low GI meals")
    if any("hypertension" in condition.casefold() for condition in conditions):
        food["food_wise"].append("Low sodium meals")

    supplements = []
    for row in (dietary.get("supplements") or []):
        if isinstance(row, dict) and _text(row.get("name")):
            supplements.append(
                {
                    "name": _text(row.get("name")),
                    "quantity": 1,
                    "unit": "Serving",
                    "cal": 0,
                    "pro": 0,
                    "fat": 0,
                    "carb": 0,
                    "fibre": 0,
                    "source": "Client record",
                }
            )
    data["supplements"] = supplements

    medications = []
    for row in (dietary.get("medications") or []):
        if not isinstance(row, dict) or not _text(row.get("name")):
            continue
        medications.append(
            {
                "type": "Medication",
                "name": _text(row.get("name")),
                "brand": "",
                "time": _text(row.get("meal_time")),
                "quantity": 1,
                "dosage_per": _text(row.get("frequency")) or "Day",
                "composition": _text(row.get("dosage")),
                "taking_since": _text(row.get("since")),
                "changes": "",
            }
        )
    data["medications"]["current"] = medications
    data["notes"]["internal"] = _text(basic.get("notes"))
    return data


def client_context(bundle: dict[str, Any]) -> dict[str, Any]:
    raw = bundle.get("data") or {}
    basic = raw.get("basic") if isinstance(raw.get("basic"), dict) else {}
    medical = raw.get("medical") if isinstance(raw.get("medical"), dict) else {}
    dietary = raw.get("dietary") if isinstance(raw.get("dietary"), dict) else {}
    conditions = _unique(
        [
            _text(row.get("disease"))
            for row in (medical.get("conditions") or [])
            if isinstance(row, dict) and _text(row.get("disease"))
        ]
    )
    return {
        "allergies": _list(dietary.get("allergies")),
        "intolerances": _list(dietary.get("intolerances")),
        "restrictions": _list(dietary.get("restrictions")),
        "diet": _text(dietary.get("food_preference")) or _text(basic.get("diet_type")),
        "conditions": conditions,
        "client_updated_at": _text((bundle.get("client") or {}).get("updated_at")),
    }
