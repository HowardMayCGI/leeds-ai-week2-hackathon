# WS4-01 — Add bounded AI interpretation of instruction text

- **Owner:** WS4 — AI and evaluation
- **Status:** Todo
- **Depends on:** WS2-01 adapter/contract; use supplied fictional text immediately
- **Unblocks:** Optional AI-assisted clarification in WS3-02 and WS2-04

## Outcome

Demonstrate useful AI assistance by turning supplied text into explicit candidate fields and clarification questions.

## Initial tasks

1. Define and implement a server-side adapter under the agreed `medication/ai/` directory. Accept original directions or a patient's actual-use description and return candidate dose/frequency/timing, quoted source spans where practical and unresolved fields.
2. Preserve whether text describes a prescription or reported actual use. “As directed”, missing units, conflicting frequency and complex regimens must remain uncertain. Extracting a patient's report does not turn it into a prescribed instruction.
3. Constrain output to the shared schema and validate it at runtime. Treat source text as data, including text that tries to issue model instructions. Model output cannot provide trusted drug facts, rewrite a prescription, identify an unknown product by guesswork or declare an interaction absent.
4. Supply a deterministic no-key adapter for the fixed demo cases and an optional live provider. Keep secrets and provider calls on the server; bound input/output, timeout and retries. Do not expose or log raw health text unnecessarily.
5. Record model/prompt/configuration version and mode (`live` or `fixture`) in technical provenance. Send failures back as clarification/fallback rather than plausible fabricated fields. Coordinate HTTP wiring through WS2.

## Deliverable and done condition

WS3 can show extracted candidates for user confirmation. Tests cover ambiguity, a cadence discrepancy, malformed model output, prompt injection and provider unavailability. The deterministic planner remains usable without AI. Documentation explains the fixture mode openly.
