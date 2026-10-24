# WS1-02 — Define executable rule types and coverage

- **Owner:** WS1 — data and rules
- **Status:** Todo
- **Depends on:** WS1-01; coordinate shared types through WS2-01
- **Unblocks:** WS1-03, WS2-02 and WS2-03

## Outcome

Represent what the demo actually knows so the solver can distinguish a timing constraint from a clinical review flag or an information gap.

## Initial tasks

1. Agree rule variants with WS2: prescribed dose/frequency and allowed times; food relationships; directional drug/supplement spacing; repeat-dose intervals; review-required combinations; unknown/unsupported applicability. Keep hard constraints separate from patient preferences.
2. Define direction precisely. “A at least N minutes before B” differs from an undirected gap. Empty-stomach rules may constrain both preceding and following meals. Specify units, interval endpoints, dose occurrences, midnight handling and applicability to exact formulations.
3. Specify identity matching for ingredients, strengths, formulations and combination products. A brand-name match or ingredient match alone must not erase a formulation restriction. Unknown supplements retain the entered name rather than receiving a guessed match.
4. Add provenance: rule ID, rule-pack version, source URL/record ID, source date/version, jurisdiction, author, evidence status (`source_backed_demo` or `fictional_test`), applicability and verification limitations. Describe how source prose becomes a rule and how ambiguity becomes an unresolved issue.
5. Define explicit coverage for individual items and relevant pairs. A missing row means `unknown`; a covered fixture without a timing constraint is only a statement about the demo's assessed constraints. Avoid an inferred clinical “safe pair” list.

## Deliverable and done condition

A short data dictionary and representative examples accepted by WS2 and WS4, with shared types implemented by WS2. Every rule variant has an unambiguous interpretation and an unknown-data path. All numeric rules have provenance or are visibly fictional. Severity alone cannot be converted into a time gap.
