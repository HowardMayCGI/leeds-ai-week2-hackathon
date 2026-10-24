# WS4-04 — Integrate the four streams and rehearse the demo

- **Owner:** WS4 — integration coordinator; each owner fixes their implementation
- **Status:** Todo
- **Depends on:** WS1 demo pack/fixtures, WS2 API, WS3 journey and WS4-03 evaluation
- **Unblocks:** Team hackathon demonstration

## Outcome

Deliver one reliable end-to-end demonstration that works without a clinician, NHS credentials, paid interaction data or live AI availability.

## Initial tasks

1. Replace UI mocks with the existing local API path, confirm contract/rule-pack versions and run the scenario suite. Keep fixtures available for recovery, openly labelled as fixture mode. WS2 owns API wiring; WS3 owns UI fixes.
2. Add focused browser journeys for medicine import plus supplement addition, prescribed-versus-reported discrepancy, successful timetable, unresolved unknown item and conflicting rules. Verify stale plans disappear after edits and a network error supports retry.
3. Run the relevant repository Nx checks, existing random-number regression checks and browser/accessibility checks. Use the commands documented in the project README; record actual results rather than promising unrun checks. A real deployment is not required for completion of this task.
4. Rehearse a short narrative: simulated NHS prescription import → patient confirms/adds items → actual-use/routine questions → explainable draft. Then show unknown supplement and discrepancy/conflict outcomes so the boundary is understandable.
5. Prepare the limitations/next-steps slide or short note: educational prototype, limited versioned evidence, no clinician validation, future NHS integration/clinical partnership, and later saving/reminders. Identify what changed when AI was used and whether it improved understanding or reduced data-entry effort.

## Deliverable and done condition

The team can run the local demo from documented setup with no model key, all required journeys work, and relevant checks pass or named remaining failures are documented. Every teammate knows their demonstration segment. Schedule saving and reminders remain explicitly deferred; no clinical approval or real NHS integration is implied.
