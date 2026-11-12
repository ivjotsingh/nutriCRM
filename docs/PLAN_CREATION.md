# Plan Creation, Preview and PDF

The diet-plan module turns a client's published strategy into the seven-day plan they
actually eat, then prints the branded PDF the client receives.

Routes and endpoints are local-first: FastAPI + SQLite on `127.0.0.1:8000`, React on
`127.0.0.1:5173`.

---

## 1. Where it lives

| Surface | Route |
| --- | --- |
| Client record → **Diet Plans** tab | `#clients/{clientId}?tab=plans` |
| Plan studio | `#clients/{clientId}/plan/{planId}` |
| Plan history (client record) | same tab, `PlanHistory` component |

The tab sits next to **Strategy** and is also reachable from the client header with the
**Diet plan** shortcut.

---

## 2. What the practitioner does

1. **New plan** — from the diet-plan history, choose a blank week or a template.
   Two templates ship today: one generated from the reference PDF (*Sports nutrition ·
   tennis (7 day)*) and any template saved from an earlier plan.
2. **Details** — title, start date, program duration (end date is derived), diet type,
   practitioner, linked strategy, practice branding for the PDF, and *Save as template*.
3. **Targets** — daily energy, protein grams, macro split, per-day overrides.
4. **Week plan** — the seven-day board: meal slots, dishes, portions, notes, alternatives,
   day notes, drag-and-drop ordering, copy a day to others, match the target to the meals.
5. **Recommendations** — superfoods (with rationale), extra notes, measurements guide,
   disclaimer and the "daily target line" toggle.
6. **Guidelines** — 37 reusable guidance sections, individually selectable.
7. **Preview** — the exact PDF, rendered by the server, in an iframe.
8. **Review & publish** — readiness checks, guardrail acknowledgements, sign-off, publish.

Publishing locks the plan, stamps the PDF **Plan Approved**, and writes an immutable
version. A revision creates a new draft that keeps the approved PDF intact.

---

## 3. Data model

Stored in `diet_plans.data_json` (normalised on every write) and versioned in
`plan_versions`.

```jsonc
{
  "meta": {
    "title": "Nov 2026 · Tennis performance block",
    "start_date": "2026-11-16",
    "end_date": "2027-05-14",          // derived from start + duration
    "duration_days": 180,
    "description": "",
    "diet_type": "Non-vegetarian",
    "strategy_id": "…", "strategy_name": "…", "template_id": "…",
    "prepared_by": "Local practitioner",
    "status": "published",              // injected at render time
    "published_at": "2026-11-13T…"
  },
  "brand": { "name", "tagline", "email", "phone", "powered_by", "footer_note" },
  "targets": {
    "calories": 3000, "protein_g": 150, "carbs_g": 375, "fat_g": 100,
    "ratio": { "cho": 50, "pro": 20, "fat": 30 },
    "protein_range": "1.6-1.8", "source": "strategy", "note": "…"
  },
  "days": [{
    "day": "Monday", "date": "2026-11-16", "active": true, "fast_day": false,
    "notes": "Lighter day after the weekend tournament.",
    "targets": { … },                   // optional per-day override
    "slots": [{
      "id": "slot_…", "name": "Breakfast", "time": "10:00 AM",
      "note": "post workout",
      "meals": [{
        "id": "meal_…", "food_id": "boiled-eggs", "name": "BOILED EGGS",
        "qty": 2, "unit": "Egg", "portion": "2 Egg",
        "grams_per_unit": 50, "kcal_per_unit": 80,
        "protein_per_unit": …, "carbs_per_unit": …, "fat_per_unit": …,
        "calories": 160, "protein": …, "carbs": …, "fat": …,
        "note": "add salt and pepper", "recipe": "",
        "alternatives": [{ "name": "PUMPKIN SOUP", "portion": "200 Ml", "calories": 77.62 }]
      }]
    }]
  }],
  "extras": {
    "superfoods": ["lemon", "banana"],
    "measurements": true,
    "guidelines": ["hydration", "salt"],
    "disclaimer": true,
    "show_targets": true,
    "custom_notes": [{ "heading": "On-court hydration", "body": "…" }]
  },
  "governance": {
    "reviewed_targets": true,
    "acknowledged_restrictions": true,
    "acknowledged_variance": true
  },
  "clinical": { "conditions": [], "allergies": [], "restrictions": [], "weight_kg": 80.1 }
}
```

**Portion maths.** A meal stores the per-unit energy and macros, so:
`calories = qty × kcal_per_unit`. Changing the unit converts the per-unit values by the
gram weight of the unit (`units` table in the catalogue) before recalculating; changing
the quantity only rescales. Editing calories directly rewrites `kcal_per_unit`.

---

## 4. Catalogue, templates and reference content

Generated from the reference PDF, not hand-typed:

| Artefact | Source | Size |
| --- | --- | --- |
| `backend/app/data/reference_plan.json` | `scripts/parse_reference_pdf.py` (word positions + orange band detection) | 7 days, 110 slots, 284 dishes |
| `backend/app/data/food_catalog.json` | `scripts/generate_plan_catalog.py` | 104 dishes, 10 categories, 26 units |
| `backend/app/data/plan_templates.json` | same script | 1 template, 110 slots |

Calories per unit come from the reference plan itself, so the seeded plan reproduces the
reference calorie values exactly (`Monday 1,806.6 kcal`, `Tuesday 3,042.6 kcal`). Macro
grams are estimated from a keyword composition table and scaled so
`4P + 4C + 9F = calories` for every dish — studio totals never contradict the calorie
column.

`backend/app/plan_reference.py` holds the editorial content transcribed from the
reference: 37 guideline sections, 12 superfoods, the measurement guide, the disclaimer,
14 slot presets and the default branding.

---

## 5. Targets and macro maths (the calorie-calculator fix)

The old behaviour let the protein guardrail change without touching the ratio, so a day
could read `2.2–2.4 g/kg` next to a 10 % protein split and a total of 82 %. Both the
strategy modal and the plan targets now enforce one invariant: **the three percentages
always total 100 %**.

- Editing any percentage keeps the point and rebalances the other two in proportion
  (`rebalanceRatio` in `frontend/src/plans/utils.ts`, `rebalanceMacroRatio` in
  `frontend/src/strategy/utils.ts`).
- Changing protein grams (plan) or the g/kg guardrail (strategy) recomputes the protein
  percentage from grams and absorbs the difference in carbohydrate; fat is preserved.
- Changing calories keeps the protein *grams* on target and rescales percentages.
- The strategy "Live targets" card now shows the average day's calories, so the number
  above the macro bar always equals `4C + 4P + 9F`.
- Plan targets show g/kg against the strategy guardrail and warn when the value sits
  outside it.

---

## 6. Guardrails and publish gates

`derive()` computes day totals, target comparison, restriction conflicts, warnings and
the readiness score. Publishing requires:

| Check | Rule |
| --- | --- |
| Plan details | title + start date |
| Targets | energy > 0 and protein > 0 |
| Seven-day coverage | every active day has at least one dish |
| Portions | every meal has a portion string |
| Energy | each active day within 20 % of its target, or variance acknowledged |
| Guardrails | no dish conflicts with diet/allergies/restrictions, or acknowledged |
| Guidance library | at least one superfood or guideline selected |
| Attestation | practitioner sign-off at publish |

Conflicts are computed from the catalogue's diet tags (`meat`, `fish`, `egg`, `dairy`,
`nuts`, `gluten`) against the client's diet, plus name matching for recorded allergies and
restrictions.

---

## 7. PDF specification

Generated server-side with ReportLab (`backend/app/plan_pdf.py`), A4, ~27 pages for the
reference week. It mirrors the reference export:

| Page | Content |
| --- | --- |
| 1 | Branded header, **Plan Approved** pill (green) or **Draft preview**, *Customer Information* in three columns, *Plan Details* table, energy/macro strip, seven-day average line, allergy/restriction line |
| 2–21 | One page break per day. Orange day title + date, `Planned / Target / Difference / Protein` line, then one table per meal slot: orange band with slot name and time, `Portion` and `Calories` headers, dish in caps, grey `Note:`, alternatives as `or …` with their own portion/calories, **Diet notes** box at the end of the day |
| 22 | *Recommendations* — superfoods table, standard measurements guide, custom notes |
| 23–26 | *General guidelines* — numbered sections, bullets |
| 27 | *Disclaimer* — five numbered paragraphs |

Chrome on every page: brand wordmark + tagline, hairline rule, footer with brand, email,
phone, "Powered by …", and a page number. All text is real text (selectable, searchable).
Colours: `#F08A4B` accent, `#D9692B` headings, `#3F9B57` approved pill.

Query parameters: `?download=true` flips `Content-Disposition` to attachment, `?version=N`
renders a published snapshot.

---

## 8. API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/plan-reference` | Guidelines, superfoods, units, presets, branding, templates |
| GET | `/api/plan-catalog` | Dishes, categories, units |
| GET | `/api/clients/{cid}/plans` | History + available templates |
| POST | `/api/clients/{cid}/plans` | Create (blank or from template, optional strategy) |
| GET | `/api/clients/{cid}/plans/{pid}` | Plan + client + derived + reference |
| PATCH | `/api/clients/{cid}/plans/{pid}` | Update (drafts only) |
| POST | `/api/clients/{cid}/plans/{pid}/publish` | Publish with attestation |
| POST | `/api/clients/{cid}/plans/{pid}/revisions` | New draft from a published plan |
| POST | `/api/clients/{cid}/plans/{pid}/duplicate` | Copy as a new draft |
| POST | `/api/clients/{cid}/plans/{pid}/template` | Save the week as a reusable template |
| GET | `/api/clients/{cid}/plans/{pid}/versions` | Published versions |
| DELETE | `/api/clients/{cid}/plans/{pid}` | Delete a draft |
| GET | `/api/clients/{cid}/plans/{pid}/pdf` | Render the PDF (inline or download) |

---

## 9. Verification

- **Backend** — 43 pytest tests, including 10 plan tests: catalogue reconciliation,
  reference calorie accuracy, strategy target pull, publish gates, lock + revision,
  vegetarian guardrail, manual meal maths, PDF text content, history/duplicate, reference
  payload completeness.
- **Browser** — `tmp/e2e_plan.mjs` (35 checks): every client tab renders with a filled
  record, plan history, seven-day board, food picker search + add, manual entry, macro
  rebalancing, preview iframe and PDF fetch, publish checklist, zero console errors.
- **Accessibility** — axe-core WCAG 2.1 AA on plan history, week board, targets, review,
  food picker and mobile layouts: 0 violations.
- **Build** — `tsc -b` and `vite build` clean.

---

## 10. Deliberate limits

- Energy comes from the plan/catalogue; macro grams are estimates from standard
  composition tables, scaled to the calorie value (documented in the studio copy).
- The catalogue ships 104 dishes. Anything else is a manual entry with its own calories;
  macros stay blank.
- Templates snapshot the week, not the target maths.
- Multi-week programs reuse the same seven-day rotation; `duration_days` only drives the
  printed period and the client's program dates.
