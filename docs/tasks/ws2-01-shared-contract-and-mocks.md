# WS2-01 — Freeze shared types, result states and response fixtures

- **Owner:** WS2 — solver and API
- **Status:** Todo — first coordination task
- **Depends on:** None; consult WS1, WS3 and WS4
- **Unblocks:** All implementation workstreams

## Outcome

Let all four teammates build in parallel against one small contract in the existing `packages/api-contract` package.

## Initial tasks

1. Turn the [shared decisions](README.md#shared-decisions-to-freeze-first) into request/response types and runtime validation. Separate original prescribed instructions, AI extraction candidates, reported actual use, confirmed input and patient-added items. Treat strength, prescribed dose and tablet count distinctly.
2. Define `draft`, `needs_clarification`, `unsupported` and `conflict`, stable item/rule IDs, issue codes, coverage, evidence versions, validation results and the exact input snapshot/version used by a draft. Confirmed patient reports do not alter prescribed instructions.
3. Agree proposed routes: `GET /api/medication-demo`, `POST /api/medication-plan` and optional `POST /api/medication-interpret`. Define method handling, request bodies, validation errors and server-error responses. A clinically unresolved result is a typed domain response, not a transport failure.
4. Publish minimal representative responses for every result state and an AI adapter interface. WS1 owns data/rule semantics, WS3 consumes results, WS4 implements the AI interface; WS2 alone edits the shared definitions after agreement.
5. Specify bounded input sizes and that trusted rules/validation statuses are generated server-side. The contract supports no schedule saving, reminders or record write-back.

## Deliverable and done condition

Shared types, runtime validators and mock responses that pass meaningful malformed-input checks. Each teammate can name the contract version and start work without waiting for another implementation. Preserve the random-number API contract and route.
