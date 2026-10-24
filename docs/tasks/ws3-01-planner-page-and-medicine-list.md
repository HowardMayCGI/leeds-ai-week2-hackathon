# WS3-01 — Add the planner page and confirm the medicine list

- **Owner:** WS3 — patient experience
- **Status:** Todo
- **Depends on:** WS2-01 response mocks; WS1-04 fixtures for final integration
- **Unblocks:** WS3-02/03

## Outcome

Start a clearly labelled NHS App feature demonstration from the existing LAI App and show the patient exactly which items will be considered.

## Initial tasks

1. Read `apps/web/AGENTS.md` and the installed Next.js guidance it requires before implementation. Add `/medication-planner` and an obvious navigation link from the existing page, respecting static export and existing responsive LAI styling.
2. Load a fictional record through a mockable API client. Display medicine/product name, formulation, strength, prescribed dose/frequency, original instructions and simulated-record source. Keep the educational-demo status visible.
3. Add a list-confirmation step with manual additions for omitted prescribed medicines, over-the-counter products, vitamins, minerals and herbal supplements. Collect ingredient/product details where known, dose/cadence and original directions where available. Preserve unresolved names rather than guessing identities.
4. Let patients flag an imported item as no longer taken or incorrectly listed without editing the underlying fictional prescription. Keep the discrepancy visible for WS3-02; imported record facts and patient reports remain separate.
5. Provide keyboard-accessible add/edit/remove controls for patient additions, accessible errors, loading/retry states and a visible statement about session-only state. Use stable IDs so editing/reordering does not attach instructions to the wrong item.

## Deliverable and done condition

Users can view the full imported list, add both a medicine and a supplement, and review changes on mobile and desktop. Unsupported additions remain visible and flow to the backend as unresolved. The original random-number page still works and no real record access is implied.
