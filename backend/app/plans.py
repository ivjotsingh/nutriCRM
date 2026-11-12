"""Persistence and lifecycle for client diet plans."""

from __future__ import annotations

import json
import uuid
from typing import Any

from .clients import get_client_bundle
from .db import _now, add_event, connect
from .plan_engine import (
    PlanValidationError,
    apply_template,
    blank_plan,
    derive,
    normalize,
    summary,
    targets_from_strategy,
)
from . import plan_reference as reference
from .strategies import get_strategy


class PlanNotFound(Exception):
    pass


class PlanLocked(Exception):
    pass


def _row_dict(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "client_id": row["client_id"],
        "name": row["name"],
        "status": row["status"],
        "version": int(row["version"] or 0),
        "data": normalize(json.loads(row["data_json"] or "{}")),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "published_at": row["published_at"],
        "strategy_id": row["strategy_id"] if "strategy_id" in row.keys() else "",
    }


def _require_client(client_id: str) -> dict[str, Any]:
    bundle = get_client_bundle(client_id)
    if not bundle:
        raise PlanNotFound("Client not found")
    return bundle


def _load(client_id: str, plan_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM diet_plans WHERE id = ? AND client_id = ?", (plan_id, client_id)
        ).fetchone()
    if not row:
        raise PlanNotFound("Plan not found")
    return _row_dict(row)


def _strategy_detail(client_id: str, strategy_id: str) -> dict[str, Any] | None:
    if not strategy_id:
        return None
    try:
        return get_strategy(client_id, strategy_id)
    except Exception:  # noqa: BLE001 - a missing strategy must not break the plan
        return None


def _detail(bundle: dict[str, Any], record: dict[str, Any]) -> dict[str, Any]:
    derived = derive(record["data"], bundle)
    strategy = _strategy_detail(bundle["client"]["id"], record["data"]["meta"].get("strategy_id", ""))
    return {
        "plan": record,
        "client": bundle["client"],
        "client_data": bundle.get("data") or {},
        "derived": derived,
        "readiness": derived["readiness"],
        "reference": reference.reference(),
        "strategy": {
            "id": (strategy or {}).get("strategy", {}).get("id", ""),
            "name": (strategy or {}).get("strategy", {}).get("name", ""),
            "status": (strategy or {}).get("strategy", {}).get("status", ""),
            "calories": ((strategy or {}).get("derived", {}).get("calories") or {}).get("calories", 0),
        }
        if strategy
        else None,
    }


def custom_templates() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT id, name, description, days_json, created_at FROM plan_templates ORDER BY created_at DESC").fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "created_at": row["created_at"],
            "days": json.loads(row["days_json"]),
            "custom": True,
        }
        for row in rows
    ]


def all_templates() -> list[dict[str, Any]]:
    static = [{**item, "custom": False} for item in reference.templates()]
    return [*static, *custom_templates()]


def save_as_template(client_id: str, plan_id: str, name: str = "", description: str = "") -> dict[str, Any]:
    record = _load(client_id, plan_id)
    days = []
    for day in record["data"]["days"]:
        slots = []
        for slot in day["slots"]:
            slots.append(
                {
                    "name": slot["name"],
                    "time": slot["time"],
                    "note": slot["note"],
                    "meals": [
                        {
                            "name": meal["name"],
                            "qty": meal["qty"],
                            "unit": meal["unit"],
                            "portion": meal["portion"],
                            "calories": meal["calories"],
                            "note": meal["note"],
                            "alternatives": [
                                {"name": alt["name"], "portion": alt["portion"], "calories": alt["calories"]}
                                for alt in meal["alternatives"]
                            ],
                        }
                        for meal in slot["meals"]
                    ],
                }
            )
        days.append({"day": day["day"], "slots": slots})
    template_id = str(uuid.uuid4())
    label = (name or record["data"]["meta"]["title"]).strip()[:120]
    with connect() as conn:
        conn.execute(
            "INSERT INTO plan_templates (id, name, description, days_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (template_id, label, description.strip()[:240], json.dumps(days), _now()),
        )
    add_event(None, "plan_template_saved", {"client_id": client_id, "plan_id": plan_id, "template_id": template_id})
    return {"id": template_id, "name": label, "description": description.strip()[:240], "days": days, "custom": True}


def list_plans(client_id: str) -> list[dict[str, Any]] | None:
    bundle = get_client_bundle(client_id)
    if not bundle:
        return None
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM diet_plans WHERE client_id = ? ORDER BY updated_at DESC", (client_id,)
        ).fetchall()
    out = []
    for row in rows:
        record = _row_dict(row)
        derived = derive(record["data"], bundle)
        out.append(summary(record["data"], derived, record))
    return out


def plan_history(client_id: str) -> dict[str, Any] | None:
    plans = list_plans(client_id)
    if plans is None:
        return None
    return {
        "plans": plans,
        "templates": [
            {"id": item["id"], "name": item["name"], "description": item["description"], "custom": item.get("custom", False)}
            for item in all_templates()
        ],
    }


def _published_strategy(client_id: str) -> dict[str, Any] | None:
    """Most recently published strategy for the client, if any."""
    with connect() as conn:
        row = conn.execute(
            "SELECT id FROM strategies WHERE client_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1",
            (client_id,),
        ).fetchone()
    if not row:
        return None
    return _strategy_detail(client_id, row["id"])


def create_plan(
    client_id: str,
    *,
    name: str = "",
    template_id: str = "",
    strategy_id: str = "",
) -> dict[str, Any] | None:
    bundle = get_client_bundle(client_id)
    if not bundle:
        return None
    strategy = _strategy_detail(client_id, strategy_id) if strategy_id else _published_strategy(client_id)
    data = blank_plan(bundle, strategy)
    if strategy:
        data["targets"] = {**data["targets"], **{k: v for k, v in targets_from_strategy(strategy).items() if v}}
        data["clinical"]["conditions"] = (strategy.get("derived", {}).get("context") or {}).get("conditions", [])
    template = next((item for item in all_templates() if item["id"] == template_id), None)
    if template is None and name.strip().lower().startswith("sports"):
        template = all_templates()[0]
    if template:
        apply_template(data, template)
    if name.strip():
        data["meta"]["title"] = name.strip()[:120]

    plan_id = str(uuid.uuid4())
    now = _now()
    with connect() as conn:
        conn.execute(
            "INSERT INTO diet_plans (id, client_id, name, status, version, strategy_id, data_json, created_at, updated_at, published_at)"
            " VALUES (?, ?, ?, 'draft', 0, ?, ?, ?, ?, '')",
            (plan_id, client_id, data["meta"]["title"], (strategy or {}).get("strategy", {}).get("id", ""), json.dumps(data), now, now),
        )
    add_event(None, "plan_created", {"client_id": client_id, "plan_id": plan_id})
    return _detail(bundle, _load(client_id, plan_id))


def get_plan(client_id: str, plan_id: str) -> dict[str, Any] | None:
    bundle = get_client_bundle(client_id)
    if not bundle:
        return None
    return _detail(bundle, _load(client_id, plan_id))


def update_plan(
    client_id: str,
    plan_id: str,
    *,
    name: str | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    record = _load(client_id, plan_id)
    if record["status"] != "draft":
        raise PlanLocked("Published plans are locked. Create a revision to make changes.")
    if data is not None and not isinstance(data, dict):
        raise ValueError("Plan data must be an object")
    now = _now()
    updates = ["updated_at = ?"]
    values: list[Any] = [now]
    if data is not None:
        normalized = normalize(data)
        encoded = json.dumps(normalized)
        if len(encoded) > 4_000_000:
            raise ValueError("Plan data is too large")
        updates.append("data_json = ?")
        values.append(encoded)
        title = normalized["meta"]["title"]
        updates.append("name = ?")
        values.append(title if name is None else name.strip()[:120])
        updates.append("strategy_id = ?")
        values.append(normalized["meta"].get("strategy_id", ""))
    elif name is not None:
        updates.append("name = ?")
        values.append(name.strip()[:120])
    values.append(plan_id)
    with connect() as conn:
        conn.execute(f"UPDATE diet_plans SET {', '.join(updates)} WHERE id = ?", values)
    bundle = _require_client(client_id)
    return _detail(bundle, _load(client_id, plan_id))


def publish_plan(
    client_id: str,
    plan_id: str,
    *,
    attestation: bool,
    note: str = "",
) -> dict[str, Any]:
    record = _load(client_id, plan_id)
    if record["status"] != "draft":
        raise PlanLocked("This plan is already published. Create a revision instead.")
    bundle = _require_client(client_id)
    derived = derive(record["data"], bundle)
    blockers = list(derived["readiness"]["blockers"])
    if not attestation:
        blockers.append(
            {
                "id": "attestation",
                "label": "Publish attestation",
                "status": "fail",
                "detail": "Confirm that you reviewed the plan before publishing.",
                "section": "review",
                "required": True,
            }
        )
    if blockers:
        add_event(None, "plan_publish_blocked", {"client_id": client_id, "plan_id": plan_id, "blockers": [b["id"] for b in blockers]})
        raise PlanValidationError(blockers, derived["readiness"])
    version = int(record["version"] or 0) + 1
    now = _now()
    payload = {
        "data": record["data"],
        "attestation": {"at": now, "note": note.strip()[:1000], "by": "Local practitioner"},
    }
    with connect() as conn:
        conn.execute(
            "UPDATE diet_plans SET status = 'published', version = ?, published_at = ?, updated_at = ?, name = ? WHERE id = ?",
            (version, now, now, record["data"]["meta"]["title"], plan_id),
        )
        conn.execute(
            "UPDATE diet_plans SET status = 'archived' WHERE client_id = ? AND id <> ? AND status = 'published'",
            (client_id, plan_id),
        )
        conn.execute(
            "INSERT INTO plan_versions (id, plan_id, client_id, version, data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), plan_id, client_id, version, json.dumps(payload), note.strip()[:1000], now),
        )
    add_event(None, "plan_published", {"client_id": client_id, "plan_id": plan_id, "version": version})
    return _detail(bundle, _load(client_id, plan_id))


def create_revision(client_id: str, plan_id: str) -> dict[str, Any]:
    bundle = _require_client(client_id)
    record = _load(client_id, plan_id)
    if record["status"] == "draft":
        raise PlanLocked("This plan is still a draft and can be edited directly.")
    data = json.loads(json.dumps(record["data"]))
    data["meta"]["revision_of"] = plan_id
    data["governance"] = {"reviewed_targets": False, "acknowledged_restrictions": False, "acknowledged_variance": False}
    new_id = str(uuid.uuid4())
    now = _now()
    with connect() as conn:
        conn.execute(
            "INSERT INTO diet_plans (id, client_id, name, status, version, strategy_id, data_json, created_at, updated_at, published_at)"
            " VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, '')",
            (
                new_id,
                client_id,
                data["meta"]["title"],
                int(record["version"] or 0),
                data["meta"].get("strategy_id", ""),
                json.dumps(data),
                now,
                now,
            ),
        )
    add_event(None, "plan_revision_created", {"client_id": client_id, "plan_id": new_id, "source_plan_id": plan_id})
    return _detail(bundle, _load(client_id, new_id))


def duplicate_plan(client_id: str, plan_id: str) -> dict[str, Any]:
    bundle = _require_client(client_id)
    record = _load(client_id, plan_id)
    data = json.loads(json.dumps(record["data"]))
    data["meta"]["title"] = f"{data['meta']['title']} · Copy"[:120]
    new_id = str(uuid.uuid4())
    now = _now()
    with connect() as conn:
        conn.execute(
            "INSERT INTO diet_plans (id, client_id, name, status, version, strategy_id, data_json, created_at, updated_at, published_at)"
            " VALUES (?, ?, ?, 'draft', 0, ?, ?, ?, ?, '')",
            (new_id, client_id, data["meta"]["title"], data["meta"].get("strategy_id", ""), json.dumps(data), now, now),
        )
    return _detail(bundle, _load(client_id, new_id))


def delete_plan(client_id: str, plan_id: str) -> None:
    record = _load(client_id, plan_id)
    if record["status"] != "draft":
        raise PlanLocked("Published or archived plans cannot be deleted.")
    with connect() as conn:
        conn.execute("DELETE FROM diet_plans WHERE id = ? AND client_id = ?", (plan_id, client_id))
    add_event(None, "plan_deleted", {"client_id": client_id, "plan_id": plan_id})


def plan_versions(client_id: str, plan_id: str) -> list[dict[str, Any]]:
    _load(client_id, plan_id)
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, version, note, created_at FROM plan_versions WHERE plan_id = ? AND client_id = ? ORDER BY version DESC",
            (plan_id, client_id),
        ).fetchall()
    return [dict(row) for row in rows]


def load_for_pdf(client_id: str, plan_id: str, version: int | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (plan data, client) for rendering, optionally a published snapshot."""
    bundle = _require_client(client_id)
    record = _load(client_id, plan_id)
    if version:
        with connect() as conn:
            row = conn.execute(
                "SELECT data_json FROM plan_versions WHERE plan_id = ? AND client_id = ? AND version = ?",
                (plan_id, client_id, version),
            ).fetchone()
        if not row:
            raise PlanNotFound("Plan version not found")
        payload = json.loads(row["data_json"])
        data = normalize(payload.get("data") or payload)
        data["meta"]["status"] = "published"
        data["meta"]["published_at"] = record["published_at"]
        return data, bundle
    data = record["data"]
    data["meta"]["status"] = record["status"]
    data["meta"]["published_at"] = record["published_at"]
    return data, bundle
