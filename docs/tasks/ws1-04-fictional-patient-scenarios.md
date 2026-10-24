# WS1-04 — Create fictional prescription and patient scenarios

- **Owner:** WS1 — data and rules
- **Status:** Todo
- **Depends on:** WS2-01; align supported cases with WS1-03
- **Unblocks:** WS3's fixture import and WS4's integrated demo

## Outcome

Make realistic input journeys available without NHS access or identifiable patient data.

## Initial tasks

1. Create approximately six named demo scenarios: schedulable routine, omitted known supplement, unknown supplement, prescribed/reported regimen discrepancy, ambiguous directions and impossible timing constraints. Include an unsupported non-daily regimen as a separate case or variant.
2. Include stable item IDs, original prescription directions, medicine identity/formulation, strength, dose, prescribed frequency, source metadata and applicable start/stop information. Explain that the data represents a simulated record import.
3. Keep additions and reported actual use separate from imported prescriptions. Include one patient who reports taking a daily medicine every other day; the expected journey asks for clarification rather than silently changing the prescription.
4. Supply daily routine inputs and expected high-level outcome/reason codes. Have WS4 derive independent detailed expected results rather than copying solver output as the answer.
5. Add one refresh/edit example demonstrating invalidation of a previous draft when the medicine list, actual-use answers or routine changes. Retain stable IDs when display order changes.

## Deliverable and done condition

Typed fictional fixtures and a concise scenario guide, delivered through the API's demo-record route. No scenario is represented as a real patient or an endorsed regimen. WS3 can build every step and failure state from these inputs. WS4 can identify the expected outcome of each case before running the planner.
