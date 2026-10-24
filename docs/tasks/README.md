# Medication planner: four-person implementation backlog

Prepared 24 October 2026. These are implementation tasks; no application changes or clinical dataset have been implemented as part of this planning work.

## Product scope

Build a new `/medication-planner` page in the existing LAI App, demonstrating a future NHS App feature using fictional prescription records. Preserve the random-number page. Show the imported list, let the patient add missed medicines and supplements, capture prescribed instructions and actual use separately, ask about their daily routine, and generate an explainable draft timetable.

There is no clinician available to validate this prototype. The result is an educational demonstration with synthetic patients and a deliberately limited rule set. Display that status throughout the journey and never describe a draft as clinically approved or safe. Demonstrating how unsupported cases are handled is part of the product.

Saving schedules, medication reminders, dose logging, NHS record integration, clinician approval workflows and prescribing/deprescribing recommendations are future work. Current session state is sufficient; explicitly explain that refreshing or leaving resets it. Keep architectural room for a future approved, versioned saved plan, without implementing persistence now.

## Team ownership

Assign one person to each workstream. Paths below describe proposed ownership for implementation, not files already present.

| Stream | Responsibility | Owns | Initial work items |
| --- | --- | --- | --- |
| WS1 | Data, clinical rule representation and fictional patients | `apps/api/src/medication/data/`, `apps/api/src/medication/fixtures/`, data-source notes | [01 Sources](ws1-01-data-sources-and-reuse.md), [02 Rule model](ws1-02-rule-model-and-coverage.md), [03 Demo knowledge](ws1-03-demo-knowledge-pack.md), [04 Patient scenarios](ws1-04-fictional-patient-scenarios.md) |
| WS2 | Shared contracts, deterministic solver, validation and HTTP API | `packages/api-contract/`, API handler/local adapter, `apps/api/src/medication/` except WS1/WS4 directories | [01 Contract](ws2-01-shared-contract-and-mocks.md), [02 Solver](ws2-02-deterministic-scheduler.md), [03 Validator](ws2-03-independent-plan-validator.md), [04 API](ws2-04-api-and-local-integration.md) |
| WS3 | Patient experience and accessibility | `apps/web/src/app/medication-planner/` and existing page navigation/styles | [01 Medicine list](ws3-01-planner-page-and-medicine-list.md), [02 Actual use](ws3-02-prescribed-and-reported-use.md), [03 Routine](ws3-03-daily-routine-and-request.md), [04 Results](ws3-04-timetable-and-unresolved-issues.md) |
| WS4 | AI assistance, independent evaluation and team integration | `apps/api/src/medication/ai/`, planner browser tests, demo/evaluation notes | [01 Interpretation](ws4-01-ai-instruction-interpretation.md), [02 Explanations](ws4-02-grounded-plan-explanations.md), [03 Evaluation](ws4-03-independent-evaluation-cases.md), [04 Integrated demo](ws4-04-integration-and-demo.md) |

WS2 owns shared contract edits. WS3 owns web implementation edits. WS2 wires WS4's AI adapter into the HTTP layer. WS4 coordinates integration by reporting issues to the relevant owner; ownership avoids concurrent edits to central files.

## Shared decisions to freeze first

WS2-01 is the first coordination point: agree the contract with the other three people and publish sample responses. Everyone can start their first task immediately using these decisions and mocks.

- **Identity:** stable item ID, ingredient/product identity where known, formulation, strength and dose as distinct fields. Supplements and combination products retain ingredient detail; unresolved names stay unresolved.
- **Instructions:** retain original record directions, their provenance and a structured prescribed regimen. Keep reported actual use, patient additions and discrepancy status separately. Patient confirmation confirms a report; it is not a new prescription. An unresolved discrepancy returns `needs_clarification` rather than adopting an alternative regimen.
- **Routine:** waking, meals and bedtime. Start with stable adult, fixed-dose, daily oral regimens on a declared ordinary demo day. Variable, weekly, tapering, as-needed, time-critical, unknown and unsupported regimens are visible but return an appropriate unresolved status. Avoid dates spanning clock changes until explicitly supported.
- **Rules:** prescription constraints, meal rules, directional separation/interval rules and non-timing review flags are different types. Preserve conditions, provenance, version and applicability. Missing interaction data is `unknown`, never evidence of compatibility. Only explicitly assessed scope can reach scheduling.
- **Results:** `draft`, `needs_clarification`, `unsupported` or `conflict`; HTTP/transport errors are separate. Include item-level issues, coverage, reason codes, original prescription fidelity, source/rule versions and validation outcome. `draft` means checked against the demo constraints only.
- **Authority:** the server uses its bundled versioned rule pack. The client and AI cannot supply trusted rules, a validated status, substitute medicines or changed doses.
- **AI:** optional server-side interpretation and explanation. Confirm extracted clinical fields before scheduling. The solver works without a model or API key. AI cannot invent interaction facts or repair failed constraints.
- **Data:** only fictional patient fixtures and deliberately selected demo items. Accept manual additions in the UI, but unresolved additions block a complete draft. No real patient records, external clinical data calls at runtime, persistent health-data storage or raw health-data logs.

## Parallel working order

1. **Start together:** WS1 researches sources; WS2 freezes types and response fixtures; WS3 builds against mocks; WS4 defines its adapter and writes independent expected outcomes.
2. **Build in parallel:** WS1 supplies the knowledge pack and scenarios; WS2 supplies solver/validator/API; WS3 completes the journey; WS4 supplies bounded AI features and evaluation cases.
3. **Integrate:** replace mocks with the API, exercise all result states, fix owner-specific failures and rehearse the demo. API credentials or external dataset downloads must not be a demo prerequisite.

The minimum demo is the full non-AI path: one schedulable fixture, one actual-use discrepancy, one unknown supplement and one impossible timetable. Add live AI only after this works. Do not remove failure handling to make time for AI.

## Completion and references

Each work item has scope, dependencies, initial steps and a checkable completion condition. Mark tasks done only after their named evidence exists. Repository commands and architecture are in the [project README](../../README.md); use the existing Nx tasks. Read applicable `AGENTS.md` instructions before changing implementation files.

Start with the [data-source assessment](../medication-data-sources.md) and [clinical/regulatory research](../medication-planner-research.md). Dataset reuse permissions and clinical suitability are separate decisions; the source assessment records both.
