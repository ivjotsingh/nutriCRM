from __future__ import annotations

import datetime as dt
import json
import re
import uuid
from typing import Any

from .client_schema import CORE_TABS
from .db import _now, connect

ALLOWED_FIELD_TYPES = {"text", "textarea", "number", "date", "time", "select", "multiselect", "checkbox"}


def _slug(value: str, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:40] or fallback


def _client_dict(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "phone": row["phone"],
        "email": row["email"],
        "city": row["city"],
        "consent": bool(row["consent"]),
        "start_date": row["start_date"],
        "end_date": row["end_date"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _clean_date(value: Any, label: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        return dt.date.fromisoformat(text).isoformat()
    except ValueError as exc:
        raise ValueError(f"{label} must use YYYY-MM-DD") from exc


def _validate_dates(start_date: str, end_date: str) -> None:
    if start_date and end_date and end_date < start_date:
        raise ValueError("End date cannot be before the start date")


def list_clients() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM clients ORDER BY updated_at DESC").fetchall()
    return [_client_dict(row) for row in rows]


def create_client(
    name: str,
    phone: str,
    email: str,
    city: str,
    consent: bool,
    start_date: str = "",
    end_date: str = "",
) -> dict[str, Any]:
    client_id = str(uuid.uuid4())
    now = _now()
    start_date = _clean_date(start_date, "Start date")
    end_date = _clean_date(end_date, "End date")
    _validate_dates(start_date, end_date)
    with connect() as conn:
        conn.execute(
            "INSERT INTO clients (id, name, phone, email, city, consent, start_date, end_date, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                client_id,
                name.strip(),
                phone.strip(),
                email.strip(),
                city.strip(),
                1 if consent else 0,
                start_date,
                end_date,
                "{}",
                now,
                now,
            ),
        )
    return get_client_bundle(client_id)  # type: ignore[return-value]


def _custom_tabs(client_id: str) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM client_tabs WHERE client_id = ? AND archived = 0 ORDER BY position ASC, created_at ASC",
            (client_id,),
        ).fetchall()
    tabs = []
    for row in rows:
        tabs.append(
            {
                "id": row["id"],
                "label": row["label"],
                "description": row["description"],
                "icon": "layers",
                "custom": True,
                "fields": json.loads(row["fields_json"]),
            }
        )
    return tabs


def _options(client_id: str) -> dict[str, list[str]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT category, value FROM client_options WHERE client_id = ? ORDER BY value COLLATE NOCASE ASC",
            (client_id,),
        ).fetchall()
    result: dict[str, list[str]] = {}
    for row in rows:
        result.setdefault(row["category"], []).append(row["value"])
    return result


def get_client_bundle(client_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    if not row:
        return None
    data = json.loads(row["data_json"] or "{}")
    if isinstance(data, dict):
        dietary = data.get("dietary")
        if isinstance(dietary, dict):
            legacy_water = dietary.pop("water_intake", None)
            if legacy_water:
                forms = data.get("forms")
                if not isinstance(forms, dict):
                    forms = {}
                    data["forms"] = forms
                if not forms.get("water_intake"):
                    forms["water_intake"] = legacy_water
    return {
        "client": _client_dict(row),
        "tabs": [*CORE_TABS, *_custom_tabs(client_id)],
        "data": data,
        "options": _options(client_id),
    }


def _save_headtoe_snapshot(conn: Any, client_id: str, headtoe: Any) -> None:
    if not isinstance(headtoe, dict) or not headtoe:
        return
    encoded = json.dumps(headtoe, sort_keys=True)
    latest = conn.execute(
        "SELECT data_json FROM client_snapshots WHERE client_id = ? AND kind = 'headtoe' ORDER BY created_at DESC LIMIT 1",
        (client_id,),
    ).fetchone()
    if latest and latest["data_json"] == encoded:
        return
    conn.execute(
        "INSERT INTO client_snapshots (id, client_id, kind, data_json, created_at) VALUES (?, ?, 'headtoe', ?, ?)",
        (str(uuid.uuid4()), client_id, encoded, _now()),
    )


def headtoe_history(client_id: str) -> list[dict[str, Any]] | None:
    with connect() as conn:
        exists = conn.execute("SELECT 1 FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not exists:
            return None
        rows = conn.execute(
            "SELECT id, data_json, created_at FROM client_snapshots WHERE client_id = ? AND kind = 'headtoe' ORDER BY created_at DESC",
            (client_id,),
        ).fetchall()
    return [{"id": row["id"], "created_at": row["created_at"], "data": json.loads(row["data_json"])} for row in rows]


def update_client(client_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    with connect() as conn:
        current = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not current:
            return None

        updates: list[str] = []
        values: list[Any] = []
        for key in ("name", "phone", "email", "city"):
            if key in payload and payload[key] is not None:
                value = str(payload[key]).strip()
                updates.append(f"{key} = ?")
                values.append(value)
        if "consent" in payload and payload["consent"] is not None:
            updates.append("consent = ?")
            values.append(1 if payload["consent"] else 0)
        if "start_date" in payload or "end_date" in payload:
            start_date = _clean_date(payload.get("start_date", current["start_date"]), "Start date")
            end_date = _clean_date(payload.get("end_date", current["end_date"]), "End date")
            _validate_dates(start_date, end_date)
            updates.extend(["start_date = ?", "end_date = ?"])
            values.extend([start_date, end_date])
        if "data" in payload and payload["data"] is not None:
            if not isinstance(payload["data"], dict):
                raise ValueError("data must be an object")
            updates.append("data_json = ?")
            values.append(json.dumps(payload["data"]))
        if updates:
            updates.append("updated_at = ?")
            values.append(_now())
            values.append(client_id)
            conn.execute(f"UPDATE clients SET {', '.join(updates)} WHERE id = ?", values)
        if "data" in payload and isinstance(payload["data"], dict):
            _save_headtoe_snapshot(conn, client_id, payload["data"].get("headtoe"))
    return get_client_bundle(client_id)


def add_option(client_id: str, category: str, value: str) -> list[str] | None:
    category = category.strip()
    value = value.strip()
    if not category or not value:
        raise ValueError("category and value are required")
    if len(value) > 80:
        raise ValueError("value is too long")
    with connect() as conn:
        exists = conn.execute("SELECT 1 FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not exists:
            return None
        existing = conn.execute(
            "SELECT value FROM client_options WHERE client_id = ? AND category = ? AND value = ? COLLATE NOCASE",
            (client_id, category, value),
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT OR IGNORE INTO client_options (id, client_id, category, value, created_at) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), client_id, category, value, _now()),
            )
        rows = conn.execute(
            "SELECT value FROM client_options WHERE client_id = ? AND category = ? ORDER BY value COLLATE NOCASE ASC",
            (client_id, category),
        ).fetchall()
    return [row["value"] for row in rows]


def create_tab(client_id: str, label: str, description: str, raw_fields: list[dict[str, Any]]) -> dict[str, Any] | None:
    label = label.strip()
    if not label:
        raise ValueError("Tab name is required")
    if len(label) > 60:
        raise ValueError("Tab name is too long")
    if not raw_fields:
        raise ValueError("Add at least one field")

    fields: list[dict[str, Any]] = []
    used_ids: set[str] = set()
    for index, item in enumerate(raw_fields):
        field_label = str(item.get("label", "")).strip()
        field_type = str(item.get("type", "text"))
        if not field_label:
            raise ValueError("Every field needs a label")
        if field_type not in ALLOWED_FIELD_TYPES:
            raise ValueError(f"Unsupported field type: {field_type}")
        field_id = _slug(field_label, f"field_{index + 1}")
        base_id = field_id
        suffix = 2
        while field_id in used_ids:
            field_id = f"{base_id}_{suffix}"
            suffix += 1
        used_ids.add(field_id)
        options = [str(option).strip() for option in item.get("options", []) if str(option).strip()]
        fields.append(
            {
                "id": field_id,
                "label": field_label,
                "type": field_type,
                "required": False,
                "span": int(item.get("span", 1)) if item.get("span") in (1, 2, 3) else 1,
                "options": options,
                "placeholder": str(item.get("placeholder", "")),
                "help": str(item.get("help", "")),
            }
        )

    tab_id = f"custom-{uuid.uuid4().hex[:8]}"
    with connect() as conn:
        exists = conn.execute("SELECT 1 FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not exists:
            return None
        position = conn.execute(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM client_tabs WHERE client_id = ?", (client_id,)
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO client_tabs (id, client_id, label, description, fields_json, position, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
            (tab_id, client_id, label, description.strip(), json.dumps(fields), position, _now()),
        )
    return {
        "id": tab_id,
        "label": label,
        "description": description.strip(),
        "icon": "layers",
        "custom": True,
        "fields": fields,
    }
