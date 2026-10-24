# Drug interactions for the hackathon

An adverse drug interaction occurs when another substance changes a medicine's effects in a way that can cause harm or reduce treatment effectiveness. Pharmacokinetic interactions change absorption, distribution, metabolism or elimination. Pharmacodynamic interactions combine effects, such as bleeding or slowing the heart. A potential interaction is a reason to assess the combination, not evidence that a patient has suffered harm.

The key scheduling distinction is **same dose time versus concurrent treatment**. Some absorption interactions can be reduced by spacing doses. Many other interactions persist throughout treatment, even when medicines are taken hours apart. A major interaction is not automatically an absolute contraindication: some combinations are intentional with dose adjustment or monitoring.

This is an original, deliberately incomplete demonstration dataset compiled from public information, not a reproduction of Stockley's or a clinically validated checker. Severity labels and management categories are our demo classifications, not ratings supplied by those sources. Product codes and labels are copied from the supplied synthetic records; we have not independently verified them against a terminology service.

## Entities and fields

| Entity              | Fields in this implementation                                                                                               | Purpose                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Ingredient          | `id`, `name`                                                                                                                | Normalise different strengths and brands to the same substance. IDs are local slugs, not SNOMED ingredient identifiers. |
| Product             | `code`, `system`, `name`, `ingredientIds`, `route`                                                                          | Preserve the coded product and combination ingredients. Strength and formulation are retained in the supplied name.     |
| Patient medicine    | Existing API `Medication`: product code/system, prescription ID, dose, frequency, PRN flag, instructions, prescription date | Identify the particular prescriptions involved. Active records are not confirmation of concurrent use.                  |
| Interaction rule    | `id`, ingredient pair, severity, mechanism, effect, patient guidance, structured management, source IDs                     | Define what can happen and what the scheduler or reviewer must do.                                                      |
| Source              | `id`, title, URL, access date                                                                                               | Trace an example to public prescribing information.                                                                     |
| Dataset             | Version, compilation date, demo and clinical-validation flags                                                               | Identify precisely which rules were applied.                                                                            |
| Matched interaction | Rule plus unique match ID, `ruleId`, two full patient medicines                                                             | Join generic knowledge to a patient's record.                                                                           |
| Assessment response | Matches, sources, unchecked medicines, coverage notice, scheduler status and constraints                                    | Keep clinical review separate from timing optimisation.                                                                 |

An interaction is an attributed relationship between ingredients. Matching is unordered (A+B equals B+A), but its mechanism and management can be directional: verapamil raises digoxin exposure, not necessarily the reverse. Multiple strengths produce distinct prescription matches with the same `ruleId`. Coded products are matched by exact code **and** system; names are never fuzzy-matched.

A full checker would also need structured strength/formulation, validated ingredient and class terminology, evidence quality, onset/duration, route and dose conditions, patient risk factors (renal function, age, pregnancy, diagnoses), monitoring requirements, food/alcohol/herbal interactions, therapeutic duplication and combinations of three or more medicines. These are not evaluated here. Food and administration instructions belong alongside interaction rules: taking a medicine with food does not cancel an unrelated bleeding risk.

## JSON relationship example

This is a complete rule from `apps/api/src/data/demo-interactions.json`; its source reference resolves in the dataset's `sources` array:

```json
{
  "id": "levothyroxine--ferrous-sulfate",
  "ingredients": ["levothyroxine", "ferrous-sulfate"],
  "severity": "moderate",
  "mechanism": "pharmacokinetic",
  "effect": "Iron reduces absorption of levothyroxine.",
  "patientGuidance": "Keep these doses at least 4 hours apart. Ask your pharmacist to confirm the timing and any thyroid blood tests needed.",
  "management": {
    "action": "separate_doses",
    "minimumGapMinutes": 240,
    "direction": "either_order",
    "guidance": "Apply the gap to every dose, including across midnight. Spacing may not eliminate the interaction; thyroid monitoring may still be needed."
  },
  "sourceIds": ["levothyroxine-label"]
}
```

The other management variants are `prescriber_review` (guidance, no spacing constraint) and `dose_review` (ingredient ID, maximum daily dose, guidance). A dose limit is not a statement that the current dose exceeds it. This implementation requires review for all matched dose-limit examples because the source records do not reliably establish total daily ingredient doses. It never derives a daily dose from the tablet strength alone or changes a prescribed dose.

## Included clinical examples

There are 36 products, 32 ingredients and 10 rules. All examples use ingredients from the supplied list.

| Combination                     | Concern                                   | Demo action / public source                                                                                                                                                       |
| ------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Levothyroxine + ferrous sulfate | Reduced thyroid medicine absorption       | Four-hour separation; monitoring may still be needed. [Euthyrox label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bc3c6830-ba68-4ba3-9896-a12d0ad0b275).            |
| Warfarin + naproxen             | Bleeding                                  | Prescriber review; spacing does not resolve it. [CUH guidance](https://www.cuh.nhs.uk/patient-information/oral-anticoagulant-therapy-with-warfarin-phenindione-or-acencoumarol/). |
| Warfarin + aspirin              | Bleeding; sometimes intentional treatment | Confirm indication and monitoring. [CUH guidance](https://www.cuh.nhs.uk/patient-information/oral-anticoagulant-therapy-with-warfarin-phenindione-or-acencoumarol/).              |
| Clopidogrel + naproxen          | Gastrointestinal bleeding                 | Review analgesia and bleeding risk. [Naproxen leaflet](https://www.medicines.org.uk/emc/files/pil.2099.pdf?filename=PIL.2099.pdf).                                                |
| Verapamil + atenolol            | Additive slowing of heart rate/conduction | Prescriber review. [Verapamil label](https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8f549319-bbd9-4255-89fb-94cb9372517e).                                          |
| Verapamil + metoprolol          | Additive cardiac effects                  | Prescriber review. [Verapamil label](https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8f549319-bbd9-4255-89fb-94cb9372517e).                                          |
| Verapamil + digoxin             | Increased digoxin levels                  | Dose/level and renal-function review. [Verapamil label](https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8f549319-bbd9-4255-89fb-94cb9372517e).                       |
| Verapamil + tacrolimus          | Increased tacrolimus exposure             | Specialist review and levels. [EMA product information](https://www.ema.europa.eu/en/documents/product-information/envarsus-epar-product-information_en.pdf).                     |
| Simvastatin + amlodipine        | Dose-dependent muscle toxicity risk       | Confirm simvastatin daily dose is no more than 20mg. [MHRA](https://www.gov.uk/drug-safety-update/simvastatin-dose-limitations-with-concomitant-amlodipine-or-diltiazem).         |
| Simvastatin + verapamil         | Increased statin exposure                 | Confirm simvastatin daily dose is no more than 20mg. [UK SmPC](https://www.medicines.org.uk/emc/product/10666/smpc).                                                              |

These examples illustrate review rather than an unconditional ban on concurrent treatment. Do not describe all alerts as “these medicines cannot be taken together”.

## API for the frontend

```http
GET /api/patients/9991789243/interactions
```

Uses the existing NHS-number validation, current/de-duplicated medicine repository, origin-secret check, GET-only access and no-store responses. PRN medicines remain eligible for interaction matching. Invalid NHS-number format returns 400; unknown patient returns 404. The existing development proxy works without infrastructure changes.

The response has `nhsNumber`, `datasetVersion`, `demoOnly: true`, `clinicallyValidated: false`, `assessment: "potential_interactions_from_record"`, `coverage: "limited_demo_rules"`, `notice`, `sources`, `interactions`, `uncheckedMedications` and `scheduling`. See the shared types in `packages/api-contract/src/index.ts` for the full contract.

Each match includes full prescription details, `ruleId`, mechanism, severity, effect, patient guidance and management. Its unique `id` includes the rule ID and both prescription IDs. Source URLs are returned for matched rules only.

Frontend/scheduler handling:

1. `review_required`: show the guidance and a **Book a medication review** action, or direct the patient to their anticoagulation/transplant team where specified. Do not finalise a schedule as resolving these alerts. Do not instruct patients to stop prescribed treatment themselves. Dose-limit checks also use this state.
2. `spacing_constraints`: pass `constraints` to the scheduler. Each includes the matched prescription IDs, minimum gap, direction and `appliesAcrossMidnight: true`. Apply the gap to every relevant dose and across day boundaries, alongside food and other administration instructions. Report an unsatisfiable schedule instead of relaxing constraints.
3. `no_rules_matched`: say no interactions were found **in the demo rules**. This is not clearance for clinical use.

Review takes priority if both kinds occur; the response retains spacing constraints. `uncheckedMedications` distinguishes an unknown code/system from a mapped product with no rules. Even a medicine with some rules has only partial coverage; the entire response remains labelled limited coverage. The API does not generate schedules or assess symptoms. The existing web scheduler is not wired to this new endpoint in this change.

## Demo patients and verification

| NHS number   | Synthetic patient                     | Example result                                                       |
| ------------ | ------------------------------------- | -------------------------------------------------------------------- |
| `9991789243` | Raylene Loriann XXTESTPATIENT-Ledner  | Verapamil with metoprolol and digoxin, plus simvastatin dose review. |
| `9993689246` | Gene Orval XXTESTPATIENT-Witting      | Clopidogrel with naproxen, plus simvastatin/amlodipine dose review.  |
| `9997111249` | Lilliana Kimbra XXTESTPATIENT-Lockman | Clopidogrel with naproxen.                                           |
| `9993679666` | Mitch XXTESTPATIENT-Trantow           | No demo rules match; useful for the limited-coverage state.          |

The indexed patients do not currently contain the levothyroxine/iron pair concurrently. That scenario is exercised directly in unit tests with the supplied product codes `39698911000001100` and `39107411000001105`, without altering source patient records. The tests also cover bleeding risks, PRN use, multiple strengths, dose limits, unknown coding systems, empty records, matching every rule, and all indexed patient products.

```sh
pnpm nx run api:typecheck
pnpm nx run api:test
pnpm nx run api:build
```

The JSON is statically imported into the Lambda bundle, so no external interaction service or additional deployment resource is needed.
