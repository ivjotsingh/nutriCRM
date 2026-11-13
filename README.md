# NutriAlign

NutriAlign is a local end-to-end nutrition lead-conversion product. It captures a click-first intake, routes risk users to a human dietician, generates a validated 7-day plan for low-risk users, captures check-ins and upgrade intent, and exposes an admin dashboard.

## Stack

- Backend: FastAPI, SQLite
- Frontend: React, Vite, TypeScript
- Seed data: structured local JSON derived from three anonymized nutrition plan examples

## Local Development

Backend:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Client Records

Open `http://127.0.0.1:5173/#clients` to add clients, fill the seven core tabs, add new list values inline, and create custom tabs.
Every field is optional. Client data, custom list values, and custom tabs are stored in SQLite.

## Strategy Creation

Open a client record and choose **Strategy** (or the Strategy tab) to turn the clinical record into a signed nutrition strategy.

The studio includes seven sections: Brief, Clinical context, Targets, Macro week, Food strategy, Supplements & medications, and Review & publish. It prefills conditions, labs, body composition, diet, medications, and supplements; calculates BMI, BMR/TDEE, ideal weight, calorie targets, and a seven-day macro plan; checks allergens and medication interactions; and requires readiness checks plus safety acknowledgements before publishing. Clinical sign-off is optional in the prototype and can be enforced with `NUTRIALIGN_REQUIRE_SIGNOFF=1`. Published versions are immutable and can be revised without losing the published copy.

Routes:

- `#clients` — client directory
- `#clients/{clientId}?tab=strategy` — strategy history
- `#clients/{clientId}/strategy/{strategyId}` — Strategy Studio

Strategy data lives in the `strategies` and `strategy_versions` SQLite tables. The strategy PRD contains screenshots of a client record, so it is kept locally in `docs/private/` (git-ignored) rather than in the repository.

## Diet Plans, Preview And PDF

Open a client record and choose **Diet Plans** (or the **Diet plan** shortcut in the header) to build the week the client actually eats.

The studio has seven sections: Details (dates, linked strategy, PDF branding, save as template), Targets (energy, protein, macro split, per-day overrides), Week plan (seven-day board with meal slots, portions, notes, alternatives, drag-and-drop, copy day), Recommendations (superfoods and custom notes), Guidelines (37 selectable sections), Preview (the exact PDF), and Review & publish (readiness checks, guardrail acknowledgements, sign-off).

- The **food catalogue** ships 104 dishes across 10 categories with per-unit calories; anything else can be added as a manual entry.
- **Targets** are pulled from the client's published strategy in one click and stay consistent: editing protein grams or any macro percentage rebalances the other two so the split always totals 100%.
- **Guardrails** flag dishes that conflict with the client's diet, allergies or restrictions, and a plan cannot be published until the energy variance and any guardrail conflict are acknowledged.
- **Publishing** locks the plan, stamps the PDF *Plan Approved*, and writes an immutable version; a revision starts a new draft without touching the signed copy.
- **The PDF** mirrors the printed plan the practice already sends: branded cover with customer and plan details, one page block per day with orange meal-slot bands (`Portion` / `Calories`), diet notes per day, a recommendations page with superfoods and the measurements guide, the general guidelines, and the disclaimer.

Routes:

- `#clients/{clientId}?tab=plans` — plan history for the client
- `#clients/{clientId}/plan/{planId}` — Plan Studio

Plan data lives in the `diet_plans` and `plan_versions` tables; saved templates live in `plan_templates`. The module specification is in [`docs/PLAN_CREATION.md`](docs/PLAN_CREATION.md).

Regenerating the reference catalogue and template (requires the reference PDF):

```bash
cd backend
uv run python ../scripts/parse_reference_pdf.py "<reference.pdf>" app/data/reference_plan.json
uv run python ../scripts/generate_plan_catalog.py
```

## Tests And Checks

```bash
cd backend
uv run pytest

cd ../frontend
npm run typecheck
npm run build
```

Verification covers 43 backend tests: strategy maths and publish gates, plus the plan module (catalogue reconciliation, reference calorie accuracy, strategy target pull, publish gates, lock and revision, vegetarian guardrail, manual meal maths, PDF content, history and duplicate). Frontend `typecheck` and production build are clean, Playwright drives the full client → plan → preview → PDF flow (35 checks), and an axe WCAG 2.1 AA audit reports zero violations across the plan history, week board, targets, review, food picker and mobile layouts.

Seeding a fully-filled demo client, strategy and published plan:

```bash
cd backend
uv run python ../scripts/seed_test_client.py
```
