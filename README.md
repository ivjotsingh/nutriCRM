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

## Tests And Checks

```bash
cd backend
uv run pytest

cd ../frontend
npm run typecheck
npm run build
```


## Client Records

Open `http://127.0.0.1:5173/#clients` to add clients, fill the seven core tabs, add new list values inline, and create custom tabs.
Every field is optional. Client data, custom list values, and custom tabs are stored in SQLite.

## Strategy Creation

Open a client record and choose **Strategy** (or the Strategy tab) to turn the clinical record into a signed nutrition strategy.

The studio includes seven sections: Brief, Clinical context, Targets, Macro week, Food strategy, Supplements & medications, and Review & publish. It prefills conditions, labs, body composition, diet, medications, and supplements; calculates BMI, BMR/TDEE, ideal weight, calorie targets, and a seven-day macro plan; checks allergens and medication interactions; and gates publishing behind a clinical sign-off. Published versions are immutable and can be revised without losing the signed copy.

Routes:

- `#clients` — client directory
- `#clients/{clientId}?tab=strategy` — strategy history
- `#clients/{clientId}/strategy/{strategyId}` — Strategy Studio

Strategy data lives in the `strategies` and `strategy_versions` SQLite tables. The full product specification is in [`docs/NutriAlign_Strategy_Creation_PRD_v1.0.docx`](docs/NutriAlign_Strategy_Creation_PRD_v1.0.docx).

## Tests And Checks

```bash
cd backend
uv run pytest

cd ../frontend
npm run typecheck
npm run build
```

Strategy verification covers 32 backend tests (calculation formulas, prefill, publish gates, revisions, consent, refresh, low-calorie acknowledgement, interaction rules), frontend typecheck and production build, Playwright flows for create/edit/publish/revision/preview, and an axe WCAG 2.1 AA audit with zero violations on desktop and mobile.
