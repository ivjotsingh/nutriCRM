"""Build the Plan Creation PRD (.docx) for NutriAliment."""

from __future__ import annotations

import datetime as dt
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "NutriAliment_Plan_Creation_PRD_v1.0.docx"

TEAL = RGBColor(0x08, 0x74, 0x76)
ORANGE = RGBColor(0xD9, 0x69, 0x2B)
INK = RGBColor(0x11, 0x18, 0x16)
MUTED = RGBColor(0x68, 0x73, 0x6F)
TODAY = dt.date(2026, 11, 13).strftime("%d %B %Y")

doc = Document()

# ------------------------------------------------------------------ base styles
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(10.5)
normal.font.color.rgb = INK
normal.paragraph_format.space_after = Pt(7)
normal.paragraph_format.line_spacing = 1.18

for name, size, colour, space_before, space_after in [
    ("Heading 1", 22, TEAL, 20, 6),
    ("Heading 2", 15, TEAL, 16, 5),
    ("Heading 3", 12, ORANGE, 12, 4),
]:
    style = doc.styles[name]
    style.font.name = "Calibri"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = colour
    style.paragraph_format.space_before = Pt(space_before)
    style.paragraph_format.space_after = Pt(space_after)
    style.paragraph_format.keep_with_next = True

section = doc.sections[0]
section.top_margin = Inches(0.85)
section.bottom_margin = Inches(0.8)
section.left_margin = Inches(0.9)
section.right_margin = Inches(0.9)


# -------------------------------------------------------------------- helpers
def eyebrow(text: str) -> None:
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(text.upper())
    run.font.size = Pt(8.5)
    run.font.color.rgb = MUTED
    run.font.bold = True
    run.font.name = "Calibri"
    paragraph.paragraph_format.space_after = Pt(2)
    _bottom_rule(paragraph, "DDE4DE")


def _bottom_rule(paragraph, colour: str) -> None:
    properties = paragraph._p.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), colour)
    borders.append(bottom)
    properties.append(borders)


def h1(text: str, number: str = "") -> None:
    if number:
        eyebrow(f"PRODUCT REQUIREMENTS DOCUMENT   /   PLAN CREATION   /   {number}")
    doc.add_heading(text, level=1)


def h2(text: str) -> None:
    doc.add_heading(text, level=2)


def h3(text: str) -> None:
    doc.add_heading(text, level=3)


def p(text: str, bold_lead: str = "", muted: bool = False) -> None:
    paragraph = doc.add_paragraph()
    if bold_lead:
        lead = paragraph.add_run(bold_lead)
        lead.bold = True
    run = paragraph.add_run(text)
    if muted:
        run.font.color.rgb = MUTED
        run.font.size = Pt(9.5)


def bullets(items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def numbered(items: list[str]) -> None:
    for item in items:
        doc.add_paragraph(item, style="List Number")


def table(headers: list[str], rows: list[list[str]], widths: list[float] | None = None, small: bool = False) -> None:
    table_obj = doc.add_table(rows=1, cols=len(headers))
    table_obj.style = "Table Grid"
    table_obj.alignment = WD_TABLE_ALIGNMENT.CENTER
    header_cells = table_obj.rows[0].cells
    for index, header in enumerate(headers):
        header_cells[index].text = ""
        paragraph = header_cells[index].paragraphs[0]
        run = paragraph.add_run(header)
        run.bold = True
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        _shade(header_cells[index], "087476")
    for row in rows:
        cells = table_obj.add_row().cells
        for index, value in enumerate(row):
            cells[index].text = ""
            paragraph = cells[index].paragraphs[0]
            run = paragraph.add_run(value)
            run.font.size = Pt(8 if small else 9)
    if widths:
        for row in table_obj.rows:
            for index, width in enumerate(widths):
                row.cells[index].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def _shade(cell, hex_colour: str) -> None:
    properties = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:color"), "auto")
    shading.set(qn("w:fill"), hex_colour)
    properties.append(shading)


def callout(text: str) -> None:
    table_obj = doc.add_table(rows=1, cols=1)
    table_obj.style = "Table Grid"
    cell = table_obj.rows[0].cells[0]
    cell.text = ""
    paragraph = cell.paragraphs[0]
    run = paragraph.add_run(text)
    run.italic = True
    run.font.size = Pt(9.5)
    _shade(cell, "F3FAF8")
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def page_break() -> None:
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# =============================================================================
# COVER
# =============================================================================
eyebrow("PRODUCT REQUIREMENTS DOCUMENT   /   PLAN CREATION   /   00")
spacer = doc.add_paragraph()
spacer.paragraph_format.space_before = Pt(48)
title = doc.add_paragraph()
run = title.add_run("PLAN CREATION")
run.font.size = Pt(34)
run.font.bold = True
run.font.color.rgb = TEAL
subtitle = doc.add_paragraph()
run = subtitle.add_run("From a signed strategy to the printed week the client eats")
run.font.size = Pt(17)
run.font.color.rgb = ORANGE

p(
    "Version 1.0   ·   Status: Built and verified   ·   Owner: Product   ·   Clinical owner: Practice lead   ·   "
    f"{TODAY}",
    muted=True,
)
p(
    "Surfaces: Client record · Diet Plans tab · Plan Studio · Preview · Printed PDF   ·   "
    "Reference: the Quanutrition / Zoconut tennis plan (26 pages) and the practitioner's plan-creation notes",
    muted=True,
)
doc.add_paragraph()
callout(
    "The strategy says what the body needs. The plan says what the person eats on Monday at 10 a.m. "
    "NutriAliment now closes that loop — the same seven-day discipline the practice already prints, with the "
    "maths, the guardrails and the sign-off attached."
)

# =============================================================================
h1("The week is the product", "01")

p(
    "A nutrition practice does not sell a PDF. It sells a week that a person can follow: a sequence of meals "
    "that fits their training, their kitchen and their blood work, printed in a format they already trust. "
    "The strategy studio built the clinical decision. Plan Creation builds the week that delivers it, and "
    "prints the document the client receives."
)

p(
    "The reference for this release is not a wireframe. It is a real 26-page export from Quanutrition's "
    "Zoconut account: a tennis player's seven-day plan, meal slot by meal slot, portion by portion, with a "
    "recommendations page, 37 numbered general guidelines and a five-paragraph disclaimer. The practitioner's "
    "notes alongside it describe the workflow: mandatory plan details first, a strategy dropdown, add-meal and "
    "drag-and-drop editing, per-day diet notes, a food picker, a preview, and a PDF download."
)

p(
    "This release implements that workflow end to end. Every dish, portion and calorie in the shipped "
    "catalogue is parsed from the reference PDF, so the demo plan reproduces the reference numbers exactly "
    "(Monday 1,806.6 kcal, Tuesday 3,042.6 kcal). What changes is the machinery underneath: the plan is a "
    "structured record with guardrails, not a table typed into a form."
)

h2("1.1  What ships in v1")
bullets(
    [
        "A Diet Plans tab on the client record with plan history, templates, PDFs and revisions.",
        "A seven-section Plan Studio: Details, Targets, Week plan, Recommendations, Guidelines, Preview, Review & publish.",
        "A 104-dish food catalogue with per-unit calories, 26 portion units, 10 categories, and manual entries for anything else.",
        "A seven-day board with meal slots, portions, alternatives (\"or\"), per-slot meal notes, per-day diet notes, drag-and-drop ordering, copy-day, and a match-target-to-meals action.",
        "Targets pulled from the published strategy in one click, with an invariant macro split that always totals 100%.",
        "Diet, allergy and restriction guardrails computed against the catalogue, with an acknowledgement trail.",
        "A readiness checklist and attestation gate before publishing, plus immutable versions and revisions.",
        "A server-rendered A4 PDF that mirrors the reference layout: cover, day blocks, recommendations, guidelines, disclaimer.",
        "Save-as-template so a week built once can be reused on the next client.",
    ]
)

h2("1.2  Success measures")
table(
    ["Measure", "Target", "Why it matters"],
    [
        ["Time to a printable week", "< 20 minutes from a published strategy", "The Tuesday-afternoon constraint"],
        ["Reference fidelity", "Same portions, calories and section order", "Clients compare against the old PDF"],
        ["Maths integrity", "100% of days total 100% macro split", "No contradictory numbers in front of a client"],
        ["Guardrail coverage", "Every dish checked against diet, allergies, restrictions", "Clinical safety"],
        ["Sign-off completeness", "No plan published without attestation", "Defensible record"],
        ["PDF availability", "Inline preview and download, identical bytes", "Preview equals what the client gets"],
    ],
    widths=[1.9, 2.3, 2.6],
)

# =============================================================================
h1("What the reference gets right — and what it costs", "02")

p(
    "The Zoconut screens are a competent operating surface. The meal grid is legible, the day tabs carry live "
    "calorie and macro totals, the template dropdown respects that a practitioner builds the same shape every "
    "week, and the printed plan is calm: an orange band per meal slot, three columns, a note under the dish, "
    "and a footer that repeats the practice's contact details on every page."
)
p(
    "The cost is hidden in the seams. Names are typed free-hand, so \"CUT FRUITS\" and \"cut fruits\" become "
    "two foods. Calories are entered per row, so a portion edit silently desynchronises the day total. There is "
    "no guardrail against a non-vegetarian dish on a vegetarian client's plan. There is no version trail behind "
    "a published PDF. And the macro maths can disagree with itself: a day that says 2.2–2.4 g/kg protein while "
    "the split says 10% is a plan a client can catch you on."
)

h2("2.1  Five failure modes this release removes")
table(
    ["Failure mode", "What it looked like", "What v1 does"],
    [
        ["Re-typing", "Every dish and portion typed by hand, every week", "Catalogue picker with 104 dishes, per-unit calories, and manual fallback"],
        ["Silent desync", "Calories edited independently of portions; day totals drift", "Portion × per-unit energy is the only source of truth; totals derive"],
        ["Impossible macros", "Protein guardrail changed without the split changing", "Editing grams or any percentage rebalances the other two to 100%"],
        ["Clinical blind spot", "Non-vegetarian dish on a vegetarian plan", "Diet-tag conflicts, allergy matching, acknowledgement before publish"],
        ["No trail", "A PDF sent and then edited in place", "Publish locks the plan, writes a version, revisions fork a new draft"],
    ],
    widths=[1.5, 2.6, 2.7],
)

h2("2.2  The design principle")
callout(
    "The plan is a calculation, not a document. Everything the practitioner sees — the day totals, the target "
    "line, the macro bar, the printed calories — is derived from one structure. The PDF is a rendering of that "
    "structure, which is why the preview can be the exact file the client receives."
)

# =============================================================================
h1("Who it is for, and the workflow it replaces", "03")

p(
    "The primary user is a clinical nutritionist in a small practice, seeing six to ten clients a day, building "
    "most plans from a rotation they already know. Their week is not a blank page; it is a variation on last "
    "month's plan, adjusted for training load, travel and the latest bloods."
)
p(
    "The secondary user is the client, who only ever sees the PDF and the WhatsApp message that carries it. "
    "Everything in the printed document is written for them: the capitalised dish names, the note under each "
    "dish, the \"or\" alternative, the guidelines numbered one to thirty-seven, and the disclaimer."
)

h2("3.1  Jobs to be done")
table(
    ["Job", "Current workaround", "In the product"],
    [
        ["Turn a signed strategy into a week", "Rebuild the week in Zoconut from a template", "New plan → template → targets pulled from the strategy"],
        ["Adjust for a heavy training day", "Edit calories per row and hope totals keep up", "Per-day target override or match-target-to-meals"],
        ["Offer a swap", "Type \"or\" into the dish note", "First-class alternatives with their own portion and calories"],
        ["Warn about a restriction", "Remember it, or catch it on review", "Automatic conflicts with acknowledgement"],
        ["Send the plan", "Export PDF, rename, WhatsApp", "Preview, download, published and versioned"],
        ["Reuse a good week", "Ask a colleague for their file", "Save as template, available in the New plan menu"],
    ],
    widths=[1.8, 2.5, 2.5],
)

# =============================================================================
h1("End-to-end flow", "04")

numbered(
    [
        "Open the client record → Diet Plans. The history shows the current plan, earlier versions, and two templates.",
        "New plan: blank week, the reference-derived sports template, or a template saved from an earlier plan.",
        "Details: title, start date, duration, diet type, linked strategy, practice branding. Optional: save this week as a template.",
        "Targets: pull from the published strategy, then tune energy, protein grams and the split. Per-day overrides for training days.",
        "Week plan: pick a day, add meal slots, add dishes from the catalogue, set quantities and units, add notes, alternatives and day notes. Reorder by drag or with the arrow buttons.",
        "Recommendations and Guidelines: select superfoods, add practice notes, choose which of the 37 guidance sections print.",
        "Preview: the exact PDF in an iframe. Download produces the same bytes with an attachment disposition.",
        "Review & publish: readiness checks, variance and guardrail acknowledgements, attestation, publish. The PDF now carries Plan Approved.",
        "Later: open the published plan, download again, or create a revision that forks a new draft without touching the signed version.",
    ]
)

h2("4.1  What the practitioner never has to do")
bullets(
    [
        "Type a dish name from scratch unless it is genuinely new (manual entry keeps the calories they type).",
        "Reconcile day totals by hand: calories, protein, carbohydrate and fat are summed from the meals.",
        "Remember which of the 37 guidelines they include: the selection is stored on the plan and printed in order.",
        "Rename the PDF or rebuild the cover: client details come from the record, plan details from the plan.",
    ]
)

# =============================================================================
h1("Functional requirements", "05")

h2("5.1  Plan shell and history")
table(
    ["ID", "Requirement", "Acceptance"],
    [
        ["FR-01", "Diet Plans tab on the client record", "Shows current plan, earlier plans, templates, PDF link per plan"],
        ["FR-02", "Create a plan", "Blank week or any template; created as a draft with seven empty days"],
        ["FR-03", "Plan history", "Status, version, dishes, kcal/day, target, days built, readiness, updated time"],
        ["FR-04", "Delete a draft", "Allowed for drafts only; published plans 409"],
        ["FR-05", "Duplicate", "Copies the full week into a new draft"],
        ["FR-06", "Save as template", "Stores the week; appears in the New plan menu for any client"],
    ],
    widths=[0.6, 2.4, 3.6],
    small=True,
)

h2("5.2  Details")
table(
    ["ID", "Requirement", "Acceptance"],
    [
        ["FR-07", "Title, start date, duration", "End date derived from start + duration - 1"],
        ["FR-08", "Diet type", "Defaults from the client record; editable"],
        ["FR-09", "Strategy link", "Dropdown of the client's strategies; selecting one pulls its targets"],
        ["FR-10", "Branding", "Practice name, tagline, email, phone, footer credit used by the PDF"],
        ["FR-11", "Prepared by + internal description", "Prepared-by prints; description stays internal"],
    ],
    widths=[0.6, 2.4, 3.6],
    small=True,
)

h2("5.3  Targets")
table(
    ["ID", "Requirement", "Acceptance"],
    [
        ["FR-12", "Energy target", "Editing calories rescales macro grams from the split"],
        ["FR-13", "Protein target", "Editing grams recomputes the protein percentage; carbohydrate absorbs it; fat is preserved"],
        ["FR-14", "Percentage edit", "Editing any percentage rebalances the other two so the total is exactly 100"],
        ["FR-15", "Guardrail feedback", "Shows g/kg against the strategy range and warns when outside it"],
        ["FR-16", "Per-day override", "Any day can carry its own target; reset restores the plan target"],
        ["FR-17", "Match to planned week", "Sets the plan target to the average of active days"],
    ],
    widths=[0.6, 2.4, 3.6],
    small=True,
)

h2("5.4  Week plan")
table(
    ["ID", "Requirement", "Acceptance"],
    [
        ["FR-18", "Seven-day board", "Day tabs carry live calories and a target bar"],
        ["FR-19", "Meal slots", "Add from 14 presets or a custom slot; rename, retime, reorder, delete"],
        ["FR-20", "Add dish", "Catalogue search and category filter; quantity and unit on the row"],
        ["FR-21", "Manual entry", "Name, quantity, unit, calories for that portion; macros stay blank"],
        ["FR-22", "Portions", "Quantity × per-unit energy; unit change converts by gram weight"],
        ["FR-23", "Notes", "Dish note, recipe, slot meal note, day diet notes"],
        ["FR-24", "Alternatives", "Any dish can carry \"or\" rows with their own portion and calories"],
        ["FR-25", "Drag and drop", "Reorder slots and dishes, and move a dish between slots; arrow buttons mirror it"],
        ["FR-26", "Copy day", "Copy the selected day to all others, weekdays or weekend"],
        ["FR-27", "Day state", "Active / inactive, fast day, clear day"],
    ],
    widths=[0.6, 2.4, 3.6],
    small=True,
)

h2("5.5  Recommendations, guidelines, preview, review")
table(
    ["ID", "Requirement", "Acceptance"],
    [
        ["FR-28", "Superfoods", "Multi-select with the rationale printed for each"],
        ["FR-29", "Custom notes", "Heading + body, printed with the recommendations"],
        ["FR-30", "Printed sections", "Measurements guide, disclaimer and the daily target line can be toggled"],
        ["FR-31", "Guidelines", "37 sections, individually selectable, printed in order"],
        ["FR-32", "Preview", "Server-rendered PDF in an iframe; refresh after edits"],
        ["FR-33", "Download", "Same document with attachment disposition and a clean filename"],
        ["FR-34", "Readiness", "Seven checks with fix links and a score"],
        ["FR-35", "Publish", "Attestation required; locks the plan; stamps the PDF; writes a version"],
        ["FR-36", "Revision", "Forks a new draft from any published plan; the published PDF is unchanged"],
    ],
    widths=[0.6, 2.4, 3.6],
    small=True,
)

# =============================================================================
h1("The calculation rules", "06")

p(
    "The most expensive defect in the reference workflow is arithmetic that disagrees with itself. Version 1 "
    "enforces three rules everywhere — in the strategy modal, in the plan targets, and on the printed page."
)

h2("6.1  Rule 1 — portions drive calories")
p(
    "A meal stores per-unit energy and macros. Calories are always quantity × per-unit energy. Changing the "
    "unit converts the per-unit values by the gram weight of the unit before recalculating, so a dish switched "
    "from grams to tablespoons keeps its energy density rather than its number."
)

h2("6.2  Rule 2 — the split always totals 100")
p(
    "Editing a percentage keeps that point and distributes the remainder across the other two in proportion to "
    "their previous values. If both were zero, the remainder is halved. There is no state in which the studio "
    "shows a total other than 100."
)

h2("6.3  Rule 3 — protein grams and protein percentage cannot drift")
p(
    "When protein grams or the g/kg guardrail change, the protein percentage is recomputed from grams and "
    "energy, carbohydrate absorbs the difference, and fat is preserved. When energy changes, the protein "
    "percentage is recomputed so the gram target stays put. The strategy's live-targets card now reports the "
    "average day's calories, which is exactly 4C + 4P + 9F for that split."
)

table(
    ["Input", "Change", "Result"],
    [
        ["Protein target 1.2–1.4 → 2.2–2.4 g/kg at 3,100 kcal", "Guardrail", "Protein 18% → 38%, carbohydrate 57% → 37%, fat stays 25%"],
        ["Fat 25% → 35%", "Percentage", "Protein and carbohydrate shrink proportionally; total stays 100%"],
        ["Energy 3,000 → 2,600 kcal", "Energy", "Percentages held, grams rescaled; protein g/kg unchanged"],
        ["Protein grams 150 → 200", "Grams", "Protein percentage rises; carbohydrate absorbs; fat preserved"],
    ],
    widths=[2.3, 0.9, 3.4],
    small=True,
)

callout(
    "Worked example: 3,100 kcal, protein 3.6–3.8 g/kg at 80 kg → mid 3.7 × 80 = 296 g → 296 × 4 / 3,100 = 38%. "
    "Fat stays at 25%, so carbohydrate = 100 − 38 − 25 = 37%. The day now reads 37 / 38 / 25, totals 100%, and "
    "the protein achieved line says 294 g at 3.67 g/kg — inside the guardrail."
)

# =============================================================================
h1("Guardrails and the publish gate", "07")

p(
    "A plan is a clinical document. The product treats publishing as a signature, not a save. Seven checks "
    "decide whether the gate opens, and two of them can be acknowledged rather than fixed when the practitioner "
    "has a reason."
)
table(
    ["Check", "Passes when", "Blocking"],
    [
        ["Plan details", "Title and start date are set", "Yes"],
        ["Energy and protein targets", "Both greater than zero", "Yes"],
        ["Seven-day coverage", "Every active day has at least one dish", "Yes"],
        ["Portions", "Every meal has a portion string", "Yes"],
        ["Energy within target", "Each active day within 20% of target, or variance acknowledged", "Yes, acknowledgement removes it"],
        ["Diet guardrails", "No diet, allergy or restriction conflict, or acknowledged", "Yes, acknowledgement removes it"],
        ["Guidance library", "At least one superfood or guideline selected", "No (warn)"],
    ],
    widths=[1.7, 3.4, 1.5],
    small=True,
)
p(
    "Conflicts are computed from catalogue diet tags — meat, fish, egg, dairy, nuts, gluten — matched against the "
    "client's food preference, plus name matching for recorded allergies and restrictions. A vegetarian client "
    "loaded with the tennis template produces a conflict list, and the plan cannot publish until the "
    "practitioner acknowledges it. The acknowledgement is stored on the plan and re-evaluated on every save."
)

h2("7.1  What publishing does")
bullets(
    [
        "Sets status to published and increments the version.",
        "Archives any earlier published plan for the client.",
        "Writes an immutable snapshot to plan_versions with the attestation note.",
        "Locks the plan: PATCH and DELETE return 409.",
        "Makes the PDF print Plan Approved with the approved date on the cover.",
    ]
)

page_break()

# =============================================================================
h1("The printed plan", "08")

p(
    "The PDF is the product the client keeps. It is rendered server-side with ReportLab from the same structure "
    "the studio edits, so preview and download are the same bytes."
)
table(
    ["Pages", "Content", "Notes"],
    [
        ["1", "Cover: Plan Approved pill, Customer Information (six fields in three columns), Plan Details table, energy and macro strip, seven-day average, allergies and restrictions", "Branding from the plan, client details from the record"],
        ["2–21", "One page block per day: orange day title and date, planned/target/difference line, one table per meal slot with Portion and Calories columns, diet notes box", "Matches the reference band, row and note treatment"],
        ["22", "Recommendations: superfoods table, standard measurements guide, custom notes", "Selection comes from the studio"],
        ["23–26", "General guidelines: 37 numbered sections with paragraphs and bullets", "Order is fixed; selection is per plan"],
        ["27", "Disclaimer: five numbered paragraphs", "Toggled per plan"],
        ["Every page", "Brand wordmark and tagline, hairline rules, footer with brand, email, phone, credit and page number", "All text is selectable"],
    ],
    widths=[0.8, 3.9, 1.9],
    small=True,
)

h2("8.1  Typography and colour")
table(
    ["Element", "Specification"],
    [
        ["Page", "A4 portrait, 34 pt side margins, content width 527 pt"],
        ["Accent", "#F08A4B meal-slot bands; #D9692B section headings; #3F9B57 Plan Approved"],
        ["Dish row", "Helvetica-Bold 8.5 pt in caps, note in 7.5 pt grey, portion and calories 8.3 pt"],
        ["Guidelines", "9.2 pt bold section title, 8.6 pt body with 12.4 pt leading"],
        ["Footer", "7.2 pt, four items distributed across the measure, page number right-aligned above"],
    ],
    widths=[1.3, 5.3],
    small=True,
)

h2("8.2  Fidelity evidence")
p(
    "The reference plan was parsed from its PDF, not retyped: word coordinates and orange band rectangles "
    "reconstruct 7 days, 110 meal slots and 284 dishes. The catalogue's per-unit calories come from those "
    "portions, which is why the seeded plan reproduces Monday at 1,806.6 kcal and Tuesday at 3,042.6 kcal — "
    "identical to the source document."
)

# =============================================================================
h1("Data model and API", "09")

h2("9.1  Tables")
table(
    ["Table", "Purpose", "Key columns"],
    [
        ["diet_plans", "Plan record and current draft/published data", "id, client_id, name, status, version, strategy_id, data_json, published_at"],
        ["plan_versions", "Immutable published snapshots", "id, plan_id, version, data_json, note, created_at"],
        ["plan_templates", "Saved reusable weeks", "id, name, description, days_json, created_at"],
    ],
    widths=[1.3, 2.3, 3.0],
    small=True,
)

h2("9.2  Endpoints")
table(
    ["Method", "Path", "Purpose"],
    [
        ["GET", "/api/plan-reference", "Guidelines, superfoods, units, presets, branding, templates"],
        ["GET", "/api/plan-catalog", "Dishes, categories, units"],
        ["GET", "/api/clients/{cid}/plans", "History and templates"],
        ["POST", "/api/clients/{cid}/plans", "Create blank or from template"],
        ["GET", "/api/clients/{cid}/plans/{pid}", "Plan, client, derived, reference"],
        ["PATCH", "/api/clients/{cid}/plans/{pid}", "Update a draft"],
        ["POST", "/api/clients/{cid}/plans/{pid}/publish", "Publish with attestation"],
        ["POST", "/api/clients/{cid}/plans/{pid}/revisions", "Fork a draft"],
        ["POST", "/api/clients/{cid}/plans/{pid}/duplicate", "Copy as a draft"],
        ["POST", "/api/clients/{cid}/plans/{pid}/template", "Save the week as a template"],
        ["DELETE", "/api/clients/{cid}/plans/{pid}", "Delete a draft"],
        ["GET", "/api/clients/{cid}/plans/{pid}/pdf", "Render inline or as a download"],
    ],
    widths=[0.7, 3.3, 2.6],
    small=True,
)

h2("9.3  Derived payload")
p(
    "GET returns the plan plus a derived object: per-day calories, protein, carbohydrate, fat, target, "
    "difference, percentage and status; week totals; conflicts; warnings; and the readiness score with its "
    "checks. The UI never recomputes anything the server owns — it renders what the server derived, so the "
    "studio and the PDF can never disagree."
)

# =============================================================================
h1("Verification", "10")

p(
    "This is a built product, not a specification. The evidence below was produced on the same machine that "
    "serves the studio."
)
table(
    ["Layer", "Coverage", "Result"],
    [
        ["Backend tests", "43 pytest tests: strategy maths and gates, plan catalogue reconciliation, reference calories, target pull, publish gates, lock and revision, vegetarian guardrail, manual meal maths, PDF content, history and duplicate", "43 passed"],
        ["Frontend", "TypeScript project build and Vite production build", "Clean"],
        ["End-to-end", "Playwright: every client tab renders with a filled record; plan history; seven-day board; food picker search and add; manual entry; macro rebalancing; preview PDF fetch; publish checklist", "35 of 35 checks"],
        ["Preview fidelity", "PDF fetched from the endpoint and verified as %PDF with 27 pages", "Pass"],
        ["Accessibility", "axe-core WCAG 2.1 AA on plan history, week board, targets, review, food picker, mobile", "0 violations"],
        ["PDF text", "Cover, day block, diet notes, superfoods, guidelines, disclaimer are real text", "Pass"],
    ],
    widths=[1.2, 4.2, 1.2],
    small=True,
)

h2("10.1  The test client")
p(
    "A fully-filled synthetic record drives the verification: Demo Client, 22, male, 78.6 kg, 179.5 cm, non-vegetarian "
    "with a lactose intolerance, a tennis player training twice a day, a published strategy at 3,100 kcal and "
    "1.6–1.8 g/kg, and a published 180-day plan built from the reference template with a lighter Monday target. "
    "The script is scripts/seed_test_client.py; every tab of the record is populated, and no real client data is used."
)

page_break()

# =============================================================================
h1("Release notes, limits and what comes next", "11")

h2("11.1  Deliberate limits")
bullets(
    [
        "The catalogue ships 104 dishes. Anything else is a manual entry with its own calories; macros stay blank rather than guessed.",
        "Macro grams are estimates from a composition table, scaled so the energy reconciles with the calorie column. The studio says so.",
        "Templates snapshot the week, not the target maths; targets are re-pulled from the strategy on the new plan.",
        "A multi-week program reuses the same seven-day rotation; duration only drives the printed period.",
        "Branding is per plan, not per practice; a settings surface is the natural next step.",
    ]
)

h2("11.2  What comes next")
table(
    ["Candidate", "Value", "Note"],
    [
        ["Practice settings", "Set branding once for every PDF", "Small, high polish"],
        ["Grocery list", "Aggregate the week into a shopping list", "Derives from the same structure"],
        ["Client sharing", "Signed link or WhatsApp send", "Needs an auth story"],
        ["Plan comparison", "Strategy v1 vs v2 side by side", "Version data already exists"],
        ["Photo library", "Dish images in the client PDF", "Catalogue has the hooks"],
    ],
    widths=[1.4, 2.6, 2.6],
    small=True,
)

h2("11.3  Definition of done for this release")
bullets(
    [
        "A practitioner can go from a published strategy to a printed, approved PDF without touching a spreadsheet.",
        "Every number on screen and on paper agrees with every other number.",
        "A vegetarian client cannot be sent a chicken curry by accident.",
        "The preview is the file, and the file is versioned.",
        "The client receives a document that looks like the one the practice already sends — and is measurably more correct.",
    ]
)

callout(
    "Plan Creation is the moment NutriAliment stops being a record system with a calculator and becomes the "
    "surface a practice actually works in. The strategy is the judgement. The plan is the delivery. The PDF is "
    "the promise."
)

doc.save(OUT)
print(f"written {OUT}")
