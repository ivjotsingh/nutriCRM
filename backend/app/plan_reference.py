"""Static reference content for diet plans: catalogue, superfoods, guidelines, disclaimers.

The catalogue and the seed template are generated from the reference PDF by
``scripts/parse_reference_pdf.py`` and ``scripts/generate_plan_catalog.py``.
Everything else here is editorial content the practitioner can include or exclude
per plan.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

DEFAULT_BRAND = {
    "name": "NutriAlign",
    "tagline": "Personalised nutrition, planned with care",
    "email": "support@nutrialign.app",
    "phone": "+91 90000 00000",
    "powered_by": "NutriAlign",
    "footer_note": "This plan is prepared for the named client and is not medical advice.",
}

SLOT_PRESETS = [
    {"name": "On Waking Up", "time": "06:00"},
    {"name": "Pre Training", "time": "06:30"},
    {"name": "During Training", "time": "07:00"},
    {"name": "Breakfast", "time": "08:30"},
    {"name": "During Workout", "time": "10:30"},
    {"name": "Mid Morning", "time": "11:30"},
    {"name": "Lunch", "time": "13:00"},
    {"name": "Supplement", "time": "13:30"},
    {"name": "Beverages", "time": "14:30"},
    {"name": "Post Workout", "time": "16:00"},
    {"name": "Snack", "time": "18:00"},
    {"name": "Dinner", "time": "20:00"},
    {"name": "Post Dinner", "time": "21:30"},
    {"name": "Bedtime", "time": "22:00"},
]

SUPERFOODS = [
    {
        "id": "lemon",
        "name": "Lemon",
        "note": "Lemon contains citrus and antioxidants which improve recovery after intense aerobic exercise training by minimising oxidative stress and inflammation associated with exercise, as well as by reducing the levels of muscle circulating markers.",
    },
    {
        "id": "raisins",
        "name": "Raisins",
        "note": "Raisins are a natural source of glucose and fructose that gives a burst of energy and reduces stress.",
    },
    {
        "id": "banana",
        "name": "Banana",
        "note": "Loaded with potassium, magnesium, vitamin B6 and vitamin C. Nutrient levels rise as bananas ripen; dark-spotted bananas are 8 times more effective in boosting the power of white blood cells than green-skin bananas.",
    },
    {
        "id": "brazil-nuts",
        "name": "Brazil nuts",
        "note": "High in magnesium — brazil nuts contain 56 mg of magnesium in 100 g, which fulfils 13% of the required amount.",
    },
    {
        "id": "carrot",
        "name": "Carrot",
        "note": "Carrots are good sources of vitamin A that help reduce oxidative stress generated during exercise.",
    },
    {
        "id": "watermelon-seeds",
        "name": "Watermelon seeds",
        "note": "Rich in PUFA and MUFA and also contain vitamins A, D, E and K; they help with the lipid profile.",
    },
    {
        "id": "saffron",
        "name": "Saffron",
        "note": "Saffron contains an impressive variety of plant compounds that act as antioxidants — molecules that protect cells against free radicals and oxidative stress. Notable saffron antioxidants include crocin, crocetin, safranal and kaempferol. Saffron extract has also been shown to support wound healing.",
    },
    {
        "id": "prunes",
        "name": "Prunes",
        "note": "Eating prunes as part of a weight-control diet can improve weight loss. Consumption of dried fruit is recommended during weight loss and enhances feelings of fullness. It also acts as a natural laxative.",
    },
    {
        "id": "sweet-potato",
        "name": "Sweet potato",
        "note": "Sweet potatoes are rich in complex carbohydrates that help replenish the glycogen stores lost during a workout, thus promoting recovery.",
    },
    {
        "id": "kalonji-seeds",
        "name": "Kalonji seeds",
        "note": "Kalonji (black cumin) seeds provide antioxidant and anti-inflammatory compounds that may support muscle recovery and reduce exercise-induced oxidative stress. They also provide healthy fats and micronutrients, supporting overall cardiovascular health and recovery in tennis players.",
    },
    {
        "id": "curd",
        "name": "Curd",
        "note": "A fermented source of protein and probiotics that supports digestion, immunity and appetite regulation.",
    },
    {
        "id": "leafy-greens",
        "name": "Leafy greens",
        "note": "Rich in folate, vitamin K, magnesium and fibre; supports blood pressure, bone health and gut regularity.",
    },
]

MEASUREMENT_GUIDE = [
    "1 TSP (SMALL SPOON) - 5g",
    "1 TBSP (BIG SPOON) - 15g",
    "1 SMALL KATORI - 100g",
    "1 MEDIUM KATORI - 150g",
    "1 BOWL (SOUP BOWL) - 200g",
    "1 GLASS - 250ml",
    "1 TEA CUP - 150ml",
]

GUIDELINES: list[dict[str, Any]] = [
    {
        "id": "hydration",
        "title": "Hydration",
        "paragraphs": [
            "We suggest aiming for a daily water intake of approximately 30–35 ml per kilogram of body weight. For example, a 70 kg individual may require around 2.1–2.5 litres of water per day.",
            "Fluid requirements may increase depending on activity levels, environment and overall health status. We recommend increasing intake on workout days, during travel, in hot or humid weather, while spending long hours in air-conditioned environments, or during episodes of loose stools or vomiting.",
            "As a practical approach, begin the day with 1–2 glasses of water and continue sipping fluids consistently throughout the day.",
            "A simple way to monitor hydration is by checking that urine remains light yellow in colour.",
        ],
    },
    {
        "id": "mindful-eating",
        "title": "Mindful eating",
        "paragraphs": [
            "We recommend eating meals slowly and mindfully, allowing at least 15–20 minutes per meal.",
            "Eating in a seated and calm environment, chewing food thoroughly, and avoiding screens while eating can significantly improve digestion and satiety.",
            "We suggest using slightly smaller plates to support better portion awareness.",
            "Where possible, stop eating when you feel comfortably full rather than overly stuffed.",
        ],
    },
    {
        "id": "eating-out",
        "title": "Eating out / ordering smart",
        "paragraphs": [
            "When eating out, we suggest structuring the meal so that approximately half the plate contains vegetables, one quarter protein and one quarter carbohydrates.",
            "Choosing grilled, steamed, roasted or tandoori options is generally preferable over fried dishes.",
            "Simple combinations such as dal, sabzi, roti/rice with paneer, eggs, chicken or fish work well.",
            "We recommend keeping rich gravies, cheese-heavy dishes and butter-loaded meals for occasional consumption.",
        ],
    },
    {
        "id": "dessert",
        "title": "Dessert & craving management",
        "paragraphs": [
            "We suggest limiting desserts to one serving per occasion or sharing when possible.",
            "Desserts are best enjoyed after a main meal, which helps reduce sharp blood sugar fluctuations.",
            "For regular cravings, planned portions such as dark chocolate, fruit-based desserts or a small sweet portion can be incorporated mindfully.",
        ],
    },
    {
        "id": "travel",
        "title": "Travel & airport eating",
        "paragraphs": [
            "While travelling, we recommend choosing practical and easily digestible options such as idli, dosa, curd rice, paneer wraps, fruits, yogurt, nuts or makhana.",
            "Carrying backup snacks from home is strongly encouraged.",
            "Hydration requirements are often higher during travel, and we suggest consciously increasing water intake.",
        ],
    },
    {
        "id": "oils",
        "title": "Oils & fat usage",
        "paragraphs": [
            "We recommend using good-quality oils such as groundnut, coconut, rice bran or olive oil, or moderate quantities of ghee.",
            "Cold-pressed or filtered oils may be preferred where available.",
            "As a general guideline, visible fats may be restricted to approximately 3–4 teaspoons per day, unless modified for a specific clinical goal.",
        ],
    },
    {
        "id": "salt",
        "title": "Salt guidelines",
        "paragraphs": [
            "We suggest keeping total daily salt intake to less than 5 grams per day (approximately 1 teaspoon).",
            "For clients with blood pressure concerns or other medical conditions, intake should be modified as per clinical requirements.",
        ],
    },
    {
        "id": "cookware",
        "title": "Cookware & kitchen tools",
        "paragraphs": [
            "We recommend the use of safe cookware such as stainless steel, cast iron, ceramic or glass-based utensils.",
            "Damaged non-stick cookware should be avoided.",
            "Appliances such as air fryers and ovens can be excellent tools to reduce oil usage.",
        ],
    },
    {
        "id": "storage",
        "title": "Food storage",
        "paragraphs": [
            "Cooked meals are best stored in steel or glass containers.",
            "We suggest avoiding hot food being transferred directly into plastic containers.",
            "Prepared foods are ideally consumed within 24–48 hours.",
        ],
    },
    {
        "id": "office",
        "title": "Office meal management",
        "paragraphs": [
            "We strongly recommend planning meals and snacks ahead for workdays.",
            "Keeping snacks such as nuts, fruit, yogurt or protein options readily available helps prevent long fasting gaps.",
            "Even during busy schedules, we suggest not skipping meals entirely.",
        ],
    },
    {
        "id": "supplements",
        "title": "Supplements routine",
        "paragraphs": [
            "All supplements should be taken strictly as prescribed.",
            "We suggest attaching supplement intake to a daily routine such as breakfast, post-workout or bedtime to improve consistency.",
        ],
    },
    {
        "id": "sweeteners",
        "title": "Sweeteners",
        "paragraphs": [
            "We recommend limiting all forms of sweeteners, including jaggery, honey and brown sugar.",
            "Where needed, low-calorie options such as stevia may be considered.",
        ],
    },
    {
        "id": "honey",
        "title": "Honey usage",
        "paragraphs": [
            "If honey is included, we suggest limiting intake to approximately 1 teaspoon per day, unless otherwise specified.",
            "Avoid repeated heating or adding it to very hot liquids.",
        ],
    },
    {
        "id": "rice",
        "title": "Rice guidelines",
        "paragraphs": [
            "All rice varieties may be included based on tolerance, digestion and preference.",
            "White rice is generally easier to digest, while brown and red rice provide greater fibre.",
            "We recommend combining rice with protein and vegetables.",
        ],
    },
    {
        "id": "grains",
        "title": "Wheat & grains",
        "paragraphs": [
            "We suggest prioritising whole grains such as whole wheat, jowar, bajra, ragi, oats and quinoa.",
            "Refined flour-based foods may be limited.",
        ],
    },
    {
        "id": "produce-hygiene",
        "title": "Fruits & vegetables hygiene",
        "paragraphs": [
            "All fruits and vegetables should be thoroughly washed under running water before use.",
            "Leafy vegetables should be dried before refrigeration.",
        ],
    },
    {
        "id": "labels",
        "title": "Label reading",
        "paragraphs": [
            "We recommend checking protein, sugar, sodium and serving size before purchasing packaged foods.",
            "Products where sugar appears within the first few ingredients should be limited.",
        ],
    },
    {
        "id": "portions",
        "title": "Portion control",
        "paragraphs": [
            "Portion consistency plays an important role in outcomes.",
            "Using a kitchen scale or standard measuring tools can be helpful, especially in the initial stages.",
        ],
    },
    {
        "id": "gut",
        "title": "Gut & symptom management",
        "paragraphs": [
            "For constipation, we suggest increasing fluids, fibre and post-meal walking.",
            "For loose stools, focus on hydration, electrolytes and simple meals.",
            "For indigestion, temporarily reducing oily and heavy foods is advisable.",
        ],
    },
    {
        "id": "monitoring",
        "title": "Health monitoring",
        "paragraphs": [
            "Routine health parameters such as blood sugar, lipid profile, CBC, vitamin D, vitamin B12 and blood pressure may be reviewed every 3–6 months.",
        ],
    },
    {
        "id": "meal-framework",
        "title": "Meal structuring framework",
        "paragraphs": ["We recommend that every major meal includes:"],
        "bullets": ["one protein source", "one fibre source", "one carbohydrate source", "controlled fat"],
        "after": ["This helps improve satiety and meal balance."],
    },
    {
        "id": "protein",
        "title": "Protein optimisation",
        "paragraphs": [
            "Protein should ideally be included in every meal and snack.",
            "We recommend spreading intake across the day rather than concentrating it in one meal.",
        ],
    },
    {
        "id": "hunger",
        "title": "Hunger vs craving awareness",
        "paragraphs": [
            "We encourage checking whether the urge to eat is driven by physical hunger or emotional triggers such as stress, boredom or fatigue.",
        ],
    },
    {
        "id": "meal-timing",
        "title": "Meal timing flexibility",
        "paragraphs": [
            "We suggest maintaining consistent meal intervals of 3–5 hours, with flexibility based on lifestyle and work routines.",
        ],
    },
    {
        "id": "snacking",
        "title": "Snacking strategy",
        "paragraphs": [
            "Snacks are optional and should be used strategically.",
            "A well-structured snack should ideally include protein and fibre.",
        ],
    },
    {
        "id": "social",
        "title": "Weekend & social life strategy",
        "paragraphs": [
            "We recommend maintaining regular meals during the day rather than under-eating in anticipation of outings.",
            "At social events, focus on portion awareness and return to routine at the next meal.",
        ],
    },
    {
        "id": "alcohol",
        "title": "Alcohol guidelines",
        "paragraphs": [
            "If applicable, alcohol intake should remain occasional.",
            "We suggest eating before drinking and ensuring adequate hydration alongside.",
        ],
    },
    {
        "id": "sleep",
        "title": "Sleep & recovery",
        "paragraphs": [
            "We strongly recommend 7–8 hours of quality sleep daily.",
            "Sleep is an important determinant of hunger regulation, hormonal balance and recovery.",
        ],
    },
    {
        "id": "activity",
        "title": "Physical activity integration",
        "paragraphs": [
            "Daily movement remains a key recommendation.",
            "A baseline of 7–10k steps per day may be suggested where feasible.",
            "Structured exercise may be added as per individual goals.",
        ],
    },
    {
        "id": "neat",
        "title": "NEAT (daily movement)",
        "paragraphs": [
            "Non-exercise movement such as walking, taking stairs and standing breaks should be encouraged throughout the day.",
        ],
    },
    {
        "id": "stress",
        "title": "Stress & emotional eating",
        "paragraphs": [
            "We recommend identifying common triggers for emotional eating and building alternative coping mechanisms.",
        ],
    },
    {
        "id": "cycle",
        "title": "Menstrual cycle considerations",
        "paragraphs": [
            "For female clients, appetite changes, cravings and temporary weight fluctuations around the menstrual cycle are normal.",
            "Meal plans may be adjusted accordingly.",
        ],
    },
    {
        "id": "satiety",
        "title": "Eating speed & satiety signals",
        "paragraphs": [
            "We suggest pausing midway through meals to reassess hunger and fullness.",
            "Stopping at around 80% fullness is a helpful practical guideline.",
        ],
    },
    {
        "id": "consistency",
        "title": "Consistency framework",
        "paragraphs": [
            "We strongly emphasise consistency over perfection.",
            "Even 4–5 well-managed days per week can lead to meaningful progress.",
        ],
    },
    {
        "id": "environment",
        "title": "Environment design",
        "paragraphs": [
            "We recommend keeping healthy foods visible and easily accessible.",
            "Trigger foods may be limited or stored out of immediate reach.",
        ],
    },
    {
        "id": "progress",
        "title": "Progress tracking beyond weight",
        "paragraphs": ["Progress should include:"],
        "bullets": ["measurements", "strength", "energy", "sleep", "digestion", "performance"],
        "after": ["Weight alone should not be the only marker."],
    },
    {
        "id": "backup",
        "title": "Travel / busy day backup plan",
        "paragraphs": ["We suggest always having 2–3 reliable fallback meal options available for busy days. Examples include:"],
        "bullets": ["curd + fruit", "protein bar + nuts", "simple dal-rice", "paneer sandwich"],
    },
]

DISCLAIMER = [
    "We at NutriAlign wish to impart knowledge of nutrition. We provide holistic approaches for wellness and better living through a range of biochemical and dietary assessments and recommendations of appropriate supplements. The privacy of the client is of paramount importance and we protect it while collecting any information.",
    "The nutrition plan is made in accordance with the blood test report results. NutriAlign cannot be held liable for any inaccuracy or issues of authenticity of the blood test reports or any document from a third party.",
    "NutriAlign diet and supplement plans are not intended to diagnose, treat, prevent, mitigate or cure any medical condition or disease. In case of any such condition, it is recommended that you consult your physician before pursuing any course of treatment.",
    "Utmost care has been taken to study the stated individual ingredients in each supplement and the best possible supplements have been identified for your benefit. However, NutriAlign gives no guarantee regarding the efficacy of the supplements as they are manufactured by third parties and not under our control.",
    "NutriAlign and its team of dietitians shall not be held liable for adverse effects, if any, from the recommended foods and supplements advised in the nutrition plan.",
]


@lru_cache(maxsize=1)
def catalog() -> dict[str, Any]:
    return json.loads((DATA_DIR / "food_catalog.json").read_text())


@lru_cache(maxsize=1)
def dishes() -> list[dict[str, Any]]:
    return catalog()["dishes"]


@lru_cache(maxsize=1)
def dish_index() -> dict[str, dict[str, Any]]:
    return {dish["id"]: dish for dish in dishes()}


@lru_cache(maxsize=1)
def units() -> dict[str, float]:
    return {row["unit"]: row["grams"] for row in catalog()["units"]}


@lru_cache(maxsize=1)
def templates() -> list[dict[str, Any]]:
    return json.loads((DATA_DIR / "plan_templates.json").read_text())


def dish(dish_id: str) -> dict[str, Any] | None:
    return dish_index().get(dish_id)


def find_dish(name: str) -> dict[str, Any] | None:
    needle = name.strip().casefold()
    for item in dishes():
        if item["name"].casefold() == needle:
            return item
    return None


def unit_grams(unit: str) -> float:
    return units().get(unit, 30.0)


def reference() -> dict[str, Any]:
    """Editorial reference payload used by the plan studio."""
    return {
        "days": DAY_NAMES,
        "day_short": DAY_SHORT,
        "slot_presets": SLOT_PRESETS,
        "superfoods": SUPERFOODS,
        "measurement_guide": MEASUREMENT_GUIDE,
        "guidelines": GUIDELINES,
        "disclaimer": DISCLAIMER,
        "units": catalog()["units"],
        "categories": catalog()["categories"],
        "brand": DEFAULT_BRAND,
        "templates": [{"id": item["id"], "name": item["name"], "description": item["description"]} for item in templates()],
    }
