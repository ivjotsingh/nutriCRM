from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app import clients as client_store
from app import db
from app import plan_reference
from app import plans as plan_store
from app import strategies as strategy_store
from app.models import (
    ApiLeadResponse,
    CheckInPayload,
    ClientCreatePayload,
    ClientOptionPayload,
    ClientTabPayload,
    ClientUpdatePayload,
    IntakePayload,
    PlanCreatePayload,
    PlanPublishPayload,
    PlanTemplatePayload,
    PlanUpdatePayload,
    StrategyCreatePayload,
    StrategyPublishPayload,
    StrategyRefreshPayload,
    StrategyUpdatePayload,
    UpgradeIntentPayload,
)
from app.plan_pdf import build_pdf
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


@app.get("/api/clients")
def list_clients() -> dict:
    return {"clients": client_store.list_clients()}


@app.post("/api/clients")
def create_client(payload: ClientCreatePayload) -> dict:
    try:
        bundle = client_store.create_client(
            name=payload.name,
            phone=payload.phone,
            email=payload.email,
            city=payload.city,
            consent=payload.consent,
            start_date=payload.start_date,
            end_date=payload.end_date,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not bundle:
        raise HTTPException(status_code=500, detail="Unable to create client")
    return bundle


@app.get("/api/clients/{client_id}")
def get_client(client_id: str) -> dict:
    bundle = client_store.get_client_bundle(client_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Client not found")
    return bundle


@app.patch("/api/clients/{client_id}")
def update_client(client_id: str, payload: ClientUpdatePayload) -> dict:
    try:
        bundle = client_store.update_client(client_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not bundle:
        raise HTTPException(status_code=404, detail="Client not found")
    return bundle


@app.get("/api/clients/{client_id}/headtoe/history")
def get_headtoe_history(client_id: str) -> dict:
    history = client_store.headtoe_history(client_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"history": history}


@app.post("/api/clients/{client_id}/options")
def add_client_option(client_id: str, payload: ClientOptionPayload) -> dict:
    try:
        options = client_store.add_option(client_id, payload.category, payload.value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if options is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"options": options}


@app.post("/api/clients/{client_id}/tabs")
def create_client_tab(client_id: str, payload: ClientTabPayload) -> dict:
    try:
        tab = client_store.create_tab(
            client_id,
            payload.label,
            payload.description,
            [field.model_dump() for field in payload.fields],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not tab:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"tab": tab}


def _strategy_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, strategy_store.StrategyNotFound):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, strategy_store.StrategyLocked):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, strategy_store.StrategyValidationError):
        return HTTPException(
            status_code=409,
            detail={
                "message": "Strategy is not ready to publish",
                "blockers": exc.blockers,
                "readiness": exc.readiness,
            },
        )
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail="Strategy request failed")


@app.get("/api/clients/{client_id}/strategies")
def list_strategies(client_id: str) -> dict:
    result = strategy_store.list_strategies(client_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"strategies": result}


@app.post("/api/clients/{client_id}/strategies")
def create_strategy(client_id: str, payload: StrategyCreatePayload) -> dict:
    try:
        detail = strategy_store.create_strategy(client_id, payload.name)
    except Exception as exc:  # noqa: BLE001 - mapped to an API error below
        raise _strategy_http_error(exc) from exc
    if detail is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return detail


@app.get("/api/clients/{client_id}/strategies/{strategy_id}")
def get_strategy(client_id: str, strategy_id: str) -> dict:
    try:
        detail = strategy_store.get_strategy(client_id, strategy_id)
    except Exception as exc:  # noqa: BLE001
        raise _strategy_http_error(exc) from exc
    if detail is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return detail


@app.patch("/api/clients/{client_id}/strategies/{strategy_id}")
def update_strategy(client_id: str, strategy_id: str, payload: StrategyUpdatePayload) -> dict:
    try:
        return strategy_store.update_strategy(
            client_id,
            strategy_id,
            name=payload.name,
            data=payload.data,
        )
    except Exception as exc:  # noqa: BLE001
        raise _strategy_http_error(exc) from exc


@app.post("/api/clients/{client_id}/strategies/{strategy_id}/publish")
def publish_strategy(client_id: str, strategy_id: str, payload: StrategyPublishPayload) -> dict:
    try:
        return strategy_store.publish_strategy(
            client_id,
            strategy_id,
            attestation=payload.attestation,
            note=payload.note,
        )
    except Exception as exc:  # noqa: BLE001
        raise _strategy_http_error(exc) from exc


@app.post("/api/clients/{client_id}/strategies/{strategy_id}/revisions")
def create_strategy_revision(client_id: str, strategy_id: str) -> dict:
    try:
        return strategy_store.create_revision(client_id, strategy_id)
    except Exception as exc:  # noqa: BLE001
        raise _strategy_http_error(exc) from exc


@app.post("/api/clients/{client_id}/strategies/{strategy_id}/refresh")
def refresh_strategy(client_id: str, strategy_id: str, payload: StrategyRefreshPayload) -> dict:
    try:
        return strategy_store.refresh_strategy(client_id, strategy_id, payload.scope)
    except Exception as exc:  # noqa: BLE001
        raise _strategy_http_error(exc) from exc


@app.get("/api/clients/{client_id}/strategies/{strategy_id}/versions")
def strategy_versions(client_id: str, strategy_id: str) -> dict:
    try:
        return {"versions": strategy_store.strategy_versions(client_id, strategy_id)}
    except Exception as exc:  # noqa: BLE001
        raise _strategy_http_error(exc) from exc


@app.delete("/api/clients/{client_id}/strategies/{strategy_id}", status_code=204)
def delete_strategy(client_id: str, strategy_id: str) -> None:
    try:
        strategy_store.delete_strategy(client_id, strategy_id)
    except Exception as exc:  # noqa: BLE001
        raise _strategy_http_error(exc) from exc


@app.get("/api/plan-reference")
def plan_reference_payload() -> dict:
    return plan_reference.reference()


@app.get("/api/plan-catalog")
def plan_catalog() -> dict:
    return plan_reference.catalog()


def _plan_http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, plan_store.PlanNotFound):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, plan_store.PlanLocked):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, plan_store.PlanValidationError):
        return HTTPException(
            status_code=409,
            detail={"message": "Plan is not ready to publish", "blockers": exc.blockers, "readiness": exc.readiness},
        )
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail="Plan request failed")


@app.get("/api/clients/{client_id}/plans")
def list_plans(client_id: str) -> dict:
    result = plan_store.plan_history(client_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


@app.post("/api/clients/{client_id}/plans")
def create_plan(client_id: str, payload: PlanCreatePayload) -> dict:
    try:
        detail = plan_store.create_plan(
            client_id,
            name=payload.name,
            template_id=payload.template_id,
            strategy_id=payload.strategy_id,
        )
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc
    if detail is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return detail


@app.get("/api/clients/{client_id}/plans/{plan_id}")
def get_plan(client_id: str, plan_id: str) -> dict:
    try:
        detail = plan_store.get_plan(client_id, plan_id)
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc
    if detail is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return detail


@app.patch("/api/clients/{client_id}/plans/{plan_id}")
def update_plan(client_id: str, plan_id: str, payload: PlanUpdatePayload) -> dict:
    try:
        return plan_store.update_plan(client_id, plan_id, name=payload.name, data=payload.data)
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc


@app.post("/api/clients/{client_id}/plans/{plan_id}/publish")
def publish_plan(client_id: str, plan_id: str, payload: PlanPublishPayload) -> dict:
    try:
        return plan_store.publish_plan(client_id, plan_id, attestation=payload.attestation, note=payload.note)
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc


@app.post("/api/clients/{client_id}/plans/{plan_id}/revisions")
def create_plan_revision(client_id: str, plan_id: str) -> dict:
    try:
        return plan_store.create_revision(client_id, plan_id)
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc


@app.post("/api/clients/{client_id}/plans/{plan_id}/duplicate")
def duplicate_plan(client_id: str, plan_id: str) -> dict:
    try:
        return plan_store.duplicate_plan(client_id, plan_id)
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc


@app.post("/api/clients/{client_id}/plans/{plan_id}/template")
def save_plan_template(client_id: str, plan_id: str, payload: PlanTemplatePayload) -> dict:
    try:
        return plan_store.save_as_template(client_id, plan_id, payload.name, payload.description)
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc


@app.get("/api/clients/{client_id}/plans/{plan_id}/versions")
def plan_versions(client_id: str, plan_id: str) -> dict:
    try:
        return {"versions": plan_store.plan_versions(client_id, plan_id)}
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc


@app.delete("/api/clients/{client_id}/plans/{plan_id}", status_code=204)
def delete_plan(client_id: str, plan_id: str) -> None:
    try:
        plan_store.delete_plan(client_id, plan_id)
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc


@app.get("/api/clients/{client_id}/plans/{plan_id}/pdf")
def plan_pdf(client_id: str, plan_id: str, version: int | None = None, download: bool = Query(default=False)) -> Response:
    try:
        plan_data, bundle = plan_store.load_for_pdf(client_id, plan_id, version)
    except Exception as exc:  # noqa: BLE001
        raise _plan_http_error(exc) from exc
    client_name = (bundle.get("client") or {}).get("name") or "client"
    title = (plan_data.get("meta") or {}).get("title") or "Diet plan"
    raw_name = f"{client_name} - {title}.pdf".replace("/", "-")
    filename = "".join(char if 32 <= ord(char) < 127 else "-" for char in raw_name)
    filename = " ".join(filename.split())
    payload = build_pdf(plan_data, bundle)
    disposition = "attachment" if download else "inline"
    return Response(
        content=payload,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "no-store",
        },
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
