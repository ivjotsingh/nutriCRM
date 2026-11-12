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
