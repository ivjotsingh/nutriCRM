"""Render a client diet plan as a print-ready A4 PDF.

The layout mirrors the reference export: a branded cover with customer and plan
details, one table per meal slot under an orange band, a recommendations page with
superfoods and the standard measurements guide, general guidelines, and disclaimer.
"""

from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import Flowable

from . import plan_reference as reference
from .plan_engine import derive

PAGE_W, PAGE_H = A4
MARGIN_L = 34
MARGIN_R = 34
MARGIN_TOP = 78
MARGIN_BOTTOM = 62
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

ORANGE = colors.HexColor("#F08A4B")
ORANGE_DARK = colors.HexColor("#D9692B")
ORANGE_SOFT = colors.HexColor("#FDF1E9")
ORANGE_LINE = colors.HexColor("#E9CDB9")
GREEN = colors.HexColor("#3F9B57")
INK = colors.HexColor("#2F2F2F")
MUTED = colors.HexColor("#6E6E6E")
FAINT = colors.HexColor("#8C8C8C")
PAPER = colors.HexColor("#FFFDFB")
GREY_BG = colors.HexColor("#F4F4F2")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_ITALIC = "Helvetica-Oblique"


def _esc(value: Any) -> str:
    text = str(value or "")
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


STYLES = {
    "day": ParagraphStyle("day", fontName=FONT_BOLD, fontSize=15, leading=19, textColor=ORANGE_DARK, spaceAfter=2),
    "heading": ParagraphStyle("heading", fontName=FONT_BOLD, fontSize=13.5, leading=17, textColor=ORANGE_DARK),
    "subheading": ParagraphStyle("subheading", fontName=FONT_BOLD, fontSize=10.5, leading=14, textColor=INK, spaceBefore=6, spaceAfter=4),
    "body": ParagraphStyle("body", fontName=FONT, fontSize=8.6, leading=12.4, textColor=INK, spaceAfter=2.5),
    "body_small": ParagraphStyle("body_small", fontName=FONT, fontSize=7.8, leading=11.2, textColor=MUTED),
    "bullet": ParagraphStyle("bullet", fontName=FONT, fontSize=8.6, leading=12.4, textColor=INK, leftIndent=10, bulletIndent=2),
    "cell": ParagraphStyle("cell", fontName=FONT, fontSize=8.3, leading=11.4, textColor=INK),
    "cell_name": ParagraphStyle("cell_name", fontName=FONT_BOLD, fontSize=8.5, leading=11.2, textColor=INK),
    "cell_note": ParagraphStyle("cell_note", fontName=FONT, fontSize=7.5, leading=10.2, textColor=MUTED),
    "cell_alt": ParagraphStyle("cell_alt", fontName=FONT_BOLD, fontSize=8.3, leading=11.2, textColor=INK),
    "band": ParagraphStyle("band", fontName=FONT_BOLD, fontSize=8.4, leading=10.5, textColor=colors.white),
    "band_right": ParagraphStyle("band_right", fontName=FONT_BOLD, fontSize=8.4, leading=10.5, textColor=colors.white, alignment=TA_RIGHT),
    "num": ParagraphStyle("num", fontName=FONT, fontSize=8.3, leading=11.2, textColor=INK),
    "meta_label": ParagraphStyle("meta_label", fontName=FONT, fontSize=8, leading=11, textColor=MUTED),
    "meta_value": ParagraphStyle("meta_value", fontName=FONT_BOLD, fontSize=8.6, leading=11.5, textColor=INK),
}


def _status_pill(text: str, background) -> Table:
    """A rounded status label built as a table so the text stays selectable."""
    table = Table(
        [[Paragraph(text, ParagraphStyle("pill", fontName=FONT_BOLD, fontSize=8.6, leading=11, textColor=colors.white))]],
        colWidths=[stringWidth(text, FONT_BOLD, 8.6) + 24],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROUNDEDCORNERS", (0, 0), (-1, -1), [4, 4, 4, 4]),
            ]
        )
    )
    return table


class Rule(Flowable):
    """Thin horizontal rule used under section headings."""

    def __init__(self, color=ORANGE_LINE, thickness: float = 0.9, space_before: float = 2, space_after: float = 8):
        super().__init__()
        self.color = color
        self.thickness = thickness
        self.space_before = space_before
        self.space_after = space_after

    def wrap(self, availWidth, availHeight):  # noqa: N802
        self.width = availWidth
        return availWidth, self.thickness + self.space_before + self.space_after

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        y = self.space_after
        self.canv.line(0, y, self.width, y)


class PlanDoc(BaseDocTemplate):
    def __init__(self, buffer, plan: dict[str, Any], client: dict[str, Any], **kwargs):
        super().__init__(
            buffer,
            pagesize=A4,
            leftMargin=MARGIN_L,
            rightMargin=MARGIN_R,
            topMargin=MARGIN_TOP,
            bottomMargin=MARGIN_BOTTOM,
            title=plan["meta"].get("title") or "Diet plan",
            author=(plan.get("brand") or {}).get("name", "NutriAlign"),
            subject=f"Nutrition plan for {client.get('name', 'client')}",
            **kwargs,
        )
        self.plan = plan
        self.client = client
        self.brand = plan.get("brand") or reference.DEFAULT_BRAND
        frame = Frame(MARGIN_L, MARGIN_BOTTOM, CONTENT_W, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM, id="body",
                      leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate(id="plan", frames=[frame], onPage=self._chrome)])

    # ------------------------------------------------------------------ chrome
    def _chrome(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(PAPER)
        canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

        brand = self.brand
        name = (brand.get("name") or "NutriAlign").upper()
        canvas.setFillColor(ORANGE_DARK)
        canvas.setFont(FONT_BOLD, 17)
        canvas.drawCentredString(PAGE_W / 2, PAGE_H - 46, name)
        canvas.setFillColor(FAINT)
        canvas.setFont(FONT, 7.2)
        tagline = brand.get("tagline") or ""
        if tagline:
            canvas.drawCentredString(PAGE_W / 2, PAGE_H - 56, tagline)
        canvas.setStrokeColor(ORANGE_LINE)
        canvas.setLineWidth(0.7)
        canvas.line(MARGIN_L, PAGE_H - 62, PAGE_W - MARGIN_R, PAGE_H - 62)

        # footer
        canvas.setStrokeColor(ORANGE_LINE)
        canvas.setLineWidth(0.7)
        canvas.line(MARGIN_L, 48, PAGE_W - MARGIN_R, 48)
        canvas.setFillColor(colors.HexColor("#4A4A4A"))
        canvas.setFont(FONT, 7.2)
        baseline = 34
        columns = [
            (MARGIN_L, f"{brand.get('name', 'NutriAlign')}"),
            (MARGIN_L + 110, brand.get("email", "")),
            (MARGIN_L + 290, brand.get("phone", "")),
        ]
        for x, text in columns:
            if text:
                canvas.drawString(x, baseline, str(text))
        powered = f"Powered by {brand.get('powered_by', 'NutriAlign')}"
        canvas.drawRightString(PAGE_W - MARGIN_R, baseline, powered)
        canvas.setFillColor(FAINT)
        canvas.setFont(FONT, 6.8)
        canvas.drawRightString(PAGE_W - MARGIN_R, 56, f"Page {doc.page}")
        canvas.restoreState()


# --------------------------------------------------------------------- helpers
def _fmt_date(value: str) -> str:
    import datetime as dt

    try:
        parsed = dt.date.fromisoformat(str(value)[:10])
    except ValueError:
        return str(value or "")
    return parsed.strftime("%d %b %Y")


def _client_rows(client: dict[str, Any], data: dict[str, Any]) -> list[tuple[str, str]]:
    basic = data.get("basic") or {}
    bca = data.get("bca") or {}
    medical = data.get("medical") or {}
    gender = basic.get("gender") or ""
    name = client.get("name") or basic.get("name") or "Client"
    weight = bca.get("weight_kg") or plan.get("clinical", {}).get("weight_kg") or ""
    rows = [
        ("Client", f"{name}{f' | {gender}' if gender else ''}"),
        ("Date of birth", _fmt_date(basic.get("dob", "")) if basic.get("dob") else "—"),
        ("Current weight", f"{weight} kg" if weight else "—"),
        ("Blood group", basic.get("blood_group") or "—"),
        ("Phone number", client.get("phone") or basic.get("phone") or "—"),
        ("Goals", medical.get("primary_goal") or plan.get("clinical", {}).get("goal") or "—"),
    ]
    return rows


def _cover(plan: dict[str, Any], client: dict[str, Any], data: dict[str, Any], derived: dict[str, Any]) -> list[Any]:
    meta = plan["meta"]
    story: list[Any] = [Spacer(1, 18)]
    published = meta.get("status") == "published"
    story.append(_status_pill("Plan Approved" if published else "Draft preview", GREEN if published else colors.HexColor("#9A9A9A")))
    story.append(Spacer(1, 22))
    story.append(Paragraph("Customer Information", STYLES["heading"]))
    story.append(Rule())

    rows = _client_rows(client, data)
    cells = []
    for label, value in rows:
        cells.append(
            [
                Paragraph(f"<b>- {_esc(label)} :</b> {_esc(value)}", STYLES["body"]),
            ]
        )
    # three columns, two rows
    grid = []
    for row_index in range(0, len(rows), 3):
        line = []
        for column in range(3):
            index = row_index + column
            if index < len(rows):
                label, value = rows[index]
                line.append(Paragraph(f"<b>- {_esc(label)} :</b> {_esc(value)}", STYLES["body"]))
            else:
                line.append(Paragraph("", STYLES["body"]))
        grid.append(line)
    table = Table(grid, colWidths=[CONTENT_W / 3] * 3, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 22))

    story.append(Paragraph("Plan Details", STYLES["heading"]))
    story.append(Rule())
    details = [
        ("Plan title", meta.get("title", "")),
        ("Plan period", f"{_fmt_date(meta.get('start_date', ''))} – {_fmt_date(meta.get('end_date', ''))} · {meta.get('duration_days', 7)} days"),
        ("Diet type", meta.get("diet_type", "")),
        ("Strategy", meta.get("strategy_name") or "—"),
        ("Prepared by", meta.get("prepared_by") or "—"),
        ("Approved on", _fmt_date(meta.get("published_at", "")) if meta.get("published_at") else "Draft — not published"),
    ]
    detail_rows = [[Paragraph(f"<b>{_esc(label)}</b>", STYLES["meta_label"]), Paragraph(_esc(value), STYLES["meta_value"])] for label, value in details]
    detail_table = Table(detail_rows, colWidths=[110, CONTENT_W - 110], hAlign="LEFT")
    detail_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, ORANGE_LINE),
            ]
        )
    )
    story.append(detail_table)
    story.append(Spacer(1, 26))

    targets = plan.get("targets") or {}
    average = derived["totals"]["avg_calories"]
    metrics = [
        ("Daily energy target", f"{targets.get('calories', 0):,}", "kcal"),
        ("Protein", f"{targets.get('protein_g', 0)}", "g / day"),
        ("Carbohydrate", f"{targets.get('carbs_g', 0)}", "g / day"),
        ("Fat", f"{targets.get('fat_g', 0)}", "g / day"),
    ]
    def metric_cell(label: str, value: str, unit: str) -> Table:
        inner = Table(
            [
                [Paragraph(_esc(label).upper(), ParagraphStyle("ml", fontName=FONT, fontSize=6.8, leading=11, textColor=MUTED))],
                [Paragraph(f"<b>{_esc(value)}</b> <font size=7 color='#6E6E6E'>{_esc(unit)}</font>", ParagraphStyle("mv", fontName=FONT_BOLD, fontSize=17, leading=17, textColor=INK))],
            ],
            colWidths=[CONTENT_W / 4 - 20],
        )
        inner.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (0, 0), 1),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 0),
        ]))
        return inner

    metric_cells = [[metric_cell(label, value, unit) for label, value, unit in metrics]]
    metric_table = Table(metric_cells, colWidths=[CONTENT_W / 4] * 4, hAlign="LEFT")
    metric_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ORANGE_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, ORANGE_LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, ORANGE_LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(metric_table)
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            f"Seven-day average from the plan: <b>{average:,} kcal</b> · {derived['totals']['meals']} meals across "
            f"{derived['totals']['days_with_meals']} days. Daily targets may differ by training load.",
            STYLES["body_small"],
        )
    )

    restrictions = (plan.get("clinical") or {}).get("restrictions") or []
    allergies = (plan.get("clinical") or {}).get("allergies") or []
    if restrictions or allergies:
        story.append(Spacer(1, 6))
        bits = []
        if allergies:
            bits.append("Allergies: " + ", ".join(allergies))
        if restrictions:
            bits.append("Restrictions: " + ", ".join(restrictions))
        story.append(Paragraph(" · ".join(bits), STYLES["body_small"]))

    story.append(PageBreak())
    return story


def _meal_cells(meal: dict[str, Any]) -> tuple[list[Any], list[Any], list[Any]]:
    name_parts = [Paragraph(_esc(meal.get("name", "")), STYLES["cell_name"])]
    if meal.get("note"):
        name_parts.append(Paragraph(f"Note: {_esc(meal['note'])}", STYLES["cell_note"]))
    if meal.get("recipe"):
        name_parts.append(Paragraph(f"Recipe: {_esc(meal['recipe'])}", STYLES["cell_note"]))
    portions = [Paragraph(_esc(meal.get("portion", "")), STYLES["num"])]
    calories = [Paragraph(f"{meal.get('calories', 0):.2f}", STYLES["num"])]
    for alt in meal.get("alternatives") or []:
        name_parts.append(Paragraph(f"<font color='#6E6E6E'>or</font> {_esc(alt.get('name', ''))}", STYLES["cell_alt"]))
        portions.append(Paragraph(_esc(alt.get("portion", "")), STYLES["num"]))
        calories.append(Paragraph(f"{alt.get('calories', 0):.2f}", STYLES["num"]))
    return name_parts, portions, calories


def _slot_table(slot: dict[str, Any]) -> Table:
    header_label = slot.get("name", "Meal")
    if slot.get("time"):
        header_label = f"{header_label} at {slot['time']}"
    rows: list[list[Any]] = [
        [
            Paragraph(_esc(header_label), STYLES["band"]),
            Paragraph("Portion", STYLES["band_right"]),
            Paragraph("Calories", STYLES["band_right"]),
        ]
    ]
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), ORANGE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.4, ORANGE_LINE),
        ("VALIGN", (1, 1), (-1, -1), "MIDDLE"),
    ]
    if slot.get("note"):
        rows.append([Paragraph(f"Meal note: {_esc(slot['note'])}", STYLES["cell_note"]), "", ""])
        style_commands += [
            ("SPAN", (0, len(rows) - 1), (-1, len(rows) - 1)),
            ("BACKGROUND", (0, len(rows) - 1), (-1, len(rows) - 1), ORANGE_SOFT),
        ]
    for meal in slot.get("meals") or []:
        name_parts, portions, calories = _meal_cells(meal)
        rows.append([name_parts, portions, calories])
    table = Table(rows, colWidths=[CONTENT_W - 128, 78, 50], hAlign="LEFT", repeatRows=1)
    table.setStyle(TableStyle(style_commands))
    return table


def _day_section(day: dict[str, Any], plan: dict[str, Any], derived_day: dict[str, Any] | None) -> list[Any]:
    meta = plan["meta"]
    story: list[Any] = []
    title = Paragraph(_esc(day["day"]), STYLES["day"])
    date_label = _fmt_date(day.get("date", ""))
    if day.get("fast_day"):
        date_label = f"{date_label} · Fast day" if date_label else "Fast day"
    head = Table(
        [[title, Paragraph(_esc(date_label), ParagraphStyle("date", fontName=FONT, fontSize=8, leading=10, textColor=FAINT, alignment=TA_RIGHT))]],
        colWidths=[CONTENT_W - 150, 150],
    )
    head.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    story.append(head)

    if derived_day and (plan.get("extras") or {}).get("show_targets", True):
        target = derived_day.get("target_calories") or 0
        planned = derived_day.get("calories") or 0
        if target:
            diff = planned - target
            sign = "+" if diff >= 0 else "−"
            summary = (
                f"Planned <b>{planned:,.0f} kcal</b> · Target {target:,} kcal · "
                f"Difference {sign}{abs(diff):,.0f} kcal · Protein {derived_day.get('protein', 0):.0f} g"
            )
        else:
            summary = f"Planned <b>{planned:,.0f} kcal</b> · Protein {derived_day.get('protein', 0):.0f} g"
        story.append(Paragraph(summary, STYLES["body_small"]))
    story.append(Spacer(1, 7))

    if not day.get("slots"):
        story.append(Paragraph("No meals planned for this day.", STYLES["body_small"]))
    for slot in day.get("slots") or []:
        table = _slot_table(slot)
        row_count = 1 + len(slot.get("meals") or [])
        if row_count <= 7:
            story.append(KeepTogether([table, Spacer(1, 3)]))
        else:
            story.append(table)
            story.append(Spacer(1, 3))
    if day.get("notes"):
        note_table = Table(
            [[Paragraph(f"<b>Diet notes:</b> {_esc(day['notes'])}", STYLES["body"])]],
            colWidths=[CONTENT_W],
            hAlign="LEFT",
        )
        note_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), GREY_BG),
                    ("BOX", (0, 0), (-1, -1), 0.4, ORANGE_LINE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(Spacer(1, 4))
        story.append(KeepTogether([note_table]))
    return story


def _recommendations(plan: dict[str, Any]) -> list[Any]:
    extras = plan.get("extras") or {}
    selected = [item for item in reference.SUPERFOODS if item["id"] in (extras.get("superfoods") or [])]
    story: list[Any] = [PageBreak(), Spacer(1, 4)]
    story.append(Paragraph("Recommendations", STYLES["heading"]))
    story.append(Rule())
    if selected:
        story.append(Paragraph("Super foods recommended", STYLES["subheading"]))
        rows: list[list[Any]] = [[Paragraph("<b>Superfood</b>", STYLES["cell"]), Paragraph("<b>Recommendation (if)</b>", STYLES["cell"])]]
        for item in selected:
            rows.append([Paragraph(_esc(item["name"]), STYLES["cell"]), Paragraph(_esc(item["note"]), STYLES["cell"])])
        table = Table(rows, colWidths=[130, CONTENT_W - 130], hAlign="LEFT", repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F2F2")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 12))
    if extras.get("measurements", True):
        story.append(Paragraph("Standard measurements guide", STYLES["subheading"]))
        rows = [[Paragraph(_esc(line), STYLES["cell"])] for line in reference.MEASUREMENT_GUIDE]
        table = Table(rows, colWidths=[CONTENT_W * 0.62], hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(table)
    for note in extras.get("custom_notes") or []:
        if note.get("heading"):
            story.append(Paragraph(_esc(note["heading"]), STYLES["subheading"]))
        if note.get("body"):
            story.append(Paragraph(_esc(note["body"]), STYLES["body"]))
    return story


def _guidelines(plan: dict[str, Any]) -> list[Any]:
    selected = (plan.get("extras") or {}).get("guidelines") or []
    items = [item for item in reference.GUIDELINES if item["id"] in selected]
    if not items:
        return []
    story: list[Any] = [PageBreak(), Spacer(1, 4)]
    story.append(Paragraph("General guidelines", STYLES["heading"]))
    story.append(Rule())
    for index, item in enumerate(items, start=1):
        block: list[Any] = [
            Paragraph(
                f"{index}. {_esc(item['title'])}",
                ParagraphStyle("gh", fontName=FONT_BOLD, fontSize=9.2, leading=12, textColor=INK, spaceBefore=2),
            )
        ]
        for paragraph in item.get("paragraphs") or []:
            block.append(Paragraph(_esc(paragraph), STYLES["body"]))
        for bullet in item.get("bullets") or []:
            block.append(Paragraph(_esc(bullet), STYLES["bullet"], bulletText="•"))
        for paragraph in item.get("after") or []:
            block.append(Paragraph(_esc(paragraph), STYLES["body"]))
        block.append(Spacer(1, 7))
        # keep the heading with at least the first paragraph
        story.append(KeepTogether(block[:4]))
        story.extend(block[4:])
    return story


def _disclaimer(plan: dict[str, Any]) -> list[Any]:
    if not (plan.get("extras") or {}).get("disclaimer", True):
        return []
    story: list[Any] = [PageBreak(), Spacer(1, 4)]
    story.append(Paragraph("Disclaimer", STYLES["heading"]))
    story.append(Rule())
    for index, paragraph in enumerate(reference.DISCLAIMER, start=1):
        story.append(Paragraph(f"<b>{index}.</b> {_esc(paragraph)}", STYLES["body"]))
        story.append(Spacer(1, 4))
    return story


def build_pdf(plan: dict[str, Any], bundle: dict[str, Any]) -> bytes:
    client = bundle.get("client") or {}
    data = bundle.get("data") or {}
    derived = derive(plan, bundle)
    derived_by_day = {day["day"]: day for day in derived["days"]}

    story: list[Any] = []
    story.extend(_cover(plan, client, data, derived))
    for index, day in enumerate(plan["days"]):
        if index:
            story.append(PageBreak())
        story.extend(_day_section(day, plan, derived_by_day.get(day["day"])))
    story.extend(_recommendations(plan))
    story.extend(_guidelines(plan))
    story.extend(_disclaimer(plan))

    buffer = io.BytesIO()
    doc = PlanDoc(buffer, plan, client)
    doc.build(story)
    return buffer.getvalue()
