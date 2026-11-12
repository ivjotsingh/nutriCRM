# Strategy Creation: from client record to signed plan

## Summary

Adds a practitioner-facing Strategy Studio inside every client record. The studio turns the existing clinical record into a prefilled, calculated, safety-checked nutrition strategy, then publishes it as an immutable, signed version with a revision path.

## What changed

- Added a **Strategy** tab and a `Plan strategy` shortcut to the client record.
- Added a seven-section studio: Brief, Clinical context, Targets, Macro week, Food strategy, Supplements & medications, Review & publish.
- Added deterministic prefill from the client bundle: diet, goal, patient type, conditions, symptoms, deranged labs, height/weight/body fat, medications, supplements, and dates.
- Added the calculation engine: BMI (Asian-Indian cut-offs), Katch-McArdle / Mifflin BMR, TDEE, Devine / BMI 22 ideal weight, thumb-rule / BMR / RDA calories, protein guardrails, seven-day macro allocation with floored grams and half-up calorie rounding.
- Added the RDA reference dialog, formula explanation, macro day editor with copy-to all/weekdays/weekend, superfood library, supplement library, medication interaction rules, food guardrails, and a client-ready preview with print/PDF.
- Added publish governance: readiness checks, conditional acknowledgements (low calorie, target BMI, paediatric, pregnancy, protein deviation, allergies, interactions), optional clinical sign-off, attestation, immutable version snapshot, archive of the previous published plan, and revision creation. `NUTRIALIGN_REQUIRE_SIGNOFF=1` makes sign-off + attestation mandatory.
- Added a Strategy tab history with All / Draft / Published / Archived filter, current plan card, earlier versions, and delete-draft support.
- Added 33 backend tests and extensive responsive/accessibility verification.

## Key product decisions

- The studio is practitioner-facing; it is decision support, not an autonomous dietitian.
- Clinical sign-off is optional in the prototype by product decision; strict mode is available for production.
- Published plans are immutable; the only edit path is a revision, which resets clinical acknowledgements.
- Protein is prescribed per kg of **target** body weight (the reference note’s “ideal weight” is interpreted as the plan’s target). The UI states the basis.
- The RDA table uses ICMR-NIN 2020, the latest RDA edition. The 2024 Dietary Guidelines for Indians are food-based guidance and do not replace the RDA table. Adult energy is 2,110 / 1,660 kcal sedentary, with older-adult, pregnancy, lactation, and 1–18 rows updated to the 2020 values.
- Low-calorie plans require explicit clinical acknowledgement rather than being silently blocked or silently allowed.

## Verification

```bash
cd backend
uv run pytest

cd ../frontend
npm run typecheck
npm run build
```

Results:

- Backend: **33 passed** (formula, prefill, publish gates, revisions, consent, refresh, low-calorie acknowledgement, interactions).
- Frontend typecheck: passed.
- Frontend production build: passed.
- Playwright: create from history, navigate all sections, edit macro day, copy-to weekdays, open RDA/formula/preview, block publish, complete conditional acknowledgements, publish v1, create revision.
- Axe WCAG 2.1 AA: **0 violations** on desktop and mobile studio.
- Print/PDF: A4 output verified, app chrome excluded.

## Known follow-ups

- Replace local single-user identity with authenticated roles and RBAC.
- Assign a clinical owner to review each ICMR-NIN release and version the RDA table.
- Add production encryption, retention/deletion policy, audit export, and data-processing terms.
- Add meal-level recipes, delivery channel (WhatsApp/email), and outcome tracking in later phases.
- Add a team review workflow and practice-level templates.
