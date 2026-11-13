"""Seed a fully-filled demo client (synthetic identity) with a published strategy and plan.

Runs against the live API (default http://127.0.0.1:8000) so the browser sees the
same records. Prints the ids and writes them to tmp/test_client.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

API = "http://127.0.0.1:8000"
START = "2026-11-16"
END = "2027-05-14"


def client_data() -> dict:
    return {
        "basic": {
            "name": "Demo Client",
            "phone": "+91 90000 00000",
            "email": "demo@nutrialiment.app",
            "city": "Mumbai",
            "gender": "Male",
            "dob": "2004-02-11",
            "blood_group": "O+",
            "marital_status": "Single",
            "address": "12 Marine Drive, Churchgate",
            "pincode": "400020",
            "occupation": "Student and state-level tennis player",
            "sports": "Tennis since age 7. Trains twice a day, four days a week; tournaments monthly. Right-handed baseline player.",
            "start_date": START,
            "end_date": END,
            "source": "Referral",
            "notes": "Wants to hold weight through the tournament season while improving recovery between sessions.",
            "consent": True,
        },
        "bca": {
            "measurement_date": "2026-11-14",
            "height_ft": 5,
            "height_in": 11,
            "height_cm": 179.5,
            "weight_kg": 78.6,
            "weight_lbs": 173.3,
            "body_fat_pct": 14.2,
            "fat_mass_kg": 11.4,
            "muscle_mass_kg": 36.8,
            "visceral_fat": 4,
            "resting_metabolism": 1850,
            "biological_age": 19,
            "total_subcut_fat_pct": 13.1,
            "subcut_fat_trunk_pct": 11.4,
            "subcut_fat_arms_pct": 9.8,
            "subcut_fat_legs_pct": 12.2,
            "total_skeletal_muscle_pct": 46.2,
            "skeletal_muscle_trunk_pct": 44.1,
            "skeletal_muscle_arms_pct": 47.8,
            "skeletal_muscle_legs_pct": 48.3,
            "water_weight_kg": 45.6,
            "bone_weight_kg": 3.4,
            "fat_free_mass_kg": 68.7,
            "waist_in": 31.5,
            "waist_cm": 80.0,
            "hip_in": 37.0,
            "hip_cm": 94.0,
            "neck_in": 15.0,
            "neck_cm": 38.0,
            "waist_hip_ratio": 0.85,
            "body_shape_type": "Athletic",
            "notes": "Lean athletic build. Mild asymmetry in the right shoulder from serving load.",
        },
        "medical": {
            "primary_goal": "Maintenance",
            "fitness_goal": "Endurance",
            "specific_areas": "Recovery between sessions, hydration on court, maintaining lean mass during tournaments.",
            "activity_level": "Athlete",
            "health_goals": ["Improving energy", "Improve blood parameters", "Muscle gain"],
            "conditions": [
                {"disease": "Seasonal allergic rhinitis", "since": "2018", "severity": "mild", "frequency": "seasonal", "grading": "Mild"},
                {"disease": "Iron deficiency (resolved)", "since": "2023", "severity": "mild", "frequency": "monitored", "grading": "Mild"},
            ],
            "surgeries": [{"name": "None", "when": "—", "comments": "No surgical history"}],
            "family": [
                {"disease": "Type 2 diabetes", "relationship": "Father", "details": "Diagnosed at 48"},
                {"disease": "Hypertension", "relationship": "Mother", "details": "On medication"},
            ],
            "cancer": "No",
            "blood_pressure": "118/76",
            "energy": "No",
            "recurrent_infections": "No",
            "screening_notes": "No red flags. Cleared for training and travel.",
        },
        "dietary": {
            "food_preference": "Non-vegetarian",
            "restrictions": ["No beef", "No pork"],
            "cuisine": ["Indian", "Continental"],
            "favorite_foods": "Eggs, chicken curry, curd rice, banana, peanut butter",
            "avoid_foods": "Mushrooms, bitter gourd",
            "allergies": ["None"],
            "intolerances": ["Lactose"],
            "lactose_intolerance": "Yes",
            "gluten_sensitivity": "No",
            "meal_prep_help": "House help prepares lunch and dinner",
            "oils": "Rice bran for cooking, olive oil for salads, ghee occasionally",
            "travel_plans": "Two tournaments in December (Pune, Delhi), three days each",
            "workout_schedule": [
                {"weekday": "Mon/Tue/Thu/Fri", "from": "06:00", "to": "08:00", "activity": "Tennis (strength + court)", "notes": "Gym after court on Tue and Fri"},
                {"weekday": "Mon/Tue/Thu/Fri", "from": "17:00", "to": "19:00", "activity": "Tennis (match play)", "notes": "Higher sweat rate"},
                {"weekday": "Wed/Sat", "from": "07:00", "to": "08:30", "activity": "Recovery session", "notes": "Mobility and pool"},
            ],
            "schedule": [
                {"weekday": "Monday–Friday", "sleep_from": "22:30", "wake_at": "05:30", "work_from": "09:00", "work_to": "16:00"},
                {"weekday": "Saturday", "sleep_from": "23:00", "wake_at": "06:30", "work_from": "—", "work_to": "—"},
            ],
            "medications": [
                {"name": "None", "dosage": "—", "frequency": "—", "meal_time": "—", "since": ""},
            ],
            "supplements": [
                {"name": "Vitamin D3", "dosage": "60,000 IU", "frequency": "Weekly"},
                {"name": "Whey protein", "dosage": "1 scoop", "frequency": "Daily"},
            ],
            "medication_notes": "No daily medication. Vitamin D checked every six months.",
        },
        "recall": {
            "recall_date": "2026-11-14",
            "meals": [
                {"meal": "Breakfast", "time": "07:00", "quantity": "3 egg whites, 2 eggs, 2 jowar parathas, coconut chutney, 200 ml milk"},
                {"meal": "Mid-morning", "time": "11:30", "quantity": "1 banana, 150 g cut fruit, 5 g roasted watermelon seeds"},
                {"meal": "Lunch", "time": "14:00", "quantity": "1 cup rice, dal, chicken curry, salad"},
                {"meal": "Snack", "time": "18:00", "quantity": "2 tbsp sattu in lemon water, corn sandwich"},
                {"meal": "Dinner", "time": "20:00", "quantity": "3 chapatis, chicken curry, bell pepper sabji, soup"},
                {"meal": "Post dinner", "time": "21:30", "quantity": "200 ml lactose-free milk, 2 walnuts"},
            ],
            "recall_notes": "Skips mid-morning on school days; water intake drops on court days.",
        },
        "fuv": {
            "visit_date": "2026-11-14",
            "updates": "Started a new tournament block. Weight stable at 78.6 kg over the last eight weeks.",
            "positive_changes": "Consistent breakfast, better sleep routine on weekdays.",
            "areas_to_work": "Hydration on court, evening snack timing before the second session.",
            "suggestions": "Add electrolytes during the second session; keep dinner within 60 minutes of training.",
            "food_requests": "More one-pot meals that can travel to tournaments.",
            "schedule_changes": "Wednesday moved to a recovery session.",
            "travel": "Pune (5–7 Dec) and Delhi (18–20 Dec).",
            "other_notes": "Bloods reviewed; ferritin improved to 42 ng/mL.",
        },
        "blood": {
            "report_date": "2026-11-08",
            "report_lab": "Metropolis, Mumbai",
            "report_notes": "Fasting sample, 10 hours.",
            "parameters": [
                {"category": "Haematology", "test_name": "Haemoglobin", "value": "15.2", "unit": "g/dL", "reference_range": "13.0–17.0", "flag": "Normal", "remarks": ""},
                {"category": "Haematology", "test_name": "Ferritin", "value": "42", "unit": "ng/mL", "reference_range": "30–400", "flag": "Normal", "remarks": "Improved from 18"},
                {"category": "Haematology", "test_name": "Vitamin B12", "value": "310", "unit": "pg/mL", "reference_range": "200–900", "flag": "Normal", "remarks": ""},
                {"category": "Metabolic", "test_name": "Fasting glucose", "value": "88", "unit": "mg/dL", "reference_range": "70–100", "flag": "Normal", "remarks": ""},
                {"category": "Lipids", "test_name": "LDL cholesterol", "value": "96", "unit": "mg/dL", "reference_range": "<100", "flag": "Normal", "remarks": ""},
                {"category": "Lipids", "test_name": "HDL cholesterol", "value": "52", "unit": "mg/dL", "reference_range": ">40", "flag": "Normal", "remarks": ""},
                {"category": "Vitamins", "test_name": "Vitamin D (25-OH)", "value": "24", "unit": "ng/mL", "reference_range": "30–100", "flag": "Low", "remarks": "Supplement continues"},
                {"category": "Organ function", "test_name": "Creatinine", "value": "0.9", "unit": "mg/dL", "reference_range": "0.7–1.3", "flag": "Normal", "remarks": ""},
            ],
            "clinician_notes": "Vitamin D still low; continue weekly D3 and recheck in six months.",
        },
        "forms": {
            "consulted": "No",
            "eating_habits": "Regular",
            "tracking": "Occasionally",
            "diet_plan": "No",
            "eating_patterns": "Three meals and two snacks",
            "emotional_eater": "No",
            "portion_habits": "Large",
            "eating_out": "1–2 times",
            "excess_deviation": ["Sweets", "Fried food"],
            "food_discomfort": "No",
            "health_impact_habits": "Training twice a day, adequate sleep on weekdays.",
            "dietary_share": "Travels for tournaments; needs portable snack options.",
            "cravings": ["Sweets", "Chocolate"],
            "exercise": ["Tennis", "Strength training"],
            "alcohol": "Never",
            "smoking": "Never",
            "vaping": "Never",
            "drugs": "No",
            "second_hand_smoke": "Never",
            "start_day": "Water and tea",
            "wake_actions": ["Water", "Phone"],
            "screen_hours": "3–4 hours",
            "daily_activity_time": ["Sport", "Walking"],
            "energy_levels": "Good",
            "energetic_time": "Morning",
            "drained_time": "Evening",
            "midday_crash": "No crash unless lunch is skipped.",
            "water_intake": "2–3 litres",
            "regular_drinks": ["Water", "Coconut water"],
            "grocery_shopper": "Parent",
            "menu_decider": "Household help",
            "shopping_style": "Weekly",
            "meal_prep_comfort": "Comfortable",
            "new_foods": "Yes",
            "food_frequency": [
                {"food": "Tea", "times_per_week": "2", "notes": "With milk"},
                {"food": "Eggs", "times_per_week": "7", "notes": ""},
                {"food": "Chicken", "times_per_week": "4", "notes": ""},
                {"food": "Fruit", "times_per_week": "7", "notes": ""},
            ],
        },
        "headtoe": {
            "htt_date": "2026-11-14",
            "htt_summary": "No systemic concerns. Mild digestive bloating after large rice meals. Occasional lower-back stiffness after serving practice.",
            "htt_head_neck_gate": "No",
            "htt_chest_lungs_gate": "No",
            "htt_heart_gate": "No",
            "htt_digestive_gate": "Yes",
            "htt_digestive_findings": ["Bloating"],
            "htt_digestive_bloating": "Occasionally",
            "htt_digestive_bristol": "4",
            "htt_digestive_notes": "Bloating after large rice meals; settles with a walk.",
            "htt_musculoskeletal_gate": "Yes",
            "htt_musculoskeletal_findings": ["Back pain (lower)", "Muscle soreness / DOMS"],
            "htt_musculoskeletal_notes": "Lower-back stiffness after long serving blocks; no radiation.",
            "htt_sleep_gate": "No",
            "htt_energy_mood_gate": "No",
            "htt_urinary_gate": "No",
            "htt_skin_gate": "No",
            "htt_endocrine_gate": "No",
            "htt_reproductive_gate": "No",
            "htt_pregnancy_gate": "No",
        },
    }


def main() -> None:
    api = sys.argv[1] if len(sys.argv) > 1 else API
    with httpx.Client(base_url=api, timeout=60) as http:
        health = http.get("/health").json()
        print("health:", health)

        created = http.post(
            "/api/clients",
            json={
                "name": "Demo Client",
                "phone": "+91 90000 00000",
                "email": "demo@nutrialiment.app",
                "city": "Mumbai",
                "consent": True,
                "start_date": START,
                "end_date": END,
            },
        ).json()
        client_id = created["client"]["id"]
        http.patch(f"/api/clients/{client_id}", json={"data": client_data()})
        print("client:", client_id)

        # ---- strategy -------------------------------------------------------
        strategy = http.post(f"/api/clients/{client_id}/strategies", json={"name": "Tennis performance — Nov 2026"}).json()
        strategy_id = strategy["strategy"]["id"]
        data = strategy["strategy"]["data"]
        data["body"].update(
            {
                "height_cm": 179.5,
                "weight_kg": 78.6,
                "body_fat_pct": 14.2,
                "target_weight_kg": 78.5,
                "age": 22,
                "sex": "Male",
                "activity_level": "Athlete",
                "goal_mode": "maintenance",
                "calorie_method": "thumb",
                "workout_extra_kcal": 300,
                "protein_target": "1.6-1.8",
            }
        )
        data["meta"].update({"major_goal": "Weight maintenance", "diet_type": "Non-vegetarian", "patient_type": "General"})
        data["macros"]["days"] = []
        for key in data["governance"]:
            data["governance"][key] = True
        updated = http.patch(f"/api/clients/{client_id}/strategies/{strategy_id}", json={"data": data}).json()
        print("strategy target:", updated["derived"]["calories"]["calories"], "kcal", updated["derived"]["protein"]["range"], "g/kg")
        published = http.post(
            f"/api/clients/{client_id}/strategies/{strategy_id}/publish",
            json={"attestation": True, "note": "Seeded strategy for the end-to-end plan test."},
        )
        print("strategy publish:", published.status_code)

        # ---- plan -----------------------------------------------------------
        detail = http.post(
            f"/api/clients/{client_id}/plans",
            json={"template_id": "sports-tennis-7day", "strategy_id": strategy_id},
        ).json()
        plan_id = detail["plan"]["id"]
        plan = detail["plan"]["data"]
        plan["meta"]["title"] = "Nov 2026 · Tennis performance block"
        plan["meta"]["start_date"] = START
        plan["meta"]["duration_days"] = 180
        plan["meta"]["description"] = "Tournament-season rotation built from the published strategy."
        plan["targets"] = {
            "calories": 3000,
            "protein_g": 150,
            "carbs_g": 375,
            "fat_g": 100,
            "ratio": {"cho": 50, "pro": 20, "fat": 30},
            "source": "strategy",
            "protein_range": "1.6-1.8",
            "note": "Thumb rule · target weight 80 kg × 30 kcal/kg + 300 kcal training.",
        }
        notes = {
            "Monday": "Lighter day after the weekend tournament. Keep dinner early.",
            "Tuesday": "Double session — finish the post-workout snack within 30 minutes.",
            "Wednesday": "Recovery day. Add 500 ml of water with electrolytes in the afternoon.",
            "Thursday": "Match play in the evening; keep lunch low in fibre.",
            "Friday": "Strength session after court — prioritise protein at breakfast.",
            "Saturday": "Travel day snacks packed: banana, nuts, sattu sachet.",
            "Sunday": "Rest day. Keep meals regular and rehydrate through the day.",
        }
        monday = next(day for day in plan["days"] if day["day"] == "Monday")
        monday["targets"] = {
            "calories": 1800,
            "protein_g": 120,
            "carbs_g": 200,
            "fat_g": 60,
            "ratio": {"cho": 44, "pro": 27, "fat": 29},
            "source": "day",
            "note": "Rest-day energy",
        }
        for day in plan["days"]:
            day["notes"] = notes.get(day["day"], "")
        plan["extras"]["superfoods"] = [
            "lemon",
            "raisins",
            "banana",
            "brazil-nuts",
            "carrot",
            "watermelon-seeds",
            "saffron",
            "prunes",
            "sweet-potato",
            "kalonji-seeds",
        ]
        plan["extras"]["guidelines"] = [item["id"] for item in detail["reference"]["guidelines"]]
        plan["extras"]["custom_notes"] = [
            {
                "id": "note_court",
                "heading": "On-court hydration",
                "body": "500 ml water with a pinch of salt every 20 minutes during match play; add 30 g of a carbohydrate drink if the match goes past 90 minutes.",
            }
        ]
        plan["governance"].update({"reviewed_targets": True, "acknowledged_restrictions": True, "acknowledged_variance": True})
        saved = http.patch(f"/api/clients/{client_id}/plans/{plan_id}", json={"data": plan}).json()
        print("plan readiness:", saved["readiness"]["score"], [c["status"] for c in saved["readiness"]["checks"]])
        print("plan totals:", saved["derived"]["totals"])

        published_plan = http.post(
            f"/api/clients/{client_id}/plans/{plan_id}/publish",
            json={"attestation": True, "note": "Reviewed the week and the printed PDF before publishing."},
        )
        print("plan publish:", published_plan.status_code, published_plan.json().get("plan", {}).get("status"))

        Path("tmp/test_client.json").write_text(
            json.dumps({"client_id": client_id, "strategy_id": strategy_id, "plan_id": plan_id}, indent=2)
        )
        print("written tmp/test_client.json")


if __name__ == "__main__":
    main()
