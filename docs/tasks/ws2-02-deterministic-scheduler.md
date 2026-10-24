# WS2-02 — Implement deterministic constraint scheduling

- **Owner:** WS2 — solver and API
- **Status:** Todo
- **Depends on:** WS2-01 and WS1-02; use fictional rules until WS1-03 is ready
- **Unblocks:** WS2-04 and integrated timetable results

## Outcome

Generate a repeatable draft from confirmed prescription instructions, supported rules and the person's routine.

## Initial tasks

1. Build a pure scheduling function with explicit inputs and no network or model calls. Expand prescribed doses into occurrences without altering dose, formulation, frequency or total quantity. Reject unresolved discrepancies and unsupported regimens before solving.
2. Apply the agreed hard constraints for food, permitted windows, directional spacing and repeat intervals. Check the last dose against the next day's first dose for a repeating daily routine. Reject unsupported date/clock-change handling rather than approximating it silently.
3. Apply soft preferences only after satisfying hard constraints: fit waking hours and reduce distinct administration events where permitted. Use a deterministic tie-break and return the same output for the same versioned input.
4. Represent review-required combinations and unknown coverage as unresolved results; do not attempt to solve them by spacing. Detect genuinely incompatible constraints separately from unsupported inputs.
5. Bound search time/work. Return a distinct diagnostic for search exhaustion; never label it proof that no valid schedule exists. Return a conflict only when incompatibility has actually been established for the supported model.

## Deliverable and done condition

The solver generates a valid draft for the positive fictional fixture and correctly handles directional timing, overnight intervals, an impossible fixture and unknown inputs. Tests assert constraint properties and prescription fidelity rather than requiring one arbitrary timetable. WS2-03 validates every returned draft before it is exposed through the API.
