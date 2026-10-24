# WS3-02 — Capture prescribed instructions and actual use separately

- **Owner:** WS3 — patient experience
- **Status:** Todo
- **Depends on:** WS3-01 and WS2-01
- **Unblocks:** WS3-03 confirmed request and discrepancy demonstrations

## Outcome

Ask whether each item is taken as instructed and capture differences without rewriting the prescription.

## Initial tasks

1. For each item ask whether the person follows the recorded instructions, follows another regimen, or is unsure. Display original directions alongside the answer using neutral, non-judgmental wording.
2. Capture reported dose, frequency, timing/cadence and optional explanation when different. Support free text for complex reports, while showing that variable, weekly, tapering and as-needed schedules are outside the initial solver scope.
3. Clearly distinguish a patient-confirmed report from a confirmed prescribed instruction. A patient's acknowledgement of taking a different dose or cadence must not authorise the app to schedule that alternative. Return unresolved discrepancies for clarification and explain why no complete draft is available.
4. If WS4's interpretation feature is available, show extracted candidate fields next to their source text for explicit confirmation. Never overwrite the record, automatically accept a model suggestion or lose an uncertainty flag.
5. Preserve answers across steps within the session. Changing an item, directions or report invalidates an existing draft. Permit users to correct their own report; changes to prescribed instructions must have an explicit simulated-record source in the demo.

## Deliverable and done condition

The demo can show a patient reporting every-other-day use against a daily prescription, retain both values and reach `needs_clarification`. An “unsure” answer stays unresolved. A supported matching regimen can proceed. No wording suggests that the app has approved a prescription change or given missed-dose advice.
