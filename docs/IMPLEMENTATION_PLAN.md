# NutriAliment Implementation Plan

## Product Goals

NutriAliment is a nutrition lead-conversion product for a real dietician/practice. It should create a premium free 7-day nutrition preview for low-risk users, route medically risky users to human review, capture lead intent, and give the dietician/admin enough context to follow up.

The product is not an autonomous medical dietician. It is an AI-assisted, rule-constrained funnel that uses approved historical nutrition-plan patterns.

## Target Users

- Low-risk users seeking weight loss, fat loss, energy, body toning, basic fitness, or routine improvement.
- Risk-flagged users who need a dietician because of disease, pregnancy, medication complexity, serious symptoms, or abnormal reports.
- Dietician/admin staff reviewing leads, generated plans, check-ins, risk flags, and upgrade intent.

## User Journeys

### Low-Risk User

1. Lands on a product-first screen.
2. Gives basic identity and consent.
3. Completes mostly click-based goal and lifestyle intake.
4. Completes health suitability check.
5. Passes deterministic triage.
6. Receives a polished 7-day plan.
7. Downloads or shares the plan.
8. Submits daily check-ins.
9. Expresses upgrade intent for AI continuation or human dietician plan.

### Risk User

1. Completes the same intent-first intake.
2. Selects one or more risk flags.
3. Does not receive an AI diet plan.
4. Receives a professional nutrition brief.
5. Sees a clear explanation and dietician CTA.
6. Admin can inspect the lead and risk reasons.

### Admin/Dietician

1. Opens admin dashboard.
2. Reviews leads and funnel status.
3. Inspects intake, risk flags, plan/brief, check-ins, and upgrade intent.
4. Uses the lead summary for sales or dietician follow-up.

## Feature Scope

- React intake flow with click-based controls.
- FastAPI backend with SQLite local DB.
- Structured seed data extracted/modelled from the three provided PDFs.
- Deterministic triage.
- Deterministic plan generation from approved foods and meal slots.
- Plan validation before rendering.
- Plan viewer with download and WhatsApp share actions.
- Daily check-ins.
- Upgrade intent capture.
- Admin dashboard.
- Basic analytics/funnel events.

## Non-Goals

- No vector DB/RAG in v1.
- No raw PDF-to-freeform-answer flow.
- No real payment success simulation.
- No production auth claims.
- No automatic lab report interpretation.
- No mobile native app.
- No unrestricted chat-based medical advice.

## UX Direction

- Product-first, not SaaS brochure-first.
- Healthcare-appropriate: calm, premium, trustworthy, precise.
- Dense but clear operational surfaces for admin.
- Mostly click-based intake: chips, cards, toggles, sliders, steppers, time pickers, segmented controls, and searchable pickers.
- Ask goals/lifestyle before medical gate so the user feels understood.
- Make risk routing feel like quality control, not rejection.

## Frontend Screens And Components

- `LandingIntro`: first-viewport product experience and CTA.
- `IntakeFlow`: multi-step intake shell.
- `ChoiceChips`, `MetricStepper`, `TimePicker`, `SegmentedCards`, `MultiSelectGrid`.
- `RiskGate`: final medical suitability screen.
- `GeneratingState`: plan/brief generation loading.
- `PlanViewer`: 7-day plan renderer.
- `RiskBrief`: non-plan nutrition brief for routed users.
- `CheckInForm`: daily adherence capture.
- `UpgradePanel`: Rs 9,000 AI continuation and Rs 18,000 dietician CTAs.
- `AdminDashboard`: leads list, metrics, detail drawer/panel.

## Backend/API Changes

- `POST /api/intakes`: create lead, evaluate triage, generate plan or brief.
- `GET /api/leads/{lead_id}`: fetch lead detail.
- `GET /api/leads`: admin lead list.
- `POST /api/leads/{lead_id}/check-ins`: store daily check-in.
- `POST /api/leads/{lead_id}/upgrade-intent`: capture upgrade intent.
- `GET /api/catalog`: expose safe intake choices and approved food metadata.
- `GET /health`: local health check.

## Data Model And Storage

SQLite local DB:

- `leads`: identity, consent, status, triage outcome, timestamps.
- `intakes`: structured intake JSON.
- `plans`: generated 7-day plan JSON or risk brief JSON.
- `check_ins`: adherence, hunger, energy, digestion, cravings, notes.
- `upgrade_intents`: selected plan, contact preference, message.
- `events`: funnel analytics events.

Seed JSON files:

- `case_examples.json`: anonymized structured case examples.
- `food_catalog.json`: approved food items from examples.
- `meal_slot_templates.json`: meal slots and timing patterns.
- `triage_rules.json`: deterministic routing rules.
- `plan_format_examples.json`: renderer shape references.

## Seed Data Strategy

Use the three provided PDFs as source examples:

- Women nutrition plan.
- Sports nutrition plan.
- Adult/nutrigenomic-style plan.

For v1, store anonymized extracted summaries and a curated approved food catalog under `backend/app/seed_data`. Include enough exact meal names, portions, calories, notes, meal slots, and plan patterns to generate a credible 7-day plan locally without a vector database.

## Triage Rules

Deterministic risk flags route users to a dietician:

- Diabetes.
- Kidney disease.
- Pregnancy or breastfeeding.
- Eating disorder history.
- Serious cardiac disease.
- Liver disease.
- Active complex medication.
- Recent surgery.
- Abnormal blood reports needing review.
- Severe symptoms.
- Under 18.

Triage output includes `eligible_for_ai_plan`, `risk_flags`, `reason`, and recommended CTA.

## Plan Generation Approach

- Use the intake profile to select meal-slot timing and calorie band.
- Filter catalog by diet type, allergies, dislikes, and cuisine preference.
- Compose a 7-day plan from approved foods only.
- Prefer familiar weekly structure from the PDFs.
- Use no supplements by default unless explicitly enabled in seed/config.
- Generate structured JSON only.

## Plan Validation Approach

Reject or repair plans if:

- A food ID is not in the approved catalog.
- Allergies/dislikes are present.
- Diet type is violated.
- Daily calories are unsafe or outside target band.
- Required meal slots are missing.
- Medical treatment claims are present.
- Supplement items appear without support.

## PDF/Download/Share Approach

V1 will provide:

- Browser print/download action for PDF-like output.
- WhatsApp deep link with a safe summary and lead-specific local URL.

No fake WhatsApp API integration.

## Check-In Flow

Daily check-in captures:

- Day number.
- Adherence.
- Hunger.
- Energy.
- Digestion.
- Cravings.
- Optional notes.

Check-ins update admin visibility and support upgrade positioning.

## Upgrade Funnel

Offer two intents:

- AI continuation: Rs 9,000 / 3 months.
- Human dietician: Rs 18,000 / 3 months.

Capture selected plan and follow-up preference. Do not fake payment success. Show next-step messaging.

## Admin Dashboard

Show:

- Lead count and status counts.
- Recent leads.
- Intake summary.
- Risk flags.
- Generated plan or risk brief.
- Check-ins.
- Upgrade intent.
- Booking/payment status placeholder.

Clearly label dashboard as local/admin and not production-secure.

## Analytics/Funnel Events

Track:

- Intake submitted.
- Triage evaluated.
- Plan generated.
- Risk routed.
- Plan viewed.
- Download clicked.
- WhatsApp clicked.
- Check-in submitted.
- Upgrade intent captured.
- Admin lead viewed.

## Security And Privacy Concerns

- Local POC stores health-adjacent data in SQLite.
- No production auth in v1; admin route must disclose this.
- Avoid storing raw PDFs in the app.
- Anonymize seed examples.
- Do not expose hidden patient identifiers.
- Keep consent explicit.
- Do not claim diagnosis/treatment.

## Testing Strategy

- Backend unit tests for triage, plan generation, validation, and API flow.
- Frontend build/typecheck.
- Browser smoke tests through the local app.
- Manual QA for normal and risk flows.

## Browser Verification Strategy

Verify:

- Normal user path.
- Risk user path.
- Intake validation.
- Plan generation.
- Plan viewer.
- Check-in submission.
- Upgrade intent.
- Admin lead review.
- Desktop layout.
- Mobile layout.
- Console/runtime errors.

## Revamp Iteration Checklist

### Functional Pass

- Complete broken API paths.
- Fix validation gaps.
- Fix storage issues.
- Remove dead buttons.

### UX/Polish Pass

- Improve layout and responsive behavior.
- Improve copy and hierarchy.
- Add loading, empty, and error states.
- Tighten premium healthcare feel.

### Funnel/Admin Pass

- Improve conversion CTAs.
- Improve admin usefulness.
- Improve upgrade intent capture.
- Tighten PR readiness.

## PR Readiness Checklist

- App works locally end to end.
- Normal user can get plan, check in, and submit upgrade intent.
- Risk user gets routed without AI plan.
- Admin can inspect both users.
- Lint/tests/build/typecheck run or reported.
- Browser verification performed.
- Branch created.
- Git status checked before staging.
- Commit has no AI attribution.
- Branch pushed.
- PR opened.
