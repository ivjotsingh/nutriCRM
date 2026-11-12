from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_path() -> Path:
    return Path(os.environ.get("NUTRIALIGN_DB", Path(__file__).resolve().parents[1] / "nutrialign.db"))


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS leads (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              phone TEXT NOT NULL,
              city TEXT NOT NULL,
              status TEXT NOT NULL,
              triage_outcome TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS intakes (
              id TEXT PRIMARY KEY,
              lead_id TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (lead_id) REFERENCES leads(id)
            );

            CREATE TABLE IF NOT EXISTS plans (
              id TEXT PRIMARY KEY,
              lead_id TEXT NOT NULL,
              plan_type TEXT NOT NULL,
              content_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (lead_id) REFERENCES leads(id)
            );

            CREATE TABLE IF NOT EXISTS check_ins (
              id TEXT PRIMARY KEY,
              lead_id TEXT NOT NULL,
              day_number INTEGER NOT NULL,
              payload_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (lead_id) REFERENCES leads(id)
            );

            CREATE TABLE IF NOT EXISTS upgrade_intents (
              id TEXT PRIMARY KEY,
              lead_id TEXT NOT NULL,
              plan_type TEXT NOT NULL,
              contact_preference TEXT NOT NULL,
              message TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (lead_id) REFERENCES leads(id)
            );

            CREATE TABLE IF NOT EXISTS events (
              id TEXT PRIMARY KEY,
              lead_id TEXT,
              event_type TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS clients (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              phone TEXT NOT NULL,
              email TEXT NOT NULL DEFAULT '',
              city TEXT NOT NULL DEFAULT '',
              consent INTEGER NOT NULL DEFAULT 0,
              start_date TEXT NOT NULL DEFAULT '',
              end_date TEXT NOT NULL DEFAULT '',
              data_json TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS client_tabs (
              id TEXT PRIMARY KEY,
              client_id TEXT NOT NULL,
              label TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              fields_json TEXT NOT NULL,
              position INTEGER NOT NULL DEFAULT 0,
              archived INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY (client_id) REFERENCES clients(id)
            );

            CREATE TABLE IF NOT EXISTS client_options (
              id TEXT PRIMARY KEY,
              client_id TEXT NOT NULL,
              category TEXT NOT NULL,
              value TEXT NOT NULL,
              created_at TEXT NOT NULL,
              UNIQUE (client_id, category, value),
              FOREIGN KEY (client_id) REFERENCES clients(id)
            );

            CREATE TABLE IF NOT EXISTS client_snapshots (
              id TEXT PRIMARY KEY,
              client_id TEXT NOT NULL,
              kind TEXT NOT NULL,
              data_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (client_id) REFERENCES clients(id)
            );
            """
        )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(clients)").fetchall()}
        for column in ("start_date", "end_date"):
            if column not in columns:
                conn.execute(f"ALTER TABLE clients ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")


def record_intake(intake: dict[str, Any], triage: dict[str, Any], result_type: str, result: dict[str, Any]) -> str:
    lead_id = str(uuid.uuid4())
    now = _now()
    status = "ai_plan_ready" if result_type == "plan" else "dietician_review_recommended"
    with connect() as conn:
        conn.execute(
            "INSERT INTO leads (id, name, phone, city, status, triage_outcome, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (lead_id, intake["name"], intake["phone"], intake["city"], status, "eligible" if result_type == "plan" else "risk", now, now),
        )
        conn.execute(
            "INSERT INTO intakes (id, lead_id, payload_json, created_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), lead_id, json.dumps(intake), now),
        )
        conn.execute(
            "INSERT INTO plans (id, lead_id, plan_type, content_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), lead_id, result_type, json.dumps(result), now),
        )
        conn.execute(
            "INSERT INTO events (id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), lead_id, "triage_evaluated", json.dumps(triage), now),
        )
        conn.execute(
            "INSERT INTO events (id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), lead_id, "plan_generated" if result_type == "plan" else "risk_routed", json.dumps({"result_type": result_type}), now),
        )
    return lead_id


def list_leads() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT leads.*,
              (SELECT COUNT(*) FROM check_ins WHERE check_ins.lead_id = leads.id) AS check_in_count,
              (SELECT COUNT(*) FROM upgrade_intents WHERE upgrade_intents.lead_id = leads.id) AS upgrade_count
            FROM leads
            ORDER BY created_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_lead(lead_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        lead = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
        if not lead:
            return None
        intake = conn.execute("SELECT * FROM intakes WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1", (lead_id,)).fetchone()
        plan = conn.execute("SELECT * FROM plans WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1", (lead_id,)).fetchone()
        check_ins = conn.execute("SELECT * FROM check_ins WHERE lead_id = ? ORDER BY day_number ASC, created_at ASC", (lead_id,)).fetchall()
        upgrades = conn.execute("SELECT * FROM upgrade_intents WHERE lead_id = ? ORDER BY created_at DESC", (lead_id,)).fetchall()
        events = conn.execute("SELECT * FROM events WHERE lead_id = ? ORDER BY created_at DESC", (lead_id,)).fetchall()

    return {
        "lead": dict(lead),
        "intake": json.loads(intake["payload_json"]) if intake else None,
        "plan_record": {
            **dict(plan),
            "content": json.loads(plan["content_json"]),
        }
        if plan
        else None,
        "check_ins": [{**dict(row), "payload": json.loads(row["payload_json"])} for row in check_ins],
        "upgrade_intents": [dict(row) for row in upgrades],
        "events": [{**dict(row), "payload": json.loads(row["payload_json"])} for row in events],
    }


def add_check_in(lead_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    now = _now()
    row_id = str(uuid.uuid4())
    with connect() as conn:
        conn.execute(
            "INSERT INTO check_ins (id, lead_id, day_number, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (row_id, lead_id, payload["day_number"], json.dumps(payload), now),
        )
        conn.execute("UPDATE leads SET updated_at = ? WHERE id = ?", (now, lead_id))
        conn.execute(
            "INSERT INTO events (id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), lead_id, "check_in_submitted", json.dumps(payload), now),
        )
    return {"id": row_id, "lead_id": lead_id, "payload": payload, "created_at": now}


def add_upgrade_intent(lead_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    now = _now()
    row_id = str(uuid.uuid4())
    with connect() as conn:
        conn.execute(
            "INSERT INTO upgrade_intents (id, lead_id, plan_type, contact_preference, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (row_id, lead_id, payload["plan_type"], payload["contact_preference"], payload.get("message", ""), now),
        )
        conn.execute("UPDATE leads SET status = ?, updated_at = ? WHERE id = ?", ("upgrade_intent", now, lead_id))
        conn.execute(
            "INSERT INTO events (id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), lead_id, "upgrade_intent_captured", json.dumps(payload), now),
        )
    return {"id": row_id, "lead_id": lead_id, **payload, "created_at": now}


def add_event(lead_id: str | None, event_type: str, payload: dict[str, Any] | None = None) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO events (id, lead_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), lead_id, event_type, json.dumps(payload or {}), _now()),
        )

