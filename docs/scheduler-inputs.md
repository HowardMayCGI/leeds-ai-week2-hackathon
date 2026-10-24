# Data for the medicine scheduler

## Production data sources

A patient's prescribed regimen and general medicines knowledge come from different sources. Product identity does not establish the patient's dose, frequency or treatment dates.

| Data                                                   | Existing source/API                                                                                                                                                                                                                                                                                   | Practical implication                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patient's prescriptions, dose instructions and history | Authorised integration with the GP/EPR or dispensing system. [GP Connect Patient Facing Access Record](https://digital.nhs.uk/developer/api-catalogue/gp-connect-patient-facing-access-record-fhir) is an NHS API for access to GP records.                                                           | Confirm the appropriate patient-facing integration and onboarding with NHS England/the record supplier. The clinician-facing [GP Connect Access Record Structured API](https://digital.nhs.uk/developer/api-catalogue/gp-connect-access-record-structured-fhir) explicitly excludes creating patient-facing record views; it is not an unrestricted shortcut. An NHS number alone is not authorisation. |
| Product codes, ingredients, forms and strengths        | [NHS dm+d](https://digital.nhs.uk/services/terminology-and-classifications/dm-d), through terminology services or [TRUD downloads/API](https://isd.digital.nhs.uk/).                                                                                                                                  | Use to identify products and map codes. dm+d explicitly does not provide decision support. It cannot supply the patient's prescribed amount or a complete timing/interaction engine.                                                                                                                                                                                                                    |
| Clinical medicines knowledge and interactions          | [Stockley's licensed API](https://content.medicinescomplete.com/docs/index.html), [FDB medicines knowledge/API offerings](https://www.fdbhealth.info/) and [Multilex API deployment](https://www.fdbhealth.co.uk/insights/blog-article/2025-05-30-multilex-update-to-net-api-and-web-api-deployment). | Requires appropriate vendor access and licensing. Confirm UK product mapping, supported administration fields and patient-facing display rights with the vendor; do not assume every product supplies every scheduling field.                                                                                                                                                                           |
| Product administration instructions                    | Product-specific SmPC/PIL, plus reviewed [NHS medicines guidance](https://www.nhs.uk/medicines/).                                                                                                                                                                                                     | Useful primary source material for curated examples. Public readability does not establish API availability or bulk redistribution rights. Avoid automatically turning unreviewed prose into clinical scheduling rules.                                                                                                                                                                                 |
| Actual current use and daily routine                   | Patient/carer confirmation and the routine questionnaire                                                                                                                                                                                                                                              | Records can be incomplete or outdated. Collect meals, wake/sleep times, OTC products, supplements and relevant instructions; reconcile discrepancies with a pharmacist/prescriber.                                                                                                                                                                                                                      |

## Hackathon choice

Use synthetic prescriptions and a small, versioned, original demo rules file with public source links. The new file is `apps/api/src/data/demo-administration.json`: four administration rules covering six exact supplied products (levothyroxine, alendronic acid, both naproxen strengths and both simvastatin strengths). All remaining products explicitly have undefined administration coverage. “No rule defined” never means “no restrictions”.

The interaction knowledge remains in `demo-interactions.json`. Both datasets are labelled demo-only and not clinically validated. They are statically included in the API bundle. No external credentials, paid services or infrastructure changes are required.

For the presentation, choose a few reconciled demonstration scenarios: a meal-related medicine, a levothyroxine/iron separation, and a combination requiring medication review. Confirm the demonstration doses and instructions with a clinician if available. Do not fill missing patient doses from usual dosing tables or product strength. The source patient files have not been changed to invent complete prescriptions.

## Endpoint

```http
GET /api/patients/9991789243/schedule-inputs
```

This returns the current/de-duplicated prescription list plus the information a scheduler needs to request confirmation and build a proposal. It is a data endpoint, not a schedule generator. It uses the existing origin check, NHS-number format validation, GET-only access and no-store policy. Invalid NHS-number format returns 400; unknown patient returns 404.

| Response field                   | Meaning                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `versions`                       | Versions of administration and interaction rules used.                                                                                                                                                             |
| `medicines[].medication`         | Existing medication data plus **all original `dosageInstructions`**, including free text, ranges, multiple steps and fields the demo does not interpret. This raw field is also now available from `/medications`. |
| `medicines[].use`                | `regular`, `as_needed`, or `unconfirmed`; an absent PRN flag is not interpreted as regular use.                                                                                                                    |
| `medicines[].prescriptionTiming` | Explicit frequency/period/unit, fixed times, FHIR `when` codes, supported coded minimum intervals, and whether an interval anchor is needed.                                                                       |
| `medicines[].administration`     | Exact-product rule IDs, constraints, source IDs, human-readable instructions and coverage.                                                                                                                         |
| `medicines[].issues`             | Missing/unsupported/conflicting details. Each has a code, message and resolution (`confirm_prescription` or `professional_review`).                                                                                |
| `interactions`                   | Complete existing interaction assessment, including spacing constraints and prescriber/dose reviews.                                                                                                               |
| `administrationSeparations`      | Directional gaps generated from administration rules: `medicationId` must be taken **before** `beforeMedicationId` by at least `minimumGapMinutes`. These supplement interaction gaps; apply both.                 |
| `sources`                        | Source titles, URLs and access dates for the returned rules.                                                                                                                                                       |
| `readiness`                      | `review_required` or `confirmation_required`, medicine IDs with issues, and required confirmation/routine/special-instruction steps.                                                                               |

Example administration data (excerpt, not a complete response):

```json
{
  "coverage": "demo_rule",
  "ruleIds": ["levothyroxine-before-food"],
  "constraints": [
    {
      "type": "food",
      "relationship": "before_first_food",
      "minimumGapMinutes": 30,
      "strength": "requirement"
    },
    {
      "type": "before_other_oral_medicines",
      "minimumGapMinutes": 30,
      "strength": "requirement"
    }
  ],
  "instructions": [
    "Take on an empty stomach 30 to 60 minutes before the first meal, caffeine or other medicines. Confirm the prescription instructions. Longer interaction-specific gaps still apply."
  ],
  "sourceIds": ["admin-levothyroxine"]
}
```

The rule uses a minimum 30-minute food gap; the full advice remains visible for confirmation. Caffeine is not modelled as a questionnaire time. The scheduler must display and obtain acknowledgement of the instructions, not claim to have verified them from meal times alone.

Constraint types are `food`, `time_of_day`, `before_other_oral_medicines`, `remain_upright` and `plain_water_only`. Required constraints cannot be relaxed to make a schedule fit. Preferences such as the demonstration naproxen meal preference or simvastatin evening preference are distinct from requirements. The naproxen example selects a meal time as one way to follow “with or after food”; it does not invent a maximum interval after a meal.

## Consumer sequence

1. Fetch the endpoint. Show the original prescription wording beside the derived fields and source guidance.
2. Ask which medicines are currently taken, including additions missing from the record. The returned interactions concern all recorded medicines; removing or adding medicines requires a fresh assessment. This GET endpoint cannot assess patient-added products or save confirmations.
3. Resolve every relevant issue. Confirm missing amounts/units and frequencies from the prescription label or with a pharmacist. Send unsupported regimens and contradictions for professional review. Never use the legacy display defaults in `medication.frequency` as evidence of a prescribed period: use `prescriptionTiming.frequency`, which requires explicit source values.
4. Collect the existing routine shape: `wake`, `sleep`, `meals.breakfast`, `meals.lunch`, `meals.dinner` (skipped meals are `null`). Confirm any required interval anchor, such as the last patch application or weekly dose date. The API does not persist or invent the routine or anchor.
5. Keep `as_needed` medicines out of regular scheduled dose slots. Their administration advice and interactions remain relevant if they are used. Review PRN limits; do not infer a maximum daily dose from frequency alone.
6. Apply fixed times, supported FHIR timing codes, meal requirements, directional administration gaps and all interaction gaps. Apply separations to every relevant occurrence, including across midnight. For PRN medicines this is conditional on an actual dose. A frequency of four doses per day does not itself mean exactly every six hours. Honor a separately prescribed interval where present.
7. If any mandatory constraints cannot be met, or medicines compete to be taken first, request review rather than silently choosing a sequence. Display posture/water/caffeine instructions as applicable and obtain acknowledgement.
8. Show a proposal for confirmation. `readiness` never claims clinical clearance: even complete recorded inputs still need current-use and routine confirmation. A successful HTTP response does not mean a schedule is safe to save.

The [schedule proposal API](scheduler-api.md) now accepts the complete confirmed medicine list, including additions, and the routine, then computes a timetable with warnings. A frontend adapter must resolve these input issues and construct that request; it must not discard instructions it does not understand. The existing UI has not yet switched to the API. For the hackathon, demonstrate only supported, confirmed regimens.

## Verification

Tests cover exact product/source mapping; missing dose/unit/frequency/PRN fields; preservation of text/ranges/multiple steps; interval anchors; coded minimum gaps; invalid/conflicting timing; food/posture/water requirements; directional versus interaction gaps; conflicting first-medicine rules; PRN interaction checks; and all indexed patients. Endpoint tests cover access, validation, method and cache behaviour.

```sh
pnpm nx run api:typecheck
pnpm nx run api:test
pnpm nx run api-contract:typecheck
pnpm nx run api:build
```
