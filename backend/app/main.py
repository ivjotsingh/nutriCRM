from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import db
from app.models import ApiLeadResponse, CheckInPayload, IntakePayload, UpgradeIntentPayload
from app.planner import generate_plan
from app.seed import case_examples, food_catalog, meal_templates, plan_format_examples, triage_rules
from app.triage import build_risk_brief, evaluate_triage


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="NutriAlign API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_origin_regex=r"^http://(127\.0\.0\.1|localhost):51\d{2}$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/catalog")
def get_catalog() -> dict:
    return {
        "foods": food_catalog(),
        "meal_templates": meal_templates(),
        "triage_rules": triage_rules(),
        "case_examples": case_examples(),
        "plan_format_examples": plan_format_examples(),
    }


@app.post("/api/intakes", response_model=ApiLeadResponse)
def submit_intake(payload: IntakePayload) -> ApiLeadResponse:
    triage = evaluate_triage(payload)
    if triage.eligible_for_ai_plan:
        result_type = "plan"
        result = generate_plan(payload)
    else:
        result_type = "brief"
        result = build_risk_brief(payload, triage)

    lead_id = db.record_intake(payload.model_dump(), triage.model_dump(), result_type, result)
    return ApiLeadResponse(
        lead_id=lead_id,
        status="ai_plan_ready" if result_type == "plan" else "dietician_review_recommended",
        triage=triage,
        result_type=result_type,
        result=result,
    )


@app.get("/api/leads")
def leads() -> dict:
    return {"leads": db.list_leads()}


@app.get("/api/leads/{lead_id}")
def lead_detail(lead_id: str) -> dict:
    lead = db.get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.add_event(lead_id, "admin_lead_viewed")
    return lead


@app.post("/api/leads/{lead_id}/check-ins")
def submit_check_in(lead_id: str, payload: CheckInPayload) -> dict:
    if not db.get_lead(lead_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    return db.add_check_in(lead_id, payload.model_dump())


@app.post("/api/leads/{lead_id}/upgrade-intent")
def submit_upgrade_intent(lead_id: str, payload: UpgradeIntentPayload) -> dict:
    if not db.get_lead(lead_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    return db.add_upgrade_intent(lead_id, payload.model_dump())


@app.post("/api/events")
def event(payload: dict) -> dict[str, str]:
    db.add_event(payload.get("lead_id"), payload.get("event_type", "frontend_event"), payload.get("payload", {}))
    return {"status": "recorded"}
