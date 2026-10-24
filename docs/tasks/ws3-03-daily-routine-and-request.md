# WS3-03 — Collect the routine and request a draft

- **Owner:** WS3 — patient experience
- **Status:** Todo
- **Depends on:** WS3-01/02 and WS2-01; develop against mocks until WS2-04
- **Unblocks:** WS3-04 and the successful end-to-end journey

## Outcome

Give the planner practical daily context and submit the exact reviewed input snapshot.

## Initial tasks

1. Collect waking, breakfast, lunch, evening meal and bedtime for the fixed demo day. Offer clear editable example values. State the initial scope: a stable daily routine; shift work, variable meal patterns and clock-change dates need explicit future support.
2. Validate missing/impossible times and explain field errors accessibly. Distinguish soft preferences from prescribed hard timing constraints. Never relax a prescription rule because a preferred routine is difficult.
3. Show a final review of medicines/supplements, original instructions, reported differences and routine before submitting. Unknown items and discrepancies may be submitted to obtain structured feedback, but cannot be presented as a completed draft.
4. Submit the shared typed request to the planning endpoint, with loading, retry and cancellation/stale-response handling. Tie the response to its input snapshot; editing inputs during a request must not display an old plan as current.
5. Handle all four domain result states and transport errors through one client. Keep mocked response fixtures available for UI development without a live model, credentials or AWS.

## Deliverable and done condition

A user can complete a supported scenario, revise a meal time and request a new result. Previous drafts are invalidated on changes, late responses are ignored and network failures preserve session inputs for retry. There is no persistence or notification setup.
