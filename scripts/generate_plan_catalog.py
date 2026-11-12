"""Build the plan food catalogue and the seed diet-plan template.

Input:  backend/app/data/reference_plan.json  (parsed from the reference PDF)
Output: backend/app/data/food_catalog.json
        backend/app/data/plan_templates.json

Calories per unit come from the reference plan itself (real portion/calorie pairs).
Macro grams are estimated from a keyword composition table and then scaled so that
4P + 4C + 9F equals the calorie value of the portion - the studio totals stay
internally consistent.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "backend" / "app" / "data"

UNIT_GRAMS = {
    "ML": 1.0,
    "Ml": 1.0,
    "Gram": 1.0,
    "Grams": 1.0,
    "Tsp": 5.0,
    "Tablespoon": 15.0,
    "Tbsp": 15.0,
    "Cup": 150.0,
    "Katori": 100.0,
    "Bowl": 200.0,
    "Glass": 250.0,
    "Kernel": 1.2,
    "Clove": 3.0,
    "Egg": 50.0,
    "Egg White": 33.0,
    "Piece": 50.0,
    "Roti/Chapati": 40.0,
    "Roti/Bhakri": 60.0,
    "Paratha": 80.0,
    "Capsule": 1.0,
    "Tablet": 1.5,
    "soft gels": 1.0,
    "Serving": 30.0,
    "Dash": 0.5,
    "Small (6\" To 6-7/8\" Long)": 90.0,
    "Piece (Half Of One)": 2.0,
    "Slice": 30.0,
}

# grams of protein / carbohydrate / fat per 100 g, matched on the dish name
COMPOSITION: list[tuple[str, tuple[float, float, float]]] = [
    (r"egg white", (11.0, 0.7, 0.2)),
    (r"egg", (13.0, 1.1, 11.0)),
    (r"chicken|fish|prawn|mutton|keema|tuna", (24.0, 1.0, 6.0)),
    (r"paneer|tofu|soya", (18.0, 4.0, 20.0)),
    (r"curd|yogurt|dahi|raita|lassi", (4.0, 5.0, 4.0)),
    (r"milk|shake|smoothie", (3.4, 4.8, 3.6)),
    (r"dal|chana|rajma|sattu|besan|moong|sprout", (20.0, 55.0, 5.0)),
    (r"rice|chawal|poha|parboiled|biryani|khichdi", (7.0, 78.0, 1.0)),
    (r"chapati|roti|paratha|bhakri|dosa|idli|bread|sandwich|wrap", (9.0, 50.0, 8.0)),
    (r"oats|quinoa|porridge|amaranth|muesli|granola", (12.0, 65.0, 7.0)),
    (r"almond|walnut|pistachio|brazil|cashew|peanut|seed|chia|flax|nut", (20.0, 15.0, 55.0)),
    (r"prune|raisin|date|apricot", (2.5, 65.0, 0.4)),
    (r"banana|apple|guava|papaya|melon|orange|berry|kiwi|pineapple|lychee|fruit", (1.0, 15.0, 0.3)),
    (r"coconut water|juice|lemon water|beetroot juice", (0.5, 5.0, 0.1)),
    (r"chutney|sauce|dip", (4.0, 10.0, 8.0)),
    (r"soup|broth", (2.0, 6.0, 1.0)),
    (r"salad|cucumber|carrot|radish|raddish|spinach|palak|tomato|pepper|zucchini|tori|ghiya|pumpkin|lauki|bhindi|beans|cabbage|broccoli|vegetable|sabji|sabzi|onion|garlic|ginger|mint|coriander", (2.0, 6.0, 0.4)),
    (r"saffron|salt|water|sweetener|stevia", (0.0, 0.0, 0.0)),
    (r"supplement|tablet|capsule|collagen|omega|probio|blend|magnesium|multivitamin|chaze|healthaid|fast & up", (25.0, 20.0, 8.0)),
    (r"sweet potato", (1.6, 20.0, 0.1)),
    (r"potato", (2.0, 17.0, 0.1)),
    (r"ghee|butter|oil", (0.0, 0.0, 100.0)),
    (r"honey|jaggery|sugar", (0.0, 100.0, 0.0)),
    (r"cheese", (25.0, 1.3, 33.0)),
    (r"halwa|sweet|dessert|kheer", (4.0, 30.0, 12.0)),
]

CATEGORY_RULES = [
    (r"sabji|sabzi|salad|chutney|korma|fry|bhaji|vegetable|zucchini|pepper|pumpkin|tori|bhindi|beans|gobi|palak|spinach|broccoli|avocado|spring onion", "Vegetables"),
    (r"water|juice|coconut water|tea|coffee|shake|lassi|smoothie|beverage|soup", "Beverages"),
    (r"supplement|tablet|capsule|collagen|omega|probio|blend|magnesium|chaze|healthaid|fast & up", "Supplements"),
    (r"egg|chicken|fish|mutton|prawn|tuna|keema", "Protein"),
    (r"dal|chana|chickpea|rajma|sattu|besan|paneer|soya|sprout|moong|curry", "Protein"),
    (r"rice|chapati|roti|paratha|bhakri|dosa|idli|poha|oats|quinoa|porridge|bread|sandwich|sweet potato|potato|upma|khichadi|khichdi", "Grains & starches"),
    (r"milk|curd|yogurt|dahi|raita|cheese", "Dairy"),
    (r"almond|walnut|pistachio|brazil|cashew|peanut|seed|chia|flax|raisin|prune|date", "Nuts, seeds & dried fruit"),
    (r"banana|apple|guava|papaya|melon|orange|berry|kiwi|pineapple|lychee|fruit", "Fruit"),
    (r"salt|saffron|garlic|ginger|sweetener|stevia", "Condiments"),
]

DIET_RULES = [
    (r"chicken|mutton|prawn|keema|tuna", "meat"),
    (r"fish", "fish"),
    (r"egg", "egg"),
    (r"milk|curd|yogurt|dahi|raita|paneer|cheese|ghee|butter", "dairy"),
    (r"almond|walnut|pistachio|cashew|peanut|seed|chia|flax|nut", "nuts"),
    (r"wheat|chapati|roti|paratha|bread|dosa|idli|sattu|besan", "gluten"),
]

EXTRA_DISHES = [
    # name, category, unit, grams/unit, kcal/unit, p, c, f (per unit)
    ("ROTI / CHAPATI", "Grains & starches", "Roti/Chapati", 40, 106, 3.0, 20.0, 1.5),
    ("BROWN RICE", "Grains & starches", "Cup", 150, 216, 5.0, 45.0, 1.8),
    ("STEAMED RICE", "Grains & starches", "Cup", 150, 195, 4.0, 42.0, 0.5),
    ("MOONG DAL", "Protein", "Katori", 150, 143, 9.0, 20.0, 3.0),
    ("TOOR DAL", "Protein", "Katori", 150, 160, 9.0, 22.0, 4.0),
    ("RAJMA CURRY", "Protein", "Katori", 150, 180, 9.0, 26.0, 4.0),
    ("CHANA MASALA", "Protein", "Katori", 150, 190, 10.0, 28.0, 4.5),
    ("PANEER BHURJI", "Protein", "Grams", 100, 250, 18.0, 4.0, 18.0),
    ("GRILLED CHICKEN BREAST", "Protein", "Grams", 100, 165, 31.0, 0.0, 3.6),
    ("GRILLED FISH", "Protein", "Grams", 100, 136, 26.0, 0.0, 3.0),
    ("CURD", "Dairy", "Katori", 150, 90, 5.0, 7.0, 4.5),
    ("CURD RICE", "Grains & starches", "Katori", 200, 245, 6.0, 42.0, 6.0),
    ("VEGETABLE SALAD", "Vegetables", "Grams", 150, 45, 1.8, 8.0, 0.4),
    ("MIXED VEGETABLE SABJI", "Vegetables", "Grams", 150, 95, 3.0, 9.0, 5.0),
    ("PALAK PANEER", "Vegetables", "Katori", 150, 230, 11.0, 7.0, 17.0),
    ("LAUKI SABJI", "Vegetables", "Grams", 150, 55, 1.5, 7.0, 2.2),
    ("TOMATO SOUP", "Beverages", "ML", 200, 55, 1.2, 7.0, 2.0),
    ("GREEN TEA", "Beverages", "Cup", 150, 3, 0.0, 0.6, 0.0),
    ("BLACK COFFEE", "Beverages", "Cup", 150, 5, 0.3, 0.7, 0.0),
    ("WHEY PROTEIN", "Supplements", "Serving", 30, 120, 24.0, 2.0, 1.5),
    ("MULTIVITAMIN", "Supplements", "Tablet", 1.5, 0, 0.0, 0.0, 0.0),
    ("OATS WITH MILK", "Grains & starches", "Katori", 250, 220, 8.0, 32.0, 6.0),
    ("VEGETABLE POHA", "Grains & starches", "Grams", 200, 250, 5.0, 42.0, 7.0),
    ("UPMA", "Grains & starches", "Grams", 200, 240, 5.0, 40.0, 7.0),
    ("IDLI", "Grains & starches", "Piece", 50, 58, 1.6, 12.0, 0.2),
    ("SAMBAR", "Protein", "Katori", 150, 130, 6.0, 16.0, 4.0),
    ("MIXED FRUIT BOWL", "Fruit", "Grams", 200, 120, 1.2, 29.0, 0.4),
    ("APPLE", "Fruit", "Piece", 150, 78, 0.4, 20.0, 0.3),
    ("BANANA", "Fruit", "Piece", 100, 105, 1.2, 27.0, 0.3),
    ("ALMONDS", "Nuts, seeds & dried fruit", "Piece", 1.2, 7, 0.26, 0.26, 0.6),
    ("WALNUT KERNELS", "Nuts, seeds & dried fruit", "Piece", 2.0, 13, 0.3, 0.28, 1.3),
    ("PEANUT BUTTER", "Nuts, seeds & dried fruit", "Tablespoon", 16, 95, 4.0, 3.0, 8.0),
    ("GHEE", "Condiments", "Tsp", 5, 45, 0.0, 0.0, 5.0),
    ("LEMON WATER", "Beverages", "ML", 250, 3, 0.1, 0.8, 0.0),
    ("BUTTERMILK", "Dairy", "Glass", 250, 98, 8.0, 12.0, 2.0),
    ("SPROUT SALAD", "Protein", "Grams", 150, 165, 12.0, 24.0, 2.0),
    ("VEGETABLE KHICHDI", "Grains & starches", "Katori", 200, 230, 8.0, 40.0, 4.0),
    ("PANEER WRAP", "Grains & starches", "Piece", 150, 320, 14.0, 34.0, 14.0),
    ("CHICKEN SALAD", "Protein", "Grams", 200, 240, 30.0, 8.0, 9.0),
    ("EGG BHURJI", "Protein", "Egg", 50, 90, 6.0, 1.0, 7.0),
    ("ROASTED MAKHANA", "Nuts, seeds & dried fruit", "Piece", 0.5, 2, 0.05, 0.4, 0.1),
    ("DARK CHOCOLATE", "Condiments", "Grams", 10, 55, 0.8, 4.5, 3.5),
]


def macros(name: str, grams: float, kcal: float) -> tuple[float, float, float]:
    if kcal <= 0 or grams <= 0:
        return (0.0, 0.0, 0.0)
    p = c = f = 5.0
    for pattern, values in COMPOSITION:
        if re.search(pattern, name, re.I):
            p, c, f = values
            break
    energy = (4 * p + 4 * c + 9 * f) * grams / 100
    if energy <= 0:
        return (0.0, 0.0, 0.0)
    scale = kcal / energy
    return (
        round(p * grams / 100 * scale, 2),
        round(c * grams / 100 * scale, 2),
        round(f * grams / 100 * scale, 2),
    )


def category(name: str) -> str:
    for pattern, value in CATEGORY_RULES:
        if re.search(pattern, name, re.I):
            return value
    return "Other"


def diet_tags(name: str) -> list[str]:
    tags = []
    for pattern, tag in DIET_RULES:
        if re.search(pattern, name, re.I):
            tags.append(tag)
    return tags


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]


def split_portion(portion: str) -> tuple[float, str]:
    text = (portion or "").strip()
    match = re.match(r"^([\d.]+)\s*(.*)$", text)
    if not match:
        return (1.0, "Serving")
    value = float(match.group(1))
    unit = match.group(2).strip() or "Serving"
    return (value, unit)


def main() -> None:
    reference = json.loads((DATA / "reference_plan.json").read_text())
    samples: dict[tuple[str, str], list[tuple[float, float]]] = defaultdict(list)
    unit_votes: dict[str, Counter] = defaultdict(Counter)
    for day in reference:
        for slot in day["slots"]:
            for meal in slot["meals"]:
                qty, unit = split_portion(meal["portion"])
                if unit not in UNIT_GRAMS:
                    unit = "Serving"
                if meal["calories"] is None or qty <= 0:
                    continue
                samples[meal["name"]].append((qty, meal["calories"]))
                unit_votes[meal["name"]][unit] += 1

    dishes = []
    for name, values in sorted(samples.items()):
        unit = unit_votes[name].most_common(1)[0][0]
        per_unit = [kcal / qty for qty, kcal in values]
        kcal = round(sum(per_unit) / len(per_unit), 4)
        grams = UNIT_GRAMS.get(unit, 30.0)
        p, c, f = macros(name, grams, kcal)
        dishes.append(
            {
                "id": slug(name),
                "name": name,
                "category": category(name),
                "unit": unit,
                "grams": grams,
                "kcal": kcal,
                "protein": p,
                "carbs": c,
                "fat": f,
                "diet": diet_tags(name),
                "source": "reference",
            }
        )

    def scale_to_kcal(kcal: float, p: float, c: float, f: float) -> tuple[float, float, float]:
        energy = 4 * p + 4 * c + 9 * f
        if kcal <= 0 or energy <= 0:
            return (0.0, 0.0, 0.0)
        factor = kcal / energy
        return (round(p * factor, 2), round(c * factor, 2), round(f * factor, 2))

    seen = {dish["id"] for dish in dishes}
    for name, cat, unit, grams, kcal, p, c, f in EXTRA_DISHES:
        item_id = slug(name)
        if item_id in seen:
            continue
        seen.add(item_id)
        p, c, f = scale_to_kcal(float(kcal), float(p), float(c), float(f))
        dishes.append(
            {
                "id": item_id,
                "name": name,
                "category": cat,
                "unit": unit,
                "grams": float(grams),
                "kcal": float(kcal),
                "protein": float(p),
                "carbs": float(c),
                "fat": float(f),
                "diet": diet_tags(name),
                "source": "catalogue",
            }
        )

    dishes.sort(key=lambda d: (d["category"], d["name"]))
    catalogue = {
        "units": [{"unit": unit, "grams": grams} for unit, grams in UNIT_GRAMS.items()],
        "categories": sorted({dish["category"] for dish in dishes}),
        "dishes": dishes,
    }
    (DATA / "food_catalog.json").write_text(json.dumps(catalogue, indent=2))
    print(f"catalogue: {len(dishes)} dishes -> backend/app/data/food_catalog.json")

    # ---- seed templates -------------------------------------------------------
    slot_time = re.compile(r"^(?P<name>.+?)\s+at\s+(?P<time>\d{1,2}:\d{2}\s*[AP]M)$", re.I)

    def split_slot(label: str) -> tuple[str, str]:
        match = slot_time.match(label.strip())
        if not match:
            return label.strip(), "08:00"
        return match.group("name").strip(), match.group("time").upper().replace(" ", "")

    days = []
    for index, day in enumerate(reference):
        slots = []
        for slot in day["slots"]:
            name, time = split_slot(slot["name"])
            meals = []
            for meal in slot["meals"]:
                qty, unit = split_portion(meal["portion"])
                if unit not in UNIT_GRAMS:
                    unit = "Serving"
                meals.append(
                    {
                        "name": meal["name"],
                        "qty": qty,
                        "unit": unit,
                        "portion": (meal["portion"] or "").strip() or "1 Serving",
                        "calories": meal["calories"] or 0,
                        "note": meal["note"],
                        "alternatives": [
                            {
                                "name": alt["name"],
                                "portion": alt["portion"],
                                "calories": alt["calories"] or 0,
                            }
                            for alt in meal.get("alternatives", [])
                        ],
                    }
                )
            slots.append({"name": name, "time": time, "note": slot["note"], "meals": meals})
        days.append({"day": day["day"], "slots": slots})

    template = {
        "id": "sports-tennis-7day",
        "name": "Sports nutrition · tennis (7 day)",
        "description": "Training-day rotation with pre/during/post workout slots, used by the reference plan.",
        "days": days,
    }
    (DATA / "plan_templates.json").write_text(json.dumps([template], indent=2))
    print(f"template: {sum(len(d['slots']) for d in days)} slots -> backend/app/data/plan_templates.json")


if __name__ == "__main__":
    main()
