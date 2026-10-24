# WS2-03 — Validate proposed plans independently of the search

- **Owner:** WS2 — solver and API
- **Status:** Todo
- **Depends on:** WS2-01, WS1-02; can start before WS2-02 finishes
- **Unblocks:** Draft responses in WS2-04

## Outcome

Check the completed timetable against the original confirmed inputs and trusted rule pack without trusting the scheduler's own success flag.

## Initial tasks

1. Implement a validator with its own checks; it must not rerun the solver as its oracle. Sharing schema and basic parsing is reasonable, but a claimed satisfied-rule list is not evidence of satisfaction.
2. Check a one-to-one mapping of prescribed occurrences to planned doses, including missing/extra doses, duplicates, formulation/dose changes and incorrect frequency. Use stable IDs rather than display names or row position.
3. Independently check meal relationships, directional separation, within-day and overnight repeat intervals, coverage and unresolved instructions. Confirm source/rule-pack versions and the input snapshot match the plan being validated.
4. Make hand-edited invalid schedules for tests: delete a dose, duplicate one, reverse a directional gap, move a dose into a forbidden meal window and alter the final-to-first interval. Add a stale-input case.
5. Return structured violation IDs and affected items. Validation failure prevents a draft response and any AI explanation that would imply successful checks.

## Deliverable and done condition

Every deliberately corrupted timetable is rejected for the expected reason and valid supported fixtures pass. API orchestration uses this check on every candidate. Documentation describes the result as satisfying the encoded demo constraints, without claiming clinical safety or complete knowledge.
