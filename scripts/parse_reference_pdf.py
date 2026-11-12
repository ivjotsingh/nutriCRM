"""Parse the reference Quanutrition/Zoconut plan PDF into structured plan JSON.

The reference is an A4 plan exported from Zoconut: an orange band opens every meal
slot ("Breakfast at 10:00 AM" plus the "Portion" / "Calories" column headers) and
each row holds a dish, an optional note, a portion and a calorie value. Portion and
calorie cells are vertically centred, so rows are paired by order rather than by y.

Usage:  python scripts/parse_reference_pdf.py <pdf> <out.json>
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict

import pymupdf

DAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
COL_DISH, COL_PORTION = 434.0, 524.0
FOOTER_Y = 802
ORANGE = (0.996, 0.569, 0.322)


def cluster(words, tol=2.4):
    buckets: dict[float, list] = defaultdict(list)
    for w in words:
        buckets[round(w[1] / tol)].append(w)
    out = []
    for key in sorted(buckets):
        group = sorted(buckets[key], key=lambda w: w[0])
        out.append(
            {
                "y": sum((w[1] + w[3]) / 2 for w in group) / len(group),
                "text": " ".join(w[4] for w in group).strip(),
            }
        )
    return out


def looks_like_name(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return True
    return sum(1 for c in letters if c.isupper()) / len(letters) >= 0.6


def parse_page(page):
    words = [w for w in page.get_text("words") if (w[1] + w[3]) / 2 < FOOTER_Y]
    raw = []
    for drawing in page.get_drawings():
        fill, rect = drawing.get("fill"), drawing["rect"]
        if fill and all(abs(fill[i] - ORANGE[i]) < 0.03 for i in range(3)) and rect.height > 12:
            raw.append((round(rect.y0, 1), round(rect.y1, 1)))
    raw.sort()
    bands: list[tuple[float, float]] = []
    for a, b in raw:
        if bands and a <= bands[-1][1] + 2:
            bands[-1] = (bands[-1][0], max(bands[-1][1], b))
        else:
            bands.append((a, b))

    def band_at(y):
        for a, b in bands:
            if a - 1 <= y <= b + 1:
                return (a, b)
        return None

    left = cluster([w for w in words if w[0] < COL_DISH])
    mid = cluster([w for w in words if COL_DISH <= w[0] < COL_PORTION])
    cal = cluster([w for w in words if w[0] >= COL_PORTION])

    title_line = None
    if left and left[0]["y"] < 30 and left[0]["text"].split()[0] in DAYS:
        title_line = left[0]
        left = left[1:]

    events = []
    for portion in mid:
        match = next((c for c in cal if abs(c["y"] - portion["y"]) < 5), None)
        events.append({"y": portion["y"], "portion": portion["text"], "calories": match["text"] if match else ""})
        if match:
            match["_used"] = True
    for calorie in cal:
        if not calorie.get("_used"):
            events.append({"y": calorie["y"], "portion": "", "calories": calorie["text"]})
    events.sort(key=lambda e: e["y"])

    def build(events, left_lines):
        meals: list[dict] = []
        notes: list[str] = []
        consumed: set[int] = set()
        for event in events:
            best = None
            for index, line in enumerate(left_lines):
                if line["y"] > event["y"] + 9:
                    continue
                if line["text"].lower().startswith(("note", "meal note")):
                    continue
                if not looks_like_name(line["text"]):
                    continue
                if best is None or line["y"] > left_lines[best]["y"]:
                    best = index
            if best is None:
                continue
            line = left_lines[best]
            value = None
            found = re.search(r"\d+(?:\.\d+)?", event["calories"])
            if found:
                value = float(found.group())
            if best in consumed:
                if meals and meals[-1]["_y"] == line["y"]:
                    meals[-1]["portion"] = (meals[-1]["portion"] + " " + event["portion"]).strip()
                    if meals[-1]["calories"] is None:
                        meals[-1]["calories"] = value
                continue
            consumed.add(best)
            name = line["text"]
            if name.lower().startswith("or "):
                if meals:
                    meals[-1].setdefault("alternatives", []).append(
                        {"name": name[3:].strip(), "portion": event["portion"], "calories": value, "note": ""}
                    )
                continue
            meals.append(
                {"name": name, "portion": event["portion"], "calories": value, "note": "", "alternatives": [], "_y": line["y"]}
            )
        for index, line in enumerate(left_lines):
            if index in consumed:
                continue
            text, low = line["text"], line["text"].lower()
            above = [m for m in meals if m["_y"] < line["y"]]
            owner = max(above, key=lambda m: m["_y"]) if above else None
            body = text.split(":", 1)[-1].strip() if low.startswith(("note", "meal note")) else text
            if owner is not None:
                owner["note"] = (owner["note"] + " " + body).strip()
            else:
                notes.append(body)
        return meals, " ".join(notes).strip()

    if not bands:
        return (title_line["text"] if title_line else ""), [], {"note": "", "meals": []}

    slots = []
    for index, (a, b) in enumerate(bands):
        label_words = [w for w in words if a - 1 <= (w[1] + w[3]) / 2 <= b + 1 and w[0] < COL_DISH]
        label = " ".join(w[4] for w in sorted(label_words, key=lambda w: w[0])).strip()
        label = re.sub(r"\s+(Portion|Calories)$", "", label)
        slot = {"y": a, "name": label, "note": "", "meals": []}
        lower = bands[index + 1][0] if index + 1 < len(bands) else 10_000
        slot_events = [e for e in events if a < e["y"] < lower]
        slot_left = [l for l in left if a + 8 < l["y"] < lower and not band_at(l["y"])]
        slot["meals"], slot["note"] = build(slot_events, slot_left)
        if slot["name"]:
            slots.append(slot)

    first_band = bands[0][0]
    pre_events = [e for e in events if e["y"] < first_band]
    pre_left = [l for l in left if l["y"] < first_band]
    pre_meals, pre_note = build(pre_events, pre_left) if pre_events or pre_left else ([], "")
    if title_line is not None:
        pre_left = [l for l in pre_left if l is not title_line]
    return (title_line["text"] if title_line else ""), slots, {"note": pre_note, "meals": pre_meals}


def main(src: str, out: str) -> None:
    doc = pymupdf.open(src)
    days: list[dict] = []
    current = None
    for index in range(1, 21):
        title, slots, pre = parse_page(doc[index])
        first = title.split()[0] if title else ""
        if first in DAYS:
            current = {"day": first, "slots": [], "pages": [index + 1]}
            days.append(current)
        elif current is not None:
            current["pages"].append(index + 1)
        else:
            continue
        if pre["meals"] or pre["note"]:
            if current["slots"]:
                target = current["slots"][-1]
                target["meals"].extend(pre["meals"])
                if pre["note"]:
                    target["note"] = (target["note"] + " " + pre["note"]).strip()
            else:
                current["slots"].append({"name": "", "note": pre["note"], "meals": pre["meals"]})
        for slot in slots:
            if current["slots"] and current["slots"][-1]["name"] == slot["name"]:
                current["slots"][-1]["meals"].extend(slot["meals"])
                if slot["note"]:
                    current["slots"][-1]["note"] = (current["slots"][-1]["note"] + " " + slot["note"]).strip()
            else:
                current["slots"].append(slot)

    for day in days:
        for slot in day["slots"]:
            slot.pop("y", None)
            for meal in slot["meals"]:
                meal.pop("_y", None)

    json.dump(days, open(out, "w"), indent=2)
    for day in days:
        total = sum(m["calories"] or 0 for s in day["slots"] for m in s["meals"])
        missing = [m["name"] for s in day["slots"] for m in s["meals"] if m["calories"] is None]
        print(f"{day['day']:<10} slots={len(day['slots']):>2} meals={sum(len(s['meals']) for s in day['slots']):>2} kcal={total:7.1f} missing={missing}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
