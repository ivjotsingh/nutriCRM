# Build NutriAlign Lead Conversion Product

## Summary

Built NutriAlign as an end-to-end local nutrition lead-conversion product:

- Click-first intake flow with goal/lifestyle questions before medical suitability.
- Deterministic health triage that prevents risk users from receiving AI diet plans.
- Validated 7-day plan generation for low-risk users using structured seed data and an approved food catalog.
- Risk-user nutrition brief with human dietician CTA.
- Plan viewer with meal timings, portions, calories, preparation notes, daily totals, print/download action, WhatsApp share link, check-ins, and upgrade CTAs.
- Admin dashboard for leads, intake summaries, risk flags, generated plans/briefs, check-ins, and upgrade intent.
- Local SQLite persistence.
- Browser verification script using Playwright and system Chrome.

## Product Notes

- The app is intentionally not positioned as an autonomous dietician.
- It routes users with diabetes, kidney disease, pregnancy/breastfeeding, eating disorder history, serious cardiac disease, liver disease, recent surgery, severe symptoms, active medication, abnormal reports, or under-18 status to the human dietician path.
- Payment integration is not faked. Upgrade CTAs capture intent for follow-up.
- Admin is local and not production-authenticated.

## Verification

Commands run:

```bash
cd backend
uv run pytest

cd ../frontend
npm run typecheck
npm run build

cd ..
node scripts/browser-verify.mjs
```

Results:

- Backend tests: 3 passed.
- Frontend typecheck: passed.
- Frontend production build: passed.
- Playwright browser verification: passed.

Browser-tested flows:

- Normal eligible user completes intake.
- Normal user receives 7-day plan.
- Normal user submits daily check-in.
- Normal user submits AI continuation upgrade intent.
- Risk user selects diabetes and receives no AI plan.
- Risk user receives dietician brief and submits human dietician upgrade intent.
- Admin can view both leads and inspect details.
- Desktop layout screenshot captured.
- Mobile landing/intake screenshot captured.
- Console/runtime errors checked.

## Known Follow-Ups

- Add production authentication before exposing admin outside local development.
- Replace intent capture with Razorpay/payment links when commercial flow is ready.
- Expand the seed catalog beyond the three example files before production launch.
- Move SQLite persistence to Firestore later as planned.
- Consider installing `httpx2` or adjusting test dependency pins if Starlette removes the current compatibility path.
