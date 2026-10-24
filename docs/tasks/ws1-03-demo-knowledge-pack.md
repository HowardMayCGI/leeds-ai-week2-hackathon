# WS1-03 — Build the small versioned demo knowledge pack

- **Owner:** WS1 — data and rules
- **Status:** Todo
- **Depends on:** WS1-01, WS1-02 and WS2-01
- **Unblocks:** Real-data integration of WS2-02/03 and WS4-02

## Outcome

Supply a checked-in fixture pack that exercises the planner, with inspectable provenance and no dependence on a commercial dataset.

## Initial tasks

1. Start with approximately 6–10 demo items and 10–15 rules; reduce the count if source interpretation is unclear. Include a meal constraint, a directional separation constraint, an interval constraint, a non-timing review flag and an unsupported item.
2. Keep two visibly separate collections: source-backed illustrative facts about selected real products, and fully fictional medicines/rules for algorithm tests. If clinical meaning or reuse terms cannot be established, use the fictional collection for that case. No clinician validation is implied for either collection.
3. For any real numeric administration rule, cite the exact applicable product/source passage and record version, formulation and conditions. Never ask an LLM to fill a missing time gap, interaction or severity. Avoid building a generic interaction engine by guessing from academic labels.
4. Add the explicit coverage records agreed in WS1-02, including supplements and duplicate/combination ingredients. Unsupported identities and uncovered pairs remain detectable.
5. Validate the pack against the shared runtime schema. Check duplicate IDs, unresolved references, missing attribution, invalid intervals and rules with no provenance. Bundle a fixed version locally under the agreed data directory.

## Deliverable and done condition

A versioned local demo pack, source manifest and attribution/readme. Every supported item/rule can be traced to an authored fictional example or an applicable source. At least one rule demonstrates why spacing cannot resolve a flagged combination. WS2 can load the pack offline; the UI can display its limitations and evidence status.
