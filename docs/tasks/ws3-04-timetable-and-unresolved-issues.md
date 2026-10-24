# WS3-04 — Display the timetable, reasons and unresolved cases

- **Owner:** WS3 — patient experience
- **Status:** Todo
- **Depends on:** WS2-01 response fixtures and WS3-03; optional WS4-02 explanations
- **Unblocks:** WS4-04 final demo

## Outcome

Make the result understandable while preserving the distinction between a demo draft and an unresolved request.

## Initial tasks

1. Render a chronological daily timetable from server-validated structured fields. Show exact medicine/formulation, prescribed dose and time, with meals as context. Ensure every input item is accounted for; never silently drop an unsupported supplement or regimen.
2. Show a plain-language reason for each timing decision, linked to rule IDs/source details and the demo knowledge-pack version. Use WS4's grounded explanation if available and deterministic wording otherwise. Keep times/doses sourced directly from the validated plan.
3. For clarification, unsupported and conflict outcomes, show affected items and specific reasons. Explain the difference between missing knowledge, conflicting constraints and a reported regimen discrepancy. Route users back to the relevant input without suggesting treatment changes.
4. Show visible draft/educational status and validation scope. Provide no “safe”, “clinically approved” or “no interactions” verdict from absence of data. Avoid a fake clinician approval state when no clinician has reviewed the prototype.
5. Check mobile layout, long names, keyboard navigation, error focus and screen-reader announcements. Explain that saving and reminders are future features; do not implement them or offer working-looking controls that imply they exist.

## Deliverable and done condition

All result fixtures render accessibly and preserve prescription fidelity. Unknown information and unsupported items are visible. Editing inputs removes the current result. A person can identify what was checked, what remains unknown and why the plan is only a demonstration.
