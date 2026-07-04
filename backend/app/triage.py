from __future__ import annotations

from app.models import IntakePayload, TriageResult
from app.seed import triage_rules


def evaluate_triage(intake: IntakePayload) -> TriageResult:
    rules = triage_rules()
    risk_map = {item["id"]: item for item in rules["risk_flags"]}
    flags: list[str] = []

    for risk_id in intake.medical_risks:
        if risk_id in risk_map:
            flags.append(risk_map[risk_id]["label"])

    if intake.active_medication:
        flags.append(risk_map["active_medication"]["label"])

    if intake.abnormal_reports:
        flags.append(risk_map["abnormal_reports"]["label"])

    if intake.age < 18:
        flags.append(risk_map["under_18"]["label"])

    unique_flags = list(dict.fromkeys(flags))
    if unique_flags:
        return TriageResult(
            eligible_for_ai_plan=False,
            risk_flags=unique_flags,
            reason="Your profile includes health details that should be reviewed by a dietician before any diet plan is created.",
            recommended_action="Book the human dietician plan for Rs 18,000 / 3 months.",
        )

    return TriageResult(
        eligible_for_ai_plan=True,
        risk_flags=[],
        reason="No high-risk medical flags were selected, so a constrained 7-day AI-assisted preview can be generated.",
        recommended_action="Generate the free 7-day nutrition preview.",
    )


def build_risk_brief(intake: IntakePayload, triage: TriageResult) -> dict:
    bmi = round(intake.weight_kg / ((intake.height_cm / 100) ** 2), 1)
    return {
        "title": "Dietician review recommended",
        "summary": "We prepared your nutrition brief so the dietician can start from your goals, routine, food preferences, and risk context.",
        "cta": {
            "label": "Book human dietician plan",
            "price": "Rs 18,000 / 3 months",
            "plan_type": "human_dietician",
        },
        "profile": {
            "name": intake.name,
            "age": intake.age,
            "gender": intake.gender,
            "city": intake.city,
            "height_cm": intake.height_cm,
            "weight_kg": intake.weight_kg,
            "target_weight_kg": intake.target_weight_kg,
            "bmi": bmi,
            "goals": intake.goals,
        },
        "routine": {
            "wake_time": intake.wake_time,
            "sleep_time": intake.sleep_time,
            "work_schedule": intake.work_schedule,
            "workout_level": intake.workout_level,
            "water_intake": intake.water_intake,
            "eating_out_frequency": intake.eating_out_frequency,
            "cooking_help": intake.cooking_help,
        },
        "food_context": {
            "diet_type": intake.diet_type,
            "cuisine_preferences": intake.cuisine_preferences,
            "allergies_dislikes": intake.allergies_dislikes,
            "cravings": intake.cravings,
        },
        "risk_flags": triage.risk_flags,
        "dietician_questions": [
            "Which health condition or medication should shape the plan first?",
            "Are any recent blood reports or physician restrictions available?",
            "What is the safest initial calorie and protein range?",
            "Which foods should be avoided until review is complete?",
        ],
    }

