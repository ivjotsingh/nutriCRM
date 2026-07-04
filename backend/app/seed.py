from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

SEED_DIR = Path(__file__).parent / "seed_data"


@lru_cache(maxsize=None)
def load_seed(name: str) -> Any:
    with (SEED_DIR / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def food_catalog() -> list[dict[str, Any]]:
    return load_seed("food_catalog.json")


def meal_templates() -> dict[str, Any]:
    return load_seed("meal_slot_templates.json")


def triage_rules() -> dict[str, Any]:
    return load_seed("triage_rules.json")


def case_examples() -> list[dict[str, Any]]:
    return load_seed("case_examples.json")


def plan_format_examples() -> dict[str, Any]:
    return load_seed("plan_format_examples.json")

