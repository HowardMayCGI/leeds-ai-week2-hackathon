# WS4-02 — Explain validated decisions using supplied evidence

- **Owner:** WS4 — AI and evaluation
- **Status:** Todo
- **Depends on:** WS2-01, WS1-02; WS1-03 evidence and WS2-03 validation for integration
- **Unblocks:** Optional AI wording in WS3-04

## Outcome

Explain a plan's actual constraints without adding new medical instructions or altering the timetable.

## Initial tasks

1. Build deterministic explanations first, mapping structured rule/result IDs to readable reasons. A baseline explanation must be available with no external provider.
2. Optionally let a model simplify only the supplied evidence/decision text. Bind explanations to item, rule and source IDs; select clickable source URLs from the trusted pack rather than trusting model-generated citations.
3. Keep drug names, doses and times rendered from the validated structured plan. The model should return bounded explanations, not a rewritten schedule, new interaction claims, prescription changes or general missed-dose advice.
4. Explain uncertainty directly: unknown supplement, unresolved directions, unsupported regimen and unsatisfiable rules. Avoid implying that unknown coverage means compatibility or that a non-timing interaction can be fixed by moving a dose.
5. Validate explanation structure, allowed references and prohibited new instructions; use deterministic text on failure or unsupported phrasing. Version the prompt/configuration. Preserve the distinction between sourced demo facts and fictional test rules.

## Deliverable and done condition

Each displayed reason maps to an existing decision and source. The timetable remains identical with AI enabled, disabled or unavailable. Tests include invented citations, attempts to change a dose/time and a refusal outcome. No generated wording upgrades a demo draft to clinical approval.
