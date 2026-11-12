from __future__ import annotations

from typing import Any


YES_NO = ["Yes", "No"]
YES_NO_UNSURE = ["Yes", "No", "Not sure"]
GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"]
DIETS = ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan", "Jain"]
SOURCES = ["Website", "Referral", "Instagram", "Walk-in", "Quantrition.in", "Other"]
CUISINES = ["North Indian", "South Indian", "Gujarati", "Punjabi", "Maharashtrian", "Bengali", "Mixed Indian", "Other"]
MEAL_TIMES = ["Before breakfast", "With breakfast", "After breakfast", "Before lunch", "With lunch", "After lunch", "Evening", "Before dinner", "With dinner", "Bedtime", "SOS"]
MEALS = ["On waking up", "Early morning", "Breakfast", "Mid-morning", "Lunch", "Evening snack", "Dinner", "Post dinner", "Bedtime"]
FREQUENCIES = ["Once daily", "Twice daily", "Thrice daily", "Weekly", "Monthly", "SOS"]
RELATIONSHIPS = ["Father", "Mother", "Sibling", "Grandparent", "Aunt / Uncle", "Other"]
GRADES = ["1", "2", "3", "4", "5"]
CONDITIONS = [
    "Diabetes", "Hypertension (High BP)", "PCOS", "Thyroid", "Migraine", "Acid reflux",
    "Low immunity", "Low appetite", "Knee pain", "Osteoarthritis", "Anaemia", "Asthma", "Other",
]
SURGERIES = ["Tonsillectomy", "Appendectomy", "Hysterectomy", "C-section", "Knee replacement", "Other"]
FAMILY_CONDITIONS = ["Heart problem", "Type 2 diabetes", "Breast cancer", "Osteoarthritis", "Hypertension", "Thyroid", "Hypothyroidism", "Other"]
RESTRICTIONS = ["None", "Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Low sugar", "Low salt"]
CRAVINGS = ["Sweet", "Salty", "Fried", "Tea / coffee", "Late-night", "Weekend overeating", "None"]
EXERCISE = ["Walking", "Gym", "Yoga", "Running", "Cycling", "Sports", "None"]
DRINKS = ["Water", "Tea", "Coffee", "Soft drinks", "Energy drinks", "Alcohol", "None"]
WATER = ["< 1 litre", "1–2 litres", "2–3 litres", "3+ litres"]
HABITS = ["Never", "Rarely", "Sometimes", "Often", "Always"]
EATING_HABITS = ["Very clean", "Moderate", "Irregular", "Erratic", "Other"]
EATING_PATTERNS = ["None", "Intermittent fasting", "OMAD", "Frequent snacking", "Skipping breakfast", "Other"]
HEALTH_TRACKING = ["Yes, I track my meals, workouts, or habits", "Sometimes", "No"]
PORTION_HABITS = ["Small portions", "Moderate portions", "Large portions", "Varies", "No fixed pattern"]
EATING_OUT = ["Rarely", "1–2 times a week", "3–4 times a week", "Daily", "Multiple times a day"]
SHOPPING = ["Weekly", "Fortnightly", "Monthly", "Daily", "Online", "Mixed"]
COMFORT = ["Very comfortable", "Comfortable", "Neutral", "Not comfortable", "Cannot cook"]
EXCESS_DEVIATION = [
    "Sweets / desserts", "Fried food", "Salty snacks", "Large portions", "Late-night eating",
    "Frequent snacking", "Alcohol", "Other",
]
START_DAY = ["Slowly and gradually", "In a rush", "After tea / coffee", "After a workout", "Varies", "Other"]
WAKE_ACTIONS = [
    "Tea / coffee within 15 min", "Breakfast within 30 min", "Breakfast after 1 hour",
    "Exercise within 30 min", "Screen / phone within 15 min", "Medication on waking", "Nothing specific",
]
SCREEN_HOURS = ["Less than 2 hours", "2–4 hours", "4–6 hours", "6–8 hours", "More than 8 hours"]
DAILY_ACTIVITY = ["Mostly sitting", "Light movement", "Walking", "Standing", "Physical labour", "Structured exercise"]
ENERGY_LEVELS = ["Low", "Moderate", "High", "Varies"]
TIMES_OF_DAY = ["Morning", "Afternoon", "Evening", "Night", "Varies"]
DRAINED_TIMES = ["On waking", "Morning", "Afternoon", "Evening", "Night", "Varies"]
BLOOD_CATEGORIES = [
    "Complete Blood Count", "Lipid Profile", "Liver Function", "Kidney Function", "Thyroid",
    "Diabetes", "Vitamins & Minerals", "Hormones", "Inflammatory Markers", "Other",
]


def field(
    field_id: str,
    label: str,
    field_type: str = "text",
    *,
    options: list[str] | None = None,
    required: bool = False,
    span: int = 1,
    placeholder: str = "",
    help_text: str = "",
    read_only: bool = False,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": field_id,
        "label": label,
        "type": field_type,
        "required": required,
        "span": span,
        "placeholder": placeholder,
        "help": help_text,
    }
    if options:
        data["options"] = options
    if read_only:
        data["read_only"] = True
    return data


def section(section_id: str, label: str, help_text: str = "") -> dict[str, Any]:
    return {"id": section_id, "label": label, "type": "section", "span": 3, "help": help_text, "required": False}


def column(
    column_id: str,
    label: str,
    field_type: str = "text",
    *,
    options: list[str] | None = None,
    placeholder: str = "",
    width: int = 160,
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": column_id,
        "label": label,
        "type": field_type,
        "placeholder": placeholder,
        "width": width,
    }
    if options:
        data["options"] = options
    return data


def repeatable(
    field_id: str,
    label: str,
    columns: list[dict[str, Any]],
    *,
    add_label: str = "Add row",
    help_text: str = "",
) -> dict[str, Any]:
    return {
        "id": field_id,
        "label": label,
        "type": "repeatable",
        "required": False,
        "span": 3,
        "add_label": add_label,
        "columns": columns,
        "help": help_text,
    }


BASIC_FIELDS = [
    section("identity", "Identity"),
    field("name", "Full name", placeholder="e.g. Aarti Mehta"),
    field("phone", "Primary phone", placeholder="+91 98765 43210"),
    field("email", "Email", field_type="text", placeholder="name@example.com"),
    field("city", "City", placeholder="e.g. Mumbai"),
    field("gender", "Gender", field_type="select", options=GENDERS),
    field("dob", "Date of birth", field_type="date"),
    field("blood_group", "Blood group", field_type="select", options=["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−", "Unknown"]),
    field("marital_status", "Marital status", field_type="select", options=["Single", "Married", "Divorced", "Widowed", "Prefer not to say"]),
    field("address", "Address", span=2, placeholder="Building, street, area"),
    field("pincode", "Pincode", placeholder="e.g. 400006"),
    field("occupation", "Occupation", span=2, placeholder="e.g. Student and business — finance"),
    field("sports", "Sports and training history", field_type="textarea", span=3, placeholder="Sports, timelines, current routine"),
    section("program", "Program"),
    field("start_date", "Program start date", field_type="date"),
    field("end_date", "Program end date", field_type="date"),
    section("preferences", "Profile"),
    field("source", "Source / referral", field_type="select", options=SOURCES),
    field("notes", "Notes", field_type="textarea", span=3, placeholder="Anything useful for the first conversation"),
    field("consent", "Consent to store and contact", field_type="checkbox"),
]

BCA_FIELDS = [
    section("measurement", "Measurement date", "The date these readings were taken."),
    field("measurement_date", "Date of measurement", field_type="date"),
    section("basic_info", "Basic info"),
    field("height_ft", "Height (ft)", field_type="number", placeholder="e.g. 4"),
    field("height_in", "Height (inch)", field_type="number", placeholder="e.g. 10"),
    field("height_cm", "Height (cm)", field_type="number", placeholder="e.g. 147.32"),
    field("weight_kg", "Weight (kg)", field_type="number", placeholder="e.g. 55.9"),
    field("weight_lbs", "Weight (lbs)", field_type="number", placeholder="e.g. 123.24"),
    field(
        "bmi",
        "BMI (kg/m²)",
        field_type="number",
        read_only=True,
        placeholder="—",
        help_text="Calculated live from height and weight.",
    ),
    section("body_info", "Body composition"),
    field("body_fat_pct", "Body fat (%)", field_type="number"),
    field("fat_mass_kg", "Fat mass (kg)", field_type="number"),
    field("muscle_mass_kg", "Muscle mass (kg)", field_type="number"),
    field("visceral_fat", "Visceral fat index", field_type="number"),
    field("resting_metabolism", "Resting metabolism (kcal)", field_type="number"),
    field("biological_age", "Metabolic body age", field_type="number"),
    field("total_subcut_fat_pct", "Total subcutaneous fat (%)", field_type="number"),
    field("subcut_fat_trunk_pct", "Subcutaneous fat – trunk (%)", field_type="number"),
    field("subcut_fat_arms_pct", "Subcutaneous fat – arms (%)", field_type="number"),
    field("subcut_fat_legs_pct", "Subcutaneous fat – legs (%)", field_type="number"),
    field("total_skeletal_muscle_pct", "Total skeletal muscle (%)", field_type="number"),
    field("skeletal_muscle_trunk_pct", "Skeletal muscle – trunk (%)", field_type="number"),
    field("skeletal_muscle_arms_pct", "Skeletal muscle – arms (%)", field_type="number"),
    field("skeletal_muscle_legs_pct", "Skeletal muscle – legs (%)", field_type="number"),
    field("water_weight_kg", "Water weight (kg)", field_type="number"),
    field("bone_weight_kg", "Bone weight (kg)", field_type="number"),
    field("fat_free_mass_kg", "Fat-free mass (kg)", field_type="number"),
    section(
        "measurements",
        "Measurements",
        "Waist-to-hip ratio (WHR) = waist circumference ÷ hip circumference, measured at the narrowest "
        "part of the waist and the widest part of the hips using the same unit (cm or inches).",
    ),
    field("waist_in", "Waist (inches)", field_type="number"),
    field("waist_cm", "Waist (cm)", field_type="number"),
    field("hip_in", "Hip (inches)", field_type="number"),
    field("hip_cm", "Hip (cm)", field_type="number"),
    field("neck_in", "Neck (inches)", field_type="number"),
    field("neck_cm", "Neck (cm)", field_type="number"),
    field(
        "waist_hip_ratio",
        "Waist-to-hip ratio",
        field_type="number",
        read_only=True,
        placeholder="—",
        help_text="Calculated from waist and hip measurements.",
    ),
    field(
        "body_shape_type",
        "Body shape type",
        field_type="select",
        options=["Apple", "Pear", "Hourglass", "Rectangle", "Inverted triangle", "Athletic", "Other"],
    ),
    section("assessment_notes", "Assessment notes"),
    field("notes", "Assessment notes", field_type="textarea", span=3),
]

MEDICAL_FIELDS = [
    section("goals", "Goals and fitness"),
    field("primary_goal", "Primary goal", field_type="select", options=["Medical condition", "Weight loss", "Fat loss", "Better energy", "Muscle gain", "Maintenance", "Sports performance"]),
    field("fitness_goal", "Primary fitness goal", field_type="select", options=["Muscle gain", "Fat loss", "Endurance", "Mobility", "General fitness", "None"]),
    field("specific_areas", "Specific areas to improve", field_type="textarea", span=3, placeholder="e.g. Gut health, diabetic management, migraine, hypertension"),
    field("activity_level", "Activity level", field_type="select", options=["Low", "Light", "Moderate", "High", "Athlete"]),
    field("health_goals", "Health goals", field_type="multiselect", span=3, options=["Weight loss", "Improving energy", "Improve eating habits", "Improve sleep pattern", "Improve blood parameters", "Muscle gain", "General health"]),
    section("clinical_history", "Clinical history", "Rows save independently. Only the condition name is needed for a new row."),
    repeatable(
        "conditions",
        "Medical conditions",
        [
            column("disease", "Condition", "select", options=CONDITIONS, width=210),
            column("since", "Since (year)", "text", placeholder="2016 or 20 years back", width=170),
            column("severity", "Severity", "text", placeholder="e.g. mild", width=150),
            column("frequency", "Frequency", "text", placeholder="e.g. on medication", width=170),
            column("grading", "Grading", "select", options=GRADES, width=110),
        ],
        add_label="Add condition",
    ),
    repeatable(
        "surgeries",
        "Surgery history",
        [
            column("name", "Surgery", "select", options=SURGERIES, width=230),
            column("when", "When (year)", "text", placeholder="School days, 2007", width=190),
            column("comments", "Comments", "text", placeholder="Optional note", width=260),
        ],
        add_label="Add surgery",
    ),
    repeatable(
        "family",
        "Family history",
        [
            column("disease", "Condition", "select", options=FAMILY_CONDITIONS, width=230),
            column("relationship", "Relationship", "select", options=RELATIONSHIPS, width=190),
            column("details", "Details", "text", placeholder="Optional details", width=260),
        ],
        add_label="Add family entry",
    ),
    section("screening", "Screening"),
    field("cancer", "Cancer diagnosis or treatment", field_type="select", options=YES_NO),
    field("blood_pressure", "Blood pressure", placeholder="e.g. 120/80"),
    field("energy", "Energy levels (fatigue, weakness)", field_type="select", options=YES_NO_UNSURE),
    field("recurrent_infections", "Recurrent infections in last 6–12 months", field_type="select", options=YES_NO_UNSURE),
    field("screening_notes", "Screening notes", field_type="textarea", span=3),
]

DIETARY_FIELDS = [
    section("preferences", "Food preferences"),
    field("food_preference", "Food preference", field_type="select", options=DIETS),
    field("restrictions", "Dietary restrictions / food choices", field_type="multiselect", options=RESTRICTIONS),
    field("cuisine", "Cuisine preference for the plan", field_type="multiselect", span=2, options=CUISINES),
    field("favorite_foods", "Favourite foods", field_type="textarea", span=2, placeholder="One per line"),
    field("avoid_foods", "Foods to avoid", field_type="textarea", span=2, placeholder="One per line"),
    field("allergies", "Food allergies", field_type="multiselect", options=["None", "Milk / dairy", "Gluten", "Nuts", "Soy", "Egg", "Seafood"]),
    field("intolerances", "Food intolerances / sensitivities", field_type="multiselect", options=["None", "Lactose", "Gluten", "Nuts", "Soy", "Other"]),
    field("lactose_intolerance", "Lactose intolerance", field_type="select", options=YES_NO_UNSURE),
    field("gluten_sensitivity", "Gluten sensitivity", field_type="select", options=YES_NO_UNSURE),
    field("meal_prep_help", "Household help for meals", placeholder="e.g. house help, Sep"),
    field("oils", "Oils used in meal prep", field_type="text", span=2, placeholder="e.g. ghee, rice bran, olive, mustard"),
    field("travel_plans", "Travel plans", field_type="textarea", span=2, placeholder="No, or destination and dates"),
    section("workout_section", "Training and workout schedule"),
    repeatable(
        "workout_schedule",
        "Workout / training",
        [
            column("weekday", "Week day", "text", placeholder="MWF / TTS", width=140),
            column("from", "From", "time", width=100),
            column("to", "To", "time", width=100),
            column("activity", "Activity", "text", placeholder="Gym / MMA", width=160),
            column("notes", "Notes", "text", placeholder="Optional", width=220),
        ],
        add_label="Add workout",
    ),
    section("schedule_section", "Weekly schedule", "Add only the rows that matter."),
    repeatable(
        "schedule",
        "Sleep and work timing",
        [
            column("weekday", "Week day", "text", placeholder="Monday–Sunday", width=150),
            column("sleep_from", "Sleep from", "time", width=110),
            column("wake_at", "Wake up at", "time", width=110),
            column("work_from", "Work from", "time", width=110),
            column("work_to", "Work to", "time", width=110),
        ],
        add_label="Add timing row",
    ),
    section("medications_section", "Medications and supplements"),
    repeatable(
        "medications",
        "Current medications",
        [
            column("name", "Medication", "text", width=210),
            column("dosage", "Dosage", "text", width=100),
            column("frequency", "Frequency", "select", options=FREQUENCIES, width=140),
            column("meal_time", "Meal time", "select", options=MEAL_TIMES, width=160),
            column("since", "Taking since", "date", width=130),
        ],
        add_label="Add medication",
    ),
    repeatable(
        "supplements",
        "Current supplements",
        [
            column("name", "Supplement", "text", width=220),
            column("dosage", "Dosage", "text", width=110),
            column("frequency", "Frequency", "select", options=FREQUENCIES, width=150),
        ],
        add_label="Add supplement",
    ),
]

RECALL_FIELDS = [
    section("recall", "24hr recall", "Every field is optional. Add one row for each meal or drink."),
    field("recall_date", "Recall date", field_type="date"),
    repeatable(
        "meals",
        "Meals and drinks",
        [
            column("meal", "Meal", "select", options=MEALS, width=190),
            column("time", "Time", "time", width=120),
            column("quantity", "Meal and quantity", "textarea", placeholder="Food, portion, preparation", width=480),
        ],
        add_label="Add meal",
    ),
    field("recall_notes", "Recall notes", field_type="textarea", span=3),
]

FUV_FIELDS = [
    section("visit", "Follow-up visit"),
    field("visit_date", "Follow-up visit date", field_type="date"),
    field("updates", "Updates (general / medical)", field_type="textarea", span=3),
    field("positive_changes", "Positive changes", field_type="textarea", span=3),
    field("areas_to_work", "Areas to work on", field_type="textarea", span=3),
    field("suggestions", "Suggestions / discussion points", field_type="textarea", span=3),
    field("food_requests", "Food requests for next plan", field_type="textarea", span=3),
    field("schedule_changes", "Schedule changes", field_type="textarea", span=3),
    field("travel", "Travel planned in next 4–5 weeks", field_type="textarea", span=3),
    field("other_notes", "Other notes", field_type="textarea", span=3, placeholder="e.g. blood test discussed"),
]

FORMS_FIELDS = [
    section("eating", "Food habits and behaviour", "The dietician intake form. Every field is optional."),
    field("consulted", "Consulted a nutritionist / dietician", field_type="select", options=YES_NO),
    field("eating_habits", "Eating habits", field_type="select", options=EATING_HABITS),
    field("tracking", "Track / monitor health habits", field_type="select", options=HEALTH_TRACKING),
    field("diet_plan", "Specific dietary plan or lifestyle", field_type="select", options=YES_NO),
    field("eating_patterns", "Eating patterns", field_type="select", options=EATING_PATTERNS),
    field("emotional_eater", "Emotional eater / eat under stress", field_type="select", options=YES_NO),
    field("portion_habits", "Habits around meal portion sizes", field_type="select", options=PORTION_HABITS),
    field("eating_out", "Eat outside home (restaurants, takeout, fast food)", field_type="select", options=EATING_OUT),
    field("excess_deviation", "Type of excess or deviation most often", field_type="multiselect", span=2, options=EXCESS_DEVIATION),
    field("food_discomfort", "Foods causing discomfort or digestive issues", field_type="select", options=YES_NO),
    field("health_impact_habits", "Habits impacting health (positive or negative)", field_type="textarea", span=3),
    field("dietary_share", "Anything else about dietary habits or preferences", field_type="textarea", span=3),
    section("cravings_section", "Cravings and behaviours"),
    field("cravings", "Specific food cravings", field_type="multiselect", options=CRAVINGS),
    field("exercise", "Exercise / activity type", field_type="multiselect", options=EXERCISE),
    field("alcohol", "Alcohol", field_type="select", options=HABITS),
    field("smoking", "Smoking", field_type="select", options=HABITS),
    field("vaping", "Vaping", field_type="select", options=HABITS),
    field("drugs", "Recreational / hard drugs", field_type="select", options=YES_NO),
    field("second_hand_smoke", "Second-hand smoke exposure", field_type="select", options=HABITS),
    section("daily_rhythm", "Daily rhythm and energy"),
    field("start_day", "How you usually start your day", field_type="select", options=START_DAY),
    field("wake_actions", "How soon after waking you do the following", field_type="multiselect", span=2, options=WAKE_ACTIONS),
    field("screen_hours", "Average screen time per day", field_type="select", options=SCREEN_HOURS),
    field("daily_activity_time", "Typical daily activity", field_type="multiselect", options=DAILY_ACTIVITY),
    field("energy_levels", "Overall energy levels through the day", field_type="select", options=ENERGY_LEVELS),
    field("energetic_time", "When you feel most energetic", field_type="select", options=TIMES_OF_DAY),
    field("drained_time", "When you typically feel drained or fatigued", field_type="select", options=DRAINED_TIMES),
    field("midday_crash", "Mid-day crash / sleepiness after meals", field_type="textarea", span=3),
    section("hydration", "Hydration and household"),
    field("water_intake", "Water per day", field_type="select", options=WATER),
    field("regular_drinks", "Regular drinks", field_type="multiselect", options=DRINKS),
    field("grocery_shopper", "Grocery shopper", field_type="select", options=["Self", "Partner", "Parent", "Household help", "Shared"]),
    field("menu_decider", "Menu decider", field_type="select", options=["Self", "Partner", "Parent", "Household help", "Shared"]),
    field("shopping_style", "Food shopping style", field_type="select", options=SHOPPING),
    field("meal_prep_comfort", "Meal preparation comfort", field_type="select", options=COMFORT),
    field("new_foods", "Open to trying new foods or recipes", field_type="select", options=YES_NO),
    section(
        "food_frequency_section",
        "Weekly food frequency",
        "Optional. Add each food or drink and how many times per week it is consumed (0 = never, 7 = daily).",
    ),
    repeatable(
        "food_frequency",
        "Food frequency",
        [
            column("food", "Food / drink", "text", placeholder="e.g. Tea", width=220),
            column("times_per_week", "Times per week (0–7)", "number", width=150),
            column("notes", "Notes", "text", width=260),
        ],
        add_label="Add food",
    ),
]

def system_block(slug: str, label: str, findings: list[str], help_text: str = "", extras: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    return [
        section(f"htt_{slug}", label, help_text or "Select Yes to reveal findings for this system."),
        field(f"htt_{slug}_gate", "Any concerns in this system?", field_type="select", options=YES_NO),
        *(extras or []),
        field(f"htt_{slug}_findings", "Findings", field_type="multiselect", span=3, options=findings),
        field(f"htt_{slug}_other", "Other finding", span=2, placeholder="Add anything not listed"),
        field(f"htt_{slug}_notes", "Notes", field_type="textarea", span=3, placeholder="Context, duration, triggers, or details"),
    ]


HEADTOE_FIELDS: list[dict[str, Any]] = [
    section("htt_intro", "Head-to-Toe assessment", "One optional card per body system. Select Yes to reveal findings, then add any unlisted value."),
    field("htt_date", "Assessment date", field_type="date"),
    field("htt_summary", "Overall summary", field_type="textarea", span=3),
]
HEADTOE_FIELDS += system_block("head_neck", "Head & Neck", [
    "Headache", "Migraine", "Dry eyes", "Eye strain", "Vision changes", "Ear pain", "Hearing difficulty",
    "Running nose", "Sinus", "Sore throat", "Dental issues", "Dizziness", "Vertigo",
])
HEADTOE_FIELDS += system_block("chest_lungs", "Chest & Lungs", [
    "Breathlessness", "Wheezing", "Dry cough", "Productive cough", "Cough after desserts", "Chest tightness",
    "Recurrent cold",
])
HEADTOE_FIELDS += system_block("heart", "Heart & Circulatory", [
    "Palpitations", "Chest pain", "Swelling in feet or ankles", "Cold extremities", "Low BP", "High BP",
    "Dizziness on standing", "Varicose veins",
])
HEADTOE_FIELDS += system_block("digestive", "Digestive System", [
    "Reflux / heartburn", "Unusual burping", "Abdominal pain after eating", "Bloating", "Flatulence", "Appetite change",
    "Constipation", "Loose stools / diarrhea", "Alternating constipation and loose stools", "Undigested food in stool",
    "Blood or mucus in stool", "Piles / hemorrhoids", "H. pylori", "SIBO", "Candida / parasites", "IBS", "IBD",
    "Gallbladder removal",
], extras=[
    field("htt_digestive_bloating", "Bloating frequency", field_type="select", options=["Never", "Occasionally", "Sometimes", "Often", "Always"]),
    field("htt_digestive_bristol", "Bristol stool type", field_type="select", options=[str(i) for i in range(1, 8)]),
    field("htt_digestive_scope", "GI procedure history", field_type="select", options=["None", "Endoscopy", "Colonoscopy", "Both"]),
    field("htt_digestive_organ", "Liver / pancreas / gallbladder history", field_type="select", options=YES_NO),
])
HEADTOE_FIELDS += system_block("musculoskeletal", "Musculoskeletal", [
    "Neck pain", "Back pain (upper)", "Back pain (lower)", "Shoulder pain", "Hip pain", "Knee pain", "Ankle pain",
    "Joint pain", "Stiffness", "Muscle aches", "Muscle cramps", "Difficulty in movement", "Diagnosed joint condition",
    "Muscle soreness / DOMS",
])
HEADTOE_FIELDS += system_block("skin", "Skin, Hair & Nails", [
    "Acne", "Eczema", "Psoriasis", "Autoimmune skin disease", "Itchiness",
    "Dark patches / white spots / pigmentation", "Easy bruising / bleeding", "Hair thinning", "Hair fall",
    "Dandruff / seborrhoeic dermatitis", "Nail breakage / lines / discoloration", "Rashes",
], extras=[
    field("htt_skin_type", "Skin type", field_type="select", options=["Dry", "Oily", "Normal", "Combination"]),
])
HEADTOE_FIELDS += system_block("urinary", "Urinary System", [
    "Increased frequency / urgency", "Pain / burning while urination", "Urinary incontinence", "Blood in urine",
    "Incomplete urination / leaking", "Kidney stones history", "UTI history",
], extras=[
    field("htt_urinary_night", "Night urination", field_type="select", options=["No", "Once", "Twice", "More than twice"]),
    field("htt_urinary_urine", "Urine colour / clarity", field_type="select", options=["Normal", "Dark", "Cloudy", "Blood-tinged"]),
    field("htt_urinary_retention", "Urinary retention", field_type="select", options=YES_NO),
])
HEADTOE_FIELDS += system_block("reproductive", "Reproductive System", [
    "PMS symptoms", "Menopause / perimenopause", "Hot flashes", "Night sweats", "Vaginal dryness",
    "Facial / excessive body hair", "Hormonal medicine use", "Hormone replacement therapy", "Fertility concerns",
], extras=[
    field("htt_reproductive_cycle", "Cycle regularity", field_type="select", options=["Clockwork", "Regular", "Irregular", "Menopause"]),
    field("htt_reproductive_flow", "Menstrual flow", field_type="multiselect", options=["Painful periods", "Heavy bleeding", "Normal"]),
    field("htt_reproductive_conditions", "Reproductive conditions", field_type="multiselect", options=["PCOS", "Endometriosis", "Fibroids", "Prolapse", "Other", "None"]),
    field("htt_reproductive_contraception", "Contraception", field_type="select", options=["None", "Oral pills", "IUD", "Implant", "Barrier", "Other"]),
    field("htt_reproductive_surgery", "Reproductive surgery history", field_type="select", options=YES_NO),
])
HEADTOE_FIELDS += system_block("energy_mood", "Energy, Mood & Mental Health", [
    "Low energy", "Fatigue", "Brain fog", "Memory issues", "Poor focus / concentration",
    "Low mood", "Loss of interest", "Irritability", "Depression diagnosis", "Bipolar diagnosis", "ADHD diagnosis",
], extras=[
    field("htt_energy_anxiety", "Anxiety / stress level", field_type="select", options=["0 – None", "1 – Very low", "2 – Mild", "3 – Moderate", "4 – High", "5 – Very high"]),
    field("htt_energy_treatment", "Current mental health support", field_type="select", options=["None", "Therapy / counselling", "Medication", "Both", "Prefer not to say"]),
    field("htt_energy_impact", "Impact on daily life", field_type="select", options=["No impact", "Mild", "Moderate", "Severe"]),
])
HEADTOE_FIELDS += system_block("sleep", "Sleep Related", [
    "Difficulty falling asleep", "Staying asleep", "Waking up too early", "Non-restorative sleep", "Daytime sleepiness",
    "Need caffeine", "Snoring", "Breathing issues during sleep / sleep apnea",
], extras=[
    field("htt_sleep_hours", "Average hours of sleep", field_type="select", options=["0–4 hours", "4–6 hours", "6–8 hours", "More than 8 hours"]),
    field("htt_sleep_quality", "Sleep quality", field_type="select", options=["Good", "Poor", "Average"]),
])
HEADTOE_FIELDS += system_block("endocrine", "Endocrine & Metabolic Health", [
    "Slow metabolism", "Water retention", "Puffiness of face", "Excessive thirst or frequent urination", "Excess sweating",
    "Rapid heartbeat", "Unexpected weight change", "Temperature intolerance",
], extras=[
    field("htt_endocrine_temperature", "Temperature intolerance", field_type="select", options=["None", "Heat intolerance", "Cold intolerance", "Both"]),
    field("htt_endocrine_appetite", "Appetite change", field_type="select", options=["Normal", "Increased", "Decreased"]),
])
HEADTOE_FIELDS += system_block("pregnancy", "Pregnancy / Lactation Related", [
    "Postpartum symptoms", "Hemorrhage / infection", "Urinary incontinence", "Diastasis recti", "Back pain",
    "Hip / joint pain", "Low milk supply", "Thyroid changes", "BP changes", "Blood sugar changes",
    "Postpartum depression", "Postpartum anxiety", "Nutritional deficiencies",
])

BLOOD_FIELDS = [
    section("report", "Blood report", "Add the report date and lab, then each parameter with its value and reference range."),
    field("report_date", "Report date", field_type="date"),
    field("report_lab", "Lab name", placeholder="e.g. Pathology Lab"),
    field("report_notes", "Report notes", field_type="textarea", span=3, placeholder="Fasting status, clinical context, or anything else"),
    section("parameters_section", "Parameters", "Flag each value as Low, High, or Critical to surface it in the deranged summary."),
    repeatable(
        "parameters",
        "Blood parameters",
        [
            column("category", "Category", "select", options=BLOOD_CATEGORIES, width=140),
            column("test_name", "Test name", "text", placeholder="e.g. Haemoglobin", width=150),
            column("value", "Value", "text", placeholder="e.g. 13.5", width=100),
            column("unit", "Unit", "text", placeholder="g/dL", width=82),
            column("reference_range", "Reference range", "text", placeholder="13.0–17.0", width=140),
            column("flag", "Deranged", "select", options=["Normal", "Low", "High", "Critical"], width=110),
            column("remarks", "Remarks", "text", width=140),
        ],
        add_label="Add parameter",
    ),
    section("interpretation", "Interpretation"),
    field("clinician_notes", "Clinician notes", field_type="textarea", span=3),
]

CORE_TABS: list[dict[str, Any]] = [
    {"id": "basic", "label": "Basic Details", "description": "Identity, contact and consent.", "icon": "user", "fields": BASIC_FIELDS},
    {"id": "bca", "label": "Body Assessment", "description": "Basic info, body composition, and circumference measurements.", "icon": "activity", "fields": BCA_FIELDS},
    {"id": "medical", "label": "Medical & Family History", "description": "Conditions, surgeries, family history and screening.", "icon": "heart", "fields": MEDICAL_FIELDS},
    {"id": "dietary", "label": "Dietary Routine", "description": "Food preferences, schedule, medications and supplements.", "icon": "utensils", "fields": DIETARY_FIELDS},
    {"id": "recall", "label": "24hr Recall", "description": "A repeatable log of meals and drinks.", "icon": "clock", "fields": RECALL_FIELDS},
    {"id": "fuv", "label": "FUV", "description": "Follow-up visit notes.", "icon": "file", "fields": FUV_FIELDS},
    {"id": "blood", "label": "Blood Report", "description": "Blood parameters, reference ranges, and deranged markers.", "icon": "droplet", "fields": BLOOD_FIELDS},
    {"id": "strategy", "label": "Strategy", "description": "Create, revise, and publish this client's nutrition strategy.", "icon": "target", "fields": []},
    {"id": "forms", "label": "Forms", "description": "Food habits and behaviour questionnaire.", "icon": "clipboard", "fields": FORMS_FIELDS},
    {"id": "headtoe", "label": "Head-to-Toe", "description": "System-by-system screening with a Yes/No gate and multi-select findings.", "icon": "heart", "fields": HEADTOE_FIELDS},
]
