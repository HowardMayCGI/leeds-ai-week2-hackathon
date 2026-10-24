# WS2-04 — Expose the planner through the existing API

- **Owner:** WS2 — solver and API
- **Status:** Todo
- **Depends on:** WS2-01/02/03 and WS1-04; WS4 AI adapters are optional additions
- **Unblocks:** WS3 live integration and WS4-04

## Outcome

Connect the browser to the planner through the current local server and Lambda architecture.

## Initial tasks

1. Implement the agreed demo-record and planning routes while preserving `/api/random`, origin-secret checks and no-store responses. Load server-owned local rules and fictional records; accept no client-supplied trusted rules or validation verdicts.
2. Add bounded JSON body handling to the Lambda request abstraction and local HTTP adapter. Review async handling: the existing core handler is synchronous and the local adapter must await any new async AI/HTTP path. Avoid breaking current callers and tests.
3. Validate inputs, run coverage/discrepancy checks, invoke the solver and independent validator, and return typed results with stable issue IDs and provenance. Distinguish malformed requests, domain outcomes, model failures and internal faults.
4. Wire WS4's optional interpretation/explanation adapter. Keep credentials server-side, use bounded timeouts and provide a deterministic fallback when no provider is configured. Do not log raw medicine lists or patient text. Keep the normal path independent of live external data services.
5. Verify the existing Next.js local proxy and deployed `/api/*` routing support the new paths and methods. Coordinate any genuinely necessary infrastructure change as a separate owner-reviewed edit; avoid unrelated deployment changes.

## Deliverable and done condition

The UI can load a fixture and request every domain outcome locally. Relevant contract/API tests pass, request limits and invalid JSON are handled, and the random route still works. No database, reminder service, schedule persistence or real NHS integration is introduced.
