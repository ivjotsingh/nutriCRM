"""Persistence and lifecycle for client nutrition strategies."""

from __future__ import annotations

import json
import os
import uuid
from typing import Any

from .clients import get_client_bundle
from .db import _now, add_event, connect
from .strategy_engine import build_derived, build_prefill, client_context
from .strategy_reference import REFERENCE


def signoff_required() -> bool:
    """Prototype default: sign-off is optional. Set NUTRIALIMENT_REQUIRE_SIGNOFF=1 for strict mode."""
    return os.environ.get("NUTRIALIMENT_REQUIRE_SIGNOFF", "").strip().lower() in {"1", "true", "yes", "on"}


class StrategyNotFound(Exception):
    pass


class StrategyLocked(Exception):
    pass


class StrategyValidationError(Exception):
    def __init__(self, blockers: list[dict[str, Any]], readiness: dict[str, Any] | None = None):
        super().__init__("Strategy is not ready to publish")
        self.blockers = blockers
        self.readiness = readiness or {}


def _row_dict(row: Any) -> dict[str, Any]:
    data = json.loads(row["data_json"] or "{}")
    return {
        "id": row["id"],
        "client_id": row["client_id"],
        "name": row["name"],
        "status": row["status"],
        "version": int(row["version"] or 0),
        "data": data,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "published_at": row["published_at"],
    }


def _summary(record: dict[str, Any], derived: dict[str, Any]) -> dict[str, Any]:
    data = record.get("data") or {}
    meta = data.get("meta") or {}
    week = derived.get("week") or []
    return {
        "id": record["id"],
        "name": record["name"] or meta.get("name") or "Untitled strategy",
        "status": record["status"],
        "version": record["version"],
        "diet_type": meta.get("diet_type", ""),
        "major_goal": meta.get("major_goal", ""),
        "patient_type": meta.get("patient_type", ""),
        "calories": (derived.get("calories") or {}).get("calories", 0),
        "protein": (derived.get("protein") or {}).get("range", ""),
        "days_complete": sum(1 for day in week if day.get("complete")),
        "readiness": (derived.get("readiness") or {}).get("score", 0),
        "updated_at": record["updated_at"],
        "created_at": record["created_at"],
        "published_at": record["published_at"],
    }


def _require_client(client_id: str) -> dict[str, Any]:
    bundle = get_client_bundle(client_id)
    if not bundle:
        raise StrategyNotFound("Client not found")
    return bundle


def _load(client_id: str, strategy_id: str) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM strategies WHERE id = ? AND client_id = ?",
            (strategy_id, client_id),
        ).fetchone()
    if not row:
        raise StrategyNotFound("Strategy not found")
    return _row_dict(row)


def _detail(bundle: dict[str, Any], record: dict[str, Any]) -> dict[str, Any]:
    context = client_context(bundle)
    client = bundle["client"]
    derived = build_derived(record["data"], context, client, signoff_required=signoff_required())
    return {
        "strategy": record,
        "client": client,
        "context": context,
        "derived": derived,
        "readiness": derived["readiness"],
        "reference": REFERENCE,
    }


def list_strategies(client_id: str) -> list[dict[str, Any]] | None:
    bundle = get_client_bundle(client_id)
    if not bundle:
        return None
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM strategies WHERE client_id = ? ORDER BY updated_at DESC",
            (client_id,),
        ).fetchall()
    result = []
    context = client_context(bundle)
    for row in rows:
        record = _row_dict(row)
        derived = build_derived(record["data"], context, bundle["client"], signoff_required=signoff_required())
        result.append(_summary(record, derived))
    return result


def create_strategy(client_id: str, name: str = "") -> dict[str, Any] | None:
    bundle = get_client_bundle(client_id)
    if not bundle:
        return None
    data = build_prefill(bundle)
    if name.strip():
        data["meta"]["name"] = name.strip()[:120]
    strategy_id = str(uuid.uuid4())
    now = _now()
    with connect() as conn:
        conn.execute(
            "INSERT INTO strategies (id, client_id, name, status, version, data_json, created_at, updated_at, published_at) VALUES (?, ?, ?, 'draft', 0, ?, ?, ?, '')",
            (strategy_id, client_id, data["meta"]["name"], json.dumps(data), now, now),
        )
    record = _load(client_id, strategy_id)
    add_event(None, "strategy_created", {"client_id": client_id, "strategy_id": strategy_id})
    return _detail(bundle, record)


def get_strategy(client_id: str, strategy_id: str) -> dict[str, Any] | None:
    bundle = get_client_bundle(client_id)
    if not bundle:
        return None
    record = _load(client_id, strategy_id)
    return _detail(bundle, record)


def update_strategy(
    client_id: str,
    strategy_id: str,
    *,
    name: str | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    record = _load(client_id, strategy_id)
    if record["status"] != "draft":
        raise StrategyLocked("Published strategies are locked. Create a revision to make changes.")
    if data is not None and not isinstance(data, dict):
        raise ValueError("Strategy data must be an object")
    now = _now()
    updates = ["updated_at = ?"]
    values: list[Any] = [now]
    if name is not None:
        trimmed = name.strip()[:120]
        updates.append("name = ?")
        values.append(trimmed)
        if isinstance(data, dict):
            data.setdefault("meta", {})["name"] = trimmed
    if data is not None:
        encoded = json.dumps(data)
        if len(encoded) > 2_000_000:
            raise ValueError("Strategy data is too large")
        updates.append("data_json = ?")
        values.append(encoded)
        if name is None:
            meta_name = str((data.get("meta") or {}).get("name") or "").strip()[:120]
            updates.append("name = ?")
            values.append(meta_name)
    values.append(strategy_id)
    with connect() as conn:
        conn.execute(f"UPDATE strategies SET {', '.join(updates)} WHERE id = ?", values)
    bundle = _require_client(client_id)
    record = _load(client_id, strategy_id)
    return _detail(bundle, record)


def refresh_strategy(client_id: str, strategy_id: str, scope: str = "clinical") -> dict[str, Any]:
    """Pull the latest client record values into a draft without touching published plans."""
    record = _load(client_id, strategy_id)
    if record["status"] != "draft":
        raise StrategyLocked("Only drafts can be refreshed from the client record.")
    bundle = _require_client(client_id)
    prefill = build_prefill(bundle)
    data = record["data"]
    if scope in {"clinical", "all"}:
        data["clinical"] = prefill["clinical"]
        meta = data.setdefault("meta", {})
        if not meta.get("blood_report_at"):
            meta["blood_report_at"] = prefill["meta"]["blood_report_at"]
        if not meta.get("delivery_at"):
            meta["delivery_at"] = prefill["meta"]["delivery_at"]
    if scope in {"body", "all"}:
        body = data.setdefault("body", {})
        source = prefill["body"]
        for key in ("height_cm", "weight_kg", "body_fat_pct", "fat_free_mass_kg", "age", "sex", "activity_level"):
            if not body.get(key):
                body[key] = source.get(key)
        if not body.get("target_weight_kg"):
            body["target_weight_kg"] = source.get("target_weight_kg")
    if scope in {"support", "all"}:
        existing_supps = {
            str(item.get("name", "")).casefold()
            for item in data.get("supplements", [])
            if isinstance(item, dict)
        }
        for item in prefill.get("supplements", []):
            if str(item.get("name", "")).casefold() not in existing_supps:
                data.setdefault("supplements", []).append(item)
        existing_meds = {
            str(item.get("name", "")).casefold()
            for item in (data.get("medications") or {}).get("current", [])
            if isinstance(item, dict)
        }
        current = data.setdefault("medications", {}).setdefault("current", [])
        for item in (prefill.get("medications") or {}).get("current", []):
            if str(item.get("name", "")).casefold() not in existing_meds:
                current.append(item)
    now = _now()
    with connect() as conn:
        conn.execute(
            "UPDATE strategies SET data_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(data), now, strategy_id),
        )
    add_event(None, "strategy_sync", {"client_id": client_id, "strategy_id": strategy_id, "scope": scope})
    return _detail(bundle, _load(client_id, strategy_id))


def publish_strategy(
    client_id: str,
    strategy_id: str,
    *,
    attestation: bool,
    note: str = "",
) -> dict[str, Any]:
    record = _load(client_id, strategy_id)
    if record["status"] != "draft":
        raise StrategyLocked("This strategy is already published. Create a revision instead.")
    bundle = _require_client(client_id)
    derived = build_derived(
        record["data"],
        client_context(bundle),
        bundle["client"],
        signoff_required=signoff_required(),
    )
    readiness = derived["readiness"]
    blockers = list(readiness["blockers"])
    if signoff_required() and not attestation:
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
        add_event(
            None,
            "publish_blocked",
            {"client_id": client_id, "strategy_id": strategy_id, "blockers": [item["id"] for item in blockers]},
        )
        raise StrategyValidationError(blockers, readiness)
    version = int(record["version"] or 0) + 1
    now = _now()
    payload = {
        "data": record["data"],
        "attestation": {
            "at": now,
            "note": note.strip()[:1000],
            "by": "Local practitioner",
        },
    }
    with connect() as conn:
        conn.execute(
            "UPDATE strategies SET status = 'published', version = ?, data_json = ?, published_at = ?, updated_at = ? WHERE id = ?",
            (version, json.dumps(record["data"]), now, now, strategy_id),
        )
        conn.execute(
            "UPDATE strategies SET status = 'archived' WHERE client_id = ? AND id <> ? AND status = 'published'",
            (client_id, strategy_id),
        )
        conn.execute(
            "INSERT INTO strategy_versions (id, strategy_id, client_id, version, data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), strategy_id, client_id, version, json.dumps(payload), note.strip()[:1000], now),
        )
    add_event(None, "strategy_published", {"client_id": client_id, "strategy_id": strategy_id, "version": version})
    return _detail(bundle, _load(client_id, strategy_id))


def create_revision(client_id: str, strategy_id: str) -> dict[str, Any]:
    bundle = _require_client(client_id)
    record = _load(client_id, strategy_id)
    if record["status"] == "draft":
        raise StrategyLocked("This strategy is still a draft and can be edited directly.")
    data = json.loads(json.dumps(record["data"]))
    name = record["name"] or (data.get("meta") or {}).get("name") or "Strategy"
    base_name = name
    while base_name.endswith(" · Revision"):
        base_name = base_name[: -len(" · Revision")]
    data.setdefault("meta", {})["name"] = f"{base_name} · Revision"[:120]
    data["meta"]["revision_of"] = strategy_id
    governance = data.setdefault("governance", {})
    for key in list(governance.keys()):
        governance[key] = False
    new_id = str(uuid.uuid4())
    now = _now()
    with connect() as conn:
        conn.execute(
            "INSERT INTO strategies (id, client_id, name, status, version, data_json, created_at, updated_at, published_at) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, '')",
            (new_id, client_id, data["meta"]["name"], int(record["version"] or 0), json.dumps(data), now, now),
        )
    add_event(None, "strategy_revision_created", {"client_id": client_id, "strategy_id": new_id, "source_strategy_id": strategy_id})
    return _detail(bundle, _load(client_id, new_id))


def delete_strategy(client_id: str, strategy_id: str) -> None:
    record = _load(client_id, strategy_id)
    if record["status"] != "draft":
        raise StrategyLocked("Published or archived strategies cannot be deleted.")
    with connect() as conn:
        conn.execute("DELETE FROM strategies WHERE id = ? AND client_id = ?", (strategy_id, client_id))


def strategy_versions(client_id: str, strategy_id: str) -> list[dict[str, Any]]:
    _load(client_id, strategy_id)
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, version, note, created_at FROM strategy_versions WHERE strategy_id = ? AND client_id = ? ORDER BY version DESC",
            (strategy_id, client_id),
        ).fetchall()
    return [dict(row) for row in rows]
