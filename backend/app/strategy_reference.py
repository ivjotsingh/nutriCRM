"""Reference data for the NutriAlign strategy studio.

Every number the studio quotes is traceable to this module, so the UI, the
published snapshot, and the PRD cannot drift apart. Values and behaviour:

* Thumb rule factors and the Katch-McArdle BMR formula come from the practice
  reference screens supplied with the brief.
* The RDA table reproduces the practice chart (ICMR reference body weights,
  energy, and protein) exactly as supplied. It is deliberately labelled as a
  practice chart rather than as the current ICMR-NIN edition; see
  ``FORMULA_NOTES["rda"]`` and the product PRD for the data-governance note.
* Protein target ranges run from 0.6-0.8 to 3.6-3.8 g/kg in 0.2 steps.
"""

from __future__ import annotations

from typing import Any

DIETS = ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan", "Jain"]

PATIENT_TYPES = [
    "General",
    "Diabetic",
    "Hypertensive",
    "Diabetic + hypertensive",
    "PCOS",
    "Thyroid",
    "Renal",
    "Cardiac",
    "Gut health",
    "Pregnancy / lactation",
    "Sports",
    "Paediatric",
    "Other",
]

MAJOR_GOALS = [
    "Weight loss",
    "Fat loss",
    "Weight maintenance",
    "Weight gain",
    "Muscle gain",
    "Medical condition management",
    "Sports performance",
    "Gut health",
]

GOAL_MODES = [
    {"value": "loss", "label": "Weight / fat loss"},
    {"value": "maintenance", "label": "Maintenance"},
    {"value": "gain", "label": "Weight / muscle gain"},
]

ACTIVITY_LEVELS = [
    {"value": "Sedentary", "label": "Sedentary", "factor": 1.2, "thumb": "sedentary"},
    {"value": "Light", "label": "Lightly active", "factor": 1.375, "thumb": "sedentary"},
    {"value": "Moderate", "label": "Moderately active", "factor": 1.55, "thumb": "moderate"},
    {"value": "High", "label": "Very active", "factor": 1.725, "thumb": "heavy"},
    {"value": "Athlete", "label": "Athlete", "factor": 1.9, "thumb": "heavy"},
]

THUMB_FACTORS: dict[str, dict[str, int]] = {
    "loss": {"sedentary": 20, "moderate": 25, "heavy": 30},
    "maintenance": {"sedentary": 25, "moderate": 30, "heavy": 35},
    "gain": {"sedentary": 30, "moderate": 35, "heavy": 40},
}

PROTEIN_TARGETS = [
    "0.6-0.8",
    "0.8-1.0",
    "1.0-1.2",
    "1.2-1.4",
    "1.4-1.6",
    "1.6-1.8",
    "1.8-2.0",
    "2.0-2.2",
    "2.2-2.4",
    "2.4-2.6",
    "2.6-2.8",
    "2.8-3.0",
    "3.0-3.2",
    "3.2-3.4",
    "3.4-3.6",
    "3.6-3.8",
]

DEFAULT_PROTEIN_TARGET = {"loss": "1.2-1.4", "maintenance": "0.8-1.0", "gain": "1.2-1.4"}

IDEAL_WEIGHT_METHODS = [
    {
        "value": "devine",
        "label": "Devine (clinical default)",
        "detail": "45.5 kg for a woman or 50 kg for a man at 5 ft, plus 2.3 kg per inch above 5 ft.",
    },
    {
        "value": "bmi22",
        "label": "BMI 22",
        "detail": "22 × height in metres squared. A mid-range healthy-weight reference for Asian-Indian adults.",
    },
    {"value": "manual", "label": "Manual override", "detail": "Enter the ideal body weight agreed with the treating clinician."},
]

# Practice RDA chart. ``activity`` is only used for adults; children rows ignore
# it. Pregnancy and lactation rows replace the standard women's row.
RDA_ROWS: list[dict[str, Any]] = [
    # ICMR-NIN 2020 RDA/EER summary. Energy is the estimated energy
    # requirement (EER); protein is the RDA (g/day) at the reference body
    # weight. The 2024 Dietary Guidelines for Indians are food-based guidance
    # and do not replace this RDA table.
    {"group": "Man", "category": "Sedentary", "sex": "Male", "age_min": 18, "age_max": 59, "activity": "Sedentary", "body_weight_kg": 65, "energy_kcal": 2110, "protein_g": 54},
    {"group": "Man", "category": "Moderate", "sex": "Male", "age_min": 18, "age_max": 59, "activity": "Moderate", "body_weight_kg": 65, "energy_kcal": 2710, "protein_g": 54},
    {"group": "Man", "category": "Heavy", "sex": "Male", "age_min": 18, "age_max": 59, "activity": "Heavy", "body_weight_kg": 65, "energy_kcal": 3470, "protein_g": 54},
    {"group": "Man", "category": "Sedentary", "sex": "Male", "age_min": 60, "age_max": 120, "activity": "Sedentary", "body_weight_kg": 65, "energy_kcal": 1700, "protein_g": 54, "note": "Older adult; sedentary reference."},
    {"group": "Women", "category": "Sedentary", "sex": "Female", "age_min": 18, "age_max": 59, "activity": "Sedentary", "body_weight_kg": 55, "energy_kcal": 1660, "protein_g": 46},
    {"group": "Women", "category": "Moderate", "sex": "Female", "age_min": 18, "age_max": 59, "activity": "Moderate", "body_weight_kg": 55, "energy_kcal": 2130, "protein_g": 46},
    {"group": "Women", "category": "Heavy", "sex": "Female", "age_min": 18, "age_max": 59, "activity": "Heavy", "body_weight_kg": 55, "energy_kcal": 2720, "protein_g": 46},
    {"group": "Women", "category": "Sedentary", "sex": "Female", "age_min": 60, "age_max": 120, "activity": "Sedentary", "body_weight_kg": 55, "energy_kcal": 1500, "protein_g": 45.7, "note": "Older adult; sedentary reference."},
    {"group": "Women", "category": "Pregnant (2nd trimester)", "sex": "Female", "age_min": 18, "age_max": 50, "activity": "Life stage", "body_weight_kg": 65, "energy_kcal": 2010, "protein_g": 55.5, "energy_note": "1,660 + 350 kcal"},
    {"group": "Women", "category": "Pregnant (3rd trimester)", "sex": "Female", "age_min": 18, "age_max": 50, "activity": "Life stage", "body_weight_kg": 65, "energy_kcal": 2010, "protein_g": 68.0, "energy_note": "1,660 + 350 kcal"},
    {"group": "Women", "category": "Lactation < 6 months", "sex": "Female", "age_min": 18, "age_max": 50, "activity": "Life stage", "body_weight_kg": 55, "energy_kcal": 2260, "protein_g": 63.0, "energy_note": "1,660 + 600 kcal"},
    {"group": "Women", "category": "Lactation 6–12 months", "sex": "Female", "age_min": 18, "age_max": 50, "activity": "Life stage", "body_weight_kg": 55, "energy_kcal": 2180, "protein_g": 59.0, "energy_note": "1,660 + 520 kcal"},
    {"group": "Infants", "category": "0–6 months", "sex": "Any", "age_min": 0, "age_max": 0, "activity": "Any", "body_weight_kg": 5.8, "energy_kcal": 530, "protein_g": 8.0},
    {"group": "Infants", "category": "6–12 months", "sex": "Any", "age_min": 1, "age_max": 1, "activity": "Any", "body_weight_kg": 8.5, "energy_kcal": 660, "protein_g": 10.5},
    {"group": "Children", "category": "1–3 years", "sex": "Any", "age_min": 1, "age_max": 3, "activity": "Any", "body_weight_kg": 12.9, "energy_kcal": 1110, "protein_g": 12.5},
    {"group": "Children", "category": "4–6 years", "sex": "Any", "age_min": 4, "age_max": 6, "activity": "Any", "body_weight_kg": 18.3, "energy_kcal": 1360, "protein_g": 16.0},
    {"group": "Children", "category": "7–9 years", "sex": "Any", "age_min": 7, "age_max": 9, "activity": "Any", "body_weight_kg": 25.3, "energy_kcal": 1700, "protein_g": 23.0},
    {"group": "Boys", "category": "10–12 years", "sex": "Male", "age_min": 10, "age_max": 12, "activity": "Any", "body_weight_kg": 34.9, "energy_kcal": 2220, "protein_g": 32.0},
    {"group": "Girls", "category": "10–12 years", "sex": "Female", "age_min": 10, "age_max": 12, "activity": "Any", "body_weight_kg": 36.4, "energy_kcal": 2060, "protein_g": 33.0},
    {"group": "Boys", "category": "13–15 years", "sex": "Male", "age_min": 13, "age_max": 15, "activity": "Any", "body_weight_kg": 50.5, "energy_kcal": 2860, "protein_g": 45.0},
    {"group": "Girls", "category": "13–15 years", "sex": "Female", "age_min": 13, "age_max": 15, "activity": "Any", "body_weight_kg": 49.6, "energy_kcal": 2400, "protein_g": 43.0},
    {"group": "Boys", "category": "16–18 years", "sex": "Male", "age_min": 16, "age_max": 18, "activity": "Any", "body_weight_kg": 64.4, "energy_kcal": 3320, "protein_g": 55.0},
    {"group": "Girls", "category": "16–18 years", "sex": "Female", "age_min": 16, "age_max": 18, "activity": "Any", "body_weight_kg": 55.7, "energy_kcal": 2500, "protein_g": 46.0},
]

LIFE_STAGES = ["Not pregnant", "Pregnant (2nd trimester)", "Pregnant (3rd trimester)", "Lactation < 6 months", "Lactation 6–12 months"]

FOOD_STRATEGY_OPTIONS = [
    "Low oil & low spice meals",
    "Low GI meals",
    "Low sodium meals",
    "High fibre meals",
    "High protein meals",
    "Easy to digest meals",
    "Gluten-free meals",
    "Dairy-free meals",
    "Jain meals",
    "Budget-friendly meals",
    "Travel-friendly meals",
    "Family-style meals",
]

OTHER_GOAL_OPTIONS = [
    "Weight: Fat burning",
    "Weight: Muscle gain",
    "Better energy",
    "Gut health",
    "Better sleep",
    "Improved blood parameters",
    "Immunity",
    "Skin and hair",
    "Hormonal balance",
]

NEXT_PHASE_OPTIONS = [
    "Easy recipes",
    "Maintenance plan",
    "Reverse diet",
    "Travel plan",
    "Festive plan",
    "Workout nutrition",
    "Maintain current plan",
]

SUPERFOODS: list[dict[str, Any]] = [
    {
        "name": "Paneer",
        "category": "Dairy",
        "panel": "Protein",
        "points": 2,
        "recommendation": "Paneer (Indian cottage cheese) is a vegetarian protein source. Pair it with fibre and watch the portion if dairy-sensitive.",
        "allergens": ["dairy"],
        "diet": ["vegetarian"],
    },
    {
        "name": "Almonds",
        "category": "Nuts & seeds",
        "panel": "Healthy fats",
        "points": 2,
        "recommendation": "Almonds provide protein, fibre, vitamin E, and magnesium. 8–10 soaked almonds is a practical portion.",
        "allergens": ["nuts"],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Flax seeds",
        "category": "Nuts & seeds",
        "panel": "Omega-3",
        "points": 2,
        "recommendation": "Ground flax provides ALA omega-3 and soluble fibre. Use 1 tsp daily and keep it refrigerated.",
        "allergens": ["seeds"],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Walnut",
        "category": "Nuts & seeds",
        "panel": "Omega-3",
        "points": 2,
        "recommendation": "Walnuts are rich in ALA omega-3. Two whole walnuts make a portion.",
        "allergens": ["nuts"],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Brazil nut",
        "category": "Nuts & seeds",
        "panel": "Selenium",
        "points": 1,
        "recommendation": "One Brazil nut covers the daily selenium need. Avoid exceeding one to two a day.",
        "allergens": ["nuts"],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Curd",
        "category": "Dairy",
        "panel": "Probiotics",
        "points": 2,
        "recommendation": "Unsweetened curd provides protein, calcium, and live cultures. Choose fresh, chilled curd.",
        "allergens": ["dairy"],
        "diet": ["vegetarian"],
    },
    {
        "name": "Chia seeds",
        "category": "Nuts & seeds",
        "panel": "Fibre",
        "points": 2,
        "recommendation": "Chia provides fibre and ALA. Soak 1 tsp before use and drink enough water.",
        "allergens": ["seeds"],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Moringa",
        "category": "Greens",
        "panel": "Micronutrients",
        "points": 1,
        "recommendation": "Moringa adds iron and vitamin A. Use 1 tsp in warm food, not as a supplement replacement.",
        "allergens": [],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Turmeric",
        "category": "Spices",
        "panel": "Anti-inflammatory",
        "points": 1,
        "recommendation": "Use culinary amounts with black pepper. High-dose curcumin needs clinician review.",
        "allergens": [],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Berries",
        "category": "Fruit",
        "panel": "Antioxidants",
        "points": 2,
        "recommendation": "Berries add antioxidants and fibre. Use a 100 g portion and prefer seasonal fruit.",
        "allergens": [],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Moong dal",
        "category": "Legumes",
        "panel": "Protein & fibre",
        "points": 3,
        "recommendation": "Moong dal is an easy-to-digest vegetarian protein and fibre base for most Indian meals.",
        "allergens": [],
        "diet": ["vegetarian", "vegan"],
    },
    {
        "name": "Sattu",
        "category": "Legumes",
        "panel": "Protein & fibre",
        "points": 1,
        "recommendation": "Roasted gram flour is a protein- and fibre-rich drink base. Mix with water and salt or lime.",
        "allergens": [],
        "diet": ["vegetarian", "vegan"],
    },
]

SUPPLEMENTS: list[dict[str, Any]] = [
    {"name": "Plant protein", "unit": "Scoop", "quantity": 1, "cal": 144, "pro": 24, "fat": 1, "carb": 10, "fibre": 0},
    {"name": "Whey protein", "unit": "Scoop", "quantity": 1, "cal": 120, "pro": 24, "fat": 1.5, "carb": 3, "fibre": 0},
    {"name": "Glutamine", "unit": "Scoop", "quantity": 1, "cal": 20, "pro": 5, "fat": 0, "carb": 0, "fibre": 0},
    {"name": "Vitamin D3", "unit": "ml", "quantity": 5, "cal": 0, "pro": 0, "fat": 0, "carb": 0, "fibre": 0},
    {"name": "Omega-3", "unit": "Capsule", "quantity": 1, "cal": 10, "pro": 0, "fat": 1, "carb": 0, "fibre": 0},
    {"name": "Magnesium", "unit": "Tablet", "quantity": 1, "cal": 0, "pro": 0, "fat": 0, "carb": 0, "fibre": 0},
    {"name": "Probiotic", "unit": "Capsule", "quantity": 1, "cal": 0, "pro": 0, "fat": 0, "carb": 0, "fibre": 0},
    {"name": "Multivitamin", "unit": "Tablet", "quantity": 1, "cal": 0, "pro": 0, "fat": 0, "carb": 0, "fibre": 0},
    {"name": "Calcium + D3", "unit": "Tablet", "quantity": 1, "cal": 0, "pro": 0, "fat": 0, "carb": 0, "fibre": 0},
    {"name": "Iron", "unit": "Tablet", "quantity": 1, "cal": 0, "pro": 0, "fat": 0, "carb": 0, "fibre": 0},
    {"name": "Vitamin B12", "unit": "Tablet", "quantity": 1, "cal": 0, "pro": 0, "fat": 0, "carb": 0, "fibre": 0},
    {"name": "GERD care", "unit": "Tablet", "quantity": 1, "cal": 2.28, "pro": 0.06, "fat": 0.1, "carb": 0.48, "fibre": 0},
]

MEDICATION_INTERACTION_RULES: list[dict[str, Any]] = [
    {
        "keywords": ["thyroxine", "levothyroxine", "thyronorm", "eltroxin", "thyroid"],
        "label": "Thyroid medication timing",
        "severity": "moderate",
        "message": "Calcium, iron, soy, and coffee reduce thyroid medication absorption.",
        "recommendation": "Take on an empty stomach 30–60 minutes before breakfast; separate calcium and iron by 4 hours.",
    },
    {
        "keywords": ["metformin", "glycomet", "glucophage"],
        "label": "Metformin and vitamin B12",
        "severity": "moderate",
        "message": "Long-term metformin can lower vitamin B12 status.",
        "recommendation": "Check B12 at least annually and supplement if low.",
    },
    {
        "keywords": ["calcium", "shelcal", "calcirol", "osteocal"],
        "label": "Calcium absorption conflicts",
        "severity": "moderate",
        "message": "Calcium reduces absorption of thyroid medication, iron, and some antibiotics.",
        "recommendation": "Separate calcium from thyroid medication and iron by 2–4 hours.",
    },
    {
        "keywords": ["iron", "ferrous", "ferritin", "orofer", "autrin"],
        "label": "Iron absorption",
        "severity": "moderate",
        "message": "Tea, coffee, calcium, and PPIs reduce iron absorption; vitamin C improves it.",
        "recommendation": "Take with vitamin C; separate tea and coffee by 1 hour, calcium by 2 hours.",
    },
    {
        "keywords": ["warfarin", "acitrom", "blood thinner"],
        "label": "Warfarin and vitamin K",
        "severity": "high",
        "message": "Large changes in vitamin K intake affect INR and bleeding risk.",
        "recommendation": "Keep green leafy vegetable portions consistent and monitor INR with the treating doctor.",
    },
    {
        "keywords": ["omeprazole", "pantoprazole", "rabeprazole", "esomeprazole", "ppi"],
        "label": "Long-term PPI use",
        "severity": "low",
        "message": "Long-term PPI use may reduce vitamin B12 and magnesium.",
        "recommendation": "Monitor B12 and magnesium if used for more than a year.",
    },
    {
        "keywords": ["prednisolone", "wysolone", "deflazacort", "corticosteroid", "budesonide"],
        "label": "Corticosteroid support",
        "severity": "moderate",
        "message": "Corticosteroids increase calcium loss and raise blood glucose.",
        "recommendation": "Ensure calcium and vitamin D; monitor glucose and sodium.",
    },
    {
        "keywords": ["telmisartan", "ramipril", "enalapril", "losartan", "olmesartan", "arb", "ace inhibitor"],
        "label": "Potassium with ACE inhibitors / ARBs",
        "severity": "moderate",
        "message": "ACE inhibitors and ARBs raise potassium; potassium-based salt substitutes add more.",
        "recommendation": "Avoid potassium-based salt substitutes and monitor potassium if kidney risk is present.",
    },
    {
        "keywords": ["diamox", "acetazolamide"],
        "label": "Acetazolamide and potassium",
        "severity": "low",
        "message": "Acetazolamide can lower potassium.",
        "recommendation": "Monitor potassium and include potassium-rich foods if appropriate.",
    },
    {
        "keywords": ["atorvastatin", "rosuvastatin", "simvastatin", "statin"],
        "label": "Statin and CoQ10",
        "severity": "low",
        "message": "Statin use may reduce CoQ10 status.",
        "recommendation": "Consider CoQ10 only if muscle symptoms occur; it is not routine.",
    },
    {
        "keywords": ["verapamil", "calaptin"],
        "label": "Verapamil and grapefruit",
        "severity": "low",
        "message": "Grapefruit juice can raise verapamil levels.",
        "recommendation": "Avoid grapefruit juice while taking verapamil.",
    },
    {
        "keywords": ["insulin", "glimepiride", "gliclazide", "glipizide", "sulfonylurea"],
        "label": "Hypoglycaemia risk",
        "severity": "high",
        "message": "Insulin and sulfonylureas can cause hypoglycaemia, especially with a low-calorie plan.",
        "recommendation": "Coordinate meal timing with the prescribing doctor and keep a fast-acting carbohydrate available.",
    },
]

CONDITION_RULES: list[dict[str, Any]] = [
    {
        "keywords": ["diabetes", "diabetic", "t2dm", "type 2"],
        "label": "Diabetes",
        "severity": "review",
        "message": "Coordinate carbohydrate distribution and hypoglycaemia risk with the treating doctor.",
    },
    {
        "keywords": ["hypertension", "high bp", "blood pressure"],
        "label": "Hypertension",
        "severity": "review",
        "message": "Keep sodium consistent and favour a DASH-style pattern.",
    },
    {
        "keywords": ["pcos", "pcod"],
        "label": "PCOS",
        "severity": "review",
        "message": "Prioritise fibre, protein, and low-GI carbohydrates; monitor insulin resistance.",
    },
    {
        "keywords": ["thyroid", "hypothyroid", "hyperthyroid"],
        "label": "Thyroid",
        "severity": "review",
        "message": "Separate thyroid medication from calcium, iron, and soy; recheck thyroid function as advised.",
    },
    {
        "keywords": ["kidney", "renal", "ckd", "nephro"],
        "label": "Kidney disease",
        "severity": "high",
        "message": "Protein, potassium, phosphorus, and fluid targets need nephrology oversight.",
    },
    {
        "keywords": ["cardiac", "heart", "psvt", "arrhythmia", "coronary"],
        "label": "Cardiac condition",
        "severity": "high",
        "message": "Sodium, fluid, and exercise guidance need cardiology oversight.",
    },
    {
        "keywords": ["pregnan", "lactat", "breastfeed"],
        "label": "Pregnancy / lactation",
        "severity": "high",
        "message": "No calorie deficit without obstetric review; add pregnancy/lactation RDA allowances.",
    },
    {
        "keywords": ["eating disorder", "anorexia", "bulimia", "binge"],
        "label": "Eating disorder history",
        "severity": "high",
        "message": "Weight-focused plans need specialist psychological support.",
    },
    {
        "keywords": ["cancer", "oncology", "chemotherapy"],
        "label": "Cancer treatment",
        "severity": "high",
        "message": "Energy and protein needs change during treatment; coordinate with the oncology team.",
    },
    {
        "keywords": ["liver", "hepatic", "cirrhosis", "fatty liver"],
        "label": "Liver condition",
        "severity": "high",
        "message": "Protein, sodium, and fluid guidance need hepatology oversight.",
    },
    {
        "keywords": ["anemia", "anaemia", "iron deficiency"],
        "label": "Anaemia",
        "severity": "review",
        "message": "Pair iron-rich foods with vitamin C and recheck iron studies.",
    },
    {
        "keywords": ["migraine"],
        "label": "Migraine",
        "severity": "review",
        "message": "Keep meal timing regular and watch for personal trigger foods.",
    },
    {
        "keywords": ["reflux", "gerd", "acidity", "acid"],
        "label": "Acid reflux",
        "severity": "review",
        "message": "Prefer smaller, lower-fat meals and avoid late dinners.",
    },
    {
        "keywords": ["asthma"],
        "label": "Asthma",
        "severity": "review",
        "message": "Maintain a consistent, nutrient-dense pattern; no diet replaces controller medication.",
    },
]

ALLERGEN_LABELS = {
    "dairy": "Milk / dairy",
    "nuts": "Nuts",
    "seeds": "Seeds",
    "gluten": "Gluten",
    "soy": "Soy",
    "egg": "Egg",
    "seafood": "Seafood",
}

FORMULA_NOTES: dict[str, str] = {
    "bmi": "BMI = weight (kg) ÷ height (m)². Categories use Asian-Indian cut-offs: under 18.5, normal 18.5–22.9, overweight 23–24.9, obese 25+.",
    "katch": "Katch-McArdle: fat mass = weight × body-fat % ÷ 100; fat-free mass = weight − fat mass; BMR = 370 + (21.6 × fat-free mass); calorie requirement = BMR × activity factor. Used when a body-fat reading exists.",
    "mifflin": "Mifflin-St Jeor fallback: BMR = (10 × weight) + (6.25 × height) − (5 × age) + 5 for men or − 161 for women.",
    "tdee": "TDEE = BMR × activity factor: sedentary 1.2, light 1.375, moderate 1.55, very active 1.725, athlete 1.9.",
    "thumb": "Thumb rule calories = target weight × activity factor, plus an optional workout allowance, rounded to the nearest 100 kcal. Factors by goal: loss 20/25/30, maintenance 25/30/35, gain 30/35/40 kcal/kg for sedentary/moderate/heavy activity.",
    "rda": "RDA mode uses the ICMR-NIN 2020 Recommended Dietary Allowances, the latest RDA edition (the 2024 Dietary Guidelines for Indians are food-based guidance, not a replacement RDA table). Energy values are estimated energy requirements; protein is the RDA at the reference body weight. The table is shown in the RDA dialog.",
    "macro": "Macro grams = calories × ratio % ÷ 4 for carbohydrate and protein, ÷ 9 for fat. Grams are rounded down to whole numbers, matching the practice reference table.",
    "protein": "Protein target is a clinical guardrail in g/kg of target body weight. The ratio sets the planned protein; the guardrail checks whether the plan lands inside the selected range.",
    "ideal_weight": "Devine: 45.5 kg (women) or 50 kg (men) at 5 ft, plus 2.3 kg per inch above 5 ft. BMI 22: 22 × height (m)².",
    "calorie_floor": "Very-low-calorie plans need clinical justification. NutriAlign warns below 1,200 kcal for women and 1,500 kcal for men, and blocks a deficit for children or pregnancy.",
}

RDA_EDITION = "ICMR-NIN 2020"

REFERENCE: dict[str, Any] = {
    "diets": DIETS,
    "patient_types": PATIENT_TYPES,
    "major_goals": MAJOR_GOALS,
    "goal_modes": GOAL_MODES,
    "activity_levels": ACTIVITY_LEVELS,
    "thumb_factors": THUMB_FACTORS,
    "protein_targets": PROTEIN_TARGETS,
    "default_protein_targets": DEFAULT_PROTEIN_TARGET,
    "ideal_weight_methods": IDEAL_WEIGHT_METHODS,
    "life_stages": LIFE_STAGES,
    "rda_rows": RDA_ROWS,
    "rda_edition": RDA_EDITION,
    "food_strategy_options": FOOD_STRATEGY_OPTIONS,
    "other_goal_options": OTHER_GOAL_OPTIONS,
    "next_phase_options": NEXT_PHASE_OPTIONS,
    "superfoods": SUPERFOODS,
    "supplements": SUPPLEMENTS,
    "interaction_rules": [
        {"label": rule["label"], "severity": rule["severity"], "message": rule["message"]}
        for rule in MEDICATION_INTERACTION_RULES
    ],
    "formula_notes": FORMULA_NOTES,
}
