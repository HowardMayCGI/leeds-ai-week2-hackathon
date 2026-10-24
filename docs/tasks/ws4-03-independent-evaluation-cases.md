# WS4-03 — Define independent expected outcomes and evaluate failures

- **Owner:** WS4 — AI and evaluation
- **Status:** Todo
- **Depends on:** WS2-01; consult WS1's rule semantics
- **Unblocks:** WS4-04 release/demo assessment

## Outcome

Assess whether the prototype preserves instructions and handles its known limits, using expectations written before inspecting solver output.

## Initial tasks

1. Hand-author expected outcomes for at least twelve small cases from supplied fictional instructions/rules. For successful cases, specify properties and feasible bounds rather than treating one solver-generated timetable as the gold standard. Keep a small holdout set separate from AI prompt examples.
2. Cover valid scheduling, food boundaries, directional separation, cross-midnight intervals, missing/extra doses, unknown medicine, unknown supplement, actual-use discrepancy, ambiguous directions, unsupported weekly/as-needed regimen, non-timing review flag and impossible constraints. Cases may cover several properties.
3. Add API/model failures and malformed outputs. Check identity/formulation ambiguity, duplicate ingredients and stale-input results. Introduce deliberately broken plans to demonstrate that independent validation catches them.
4. Measure prescription fidelity, hard-constraint violations, correct unresolved outcomes, coverage reporting and AI unsupported claims. Record expected versus observed results and rule/model versions. Report metrics as demo evaluation, not clinical validation.
5. Maintain a short risk/limitations list and send failures to the owning workstream. Lack of clinician access means no clinically endorsed benchmark or real-patient safety claim; the team can still establish algorithmic correctness against its authored specification.

## Deliverable and done condition

A reproducible evaluation suite and results summary with no unexplained missed/extra doses or constraint violations in supported cases. Every required failure case yields the intended status. Remaining limitations are visible in the demo narrative, and no test derives its expected answer by calling the implementation under test.
