# WS1-01 — Select data sources and record reuse terms

- **Owner:** WS1 — data and rules
- **Status:** Todo
- **Depends on:** None
- **Unblocks:** WS1-02, WS1-03 and WS4's grounded explanations

## Outcome

Choose a small, reproducible knowledge source strategy for a non-clinical hackathon demo without Stockley's, a commercial interaction feed or clinician access.

## Initial tasks

1. Read the [source assessment](../medication-data-sources.md). Examine DDInter 2.0's official downloads and terms; distinguish published pair/severity data from management text and executable timing rules. Check an actual file before promising a field exists.
2. Compare public UK NHS/SPS administration guidance and product-specific labels with DailyMed/openFDA. Record jurisdiction, formulation, source date/version, attribution and reuse restrictions for each chosen source. Prefer UK-applicable material for illustrative UK medicines.
3. Treat DDIExtraction as an extraction benchmark and TWOSIDES as adverse-event association research. Neither automatically supplies supported prescribing or dose-spacing rules. Treat dm+d/RxNorm as identity resources.
4. Record a decision for each candidate: use for demo, use only as background, or defer. If reuse is unclear, use independently authored fictional fixtures rather than making an external dataset a blocker. Preserve applicable attribution/share-alike notices for any permitted derived data; do not license third-party data as repository code.
5. Specify a local, pinned snapshot strategy. Do not depend on live source sites while generating a schedule.

## Deliverable and done condition

Update the source assessment with a chosen primary approach, fallback, inspected file/field details, citations, reuse decision and explicit coverage limits. WS2 and WS4 can identify which facts may be used and which remain unsupported without researching the sources themselves. No complete clinical coverage or clinical validation is claimed.
