# Selected patients for Schedule my medicines

This folder contains the 10 selected synthetic patient FHIR bundles.
The JSON files are unchanged copies of the original files in `synthetic-population/`.

## Why these 10 patients were chosen

The script scanned all 1,000 JSON files and found 249 patients with at least five distinct active medicine products.
These 10 patients have 12–17 distinct active medicine products each.
They provide complex medicine lists and several examples relevant to the app brief:

- Confirming which medicines the patient currently takes.
- Reviewing different recorded dose frequencies.
- Distinguishing as-needed medicines from medicines with regular instructions.
- Representing repeated daily doses and recorded non-daily intervals.
- Asking for missing doses, dose units, and frequencies before creating a schedule.

The script favoured more medicine products and more instruction features.
It also favoured features and medicine products absent from earlier selections.
Source file paths determined the order when scores matched.
These patients are demonstration examples, rather than a representative sample of the population.

## How to read the counts

Medicine counts use distinct coded products from active `MedicationRequest` resources linked to each patient.
Repeated requests for the same coded product count once.
Different strengths or forms can count as different products.
Stopped prescriptions do not count.
The selection excludes records that mark the patient as deceased.
Active status reflects the exported record and does not confirm current use.
The selection does not establish harmful polypharmacy, medicine interactions, or concurrent treatment.

The table counts active prescription records with each feature.
A prescription can appear in several columns.
As-needed counts use structured flags. Free-text instructions can contain additional information.
Missing counts refer to structured fields, even when free text exists.

| Patient | Active products | As-needed | Repeated daily doses | Non-daily intervals | Missing dose | Missing frequency | Missing dose unit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mitch XXTESTPATIENT-Trantow | 13 | 2 | 2 | 1 | 8 | 8 | 5 |
| Stanley Ned XXTESTPATIENT-Schneider | 16 | 4 | 3 | 0 | 12 | 12 | 4 |
| Raylene Loriann XXTESTPATIENT-Ledner | 15 | 3 | 2 | 0 | 11 | 11 | 4 |
| Yong Guillermo XXTESTPATIENT-Harvey | 17 | 7 | 0 | 0 | 15 | 15 | 2 |
| Genevive Despina XXTESTPATIENT-Ernser | 12 | 1 | 2 | 2 | 6 | 6 | 6 |
| Lilliana Kimbra XXTESTPATIENT-Lockman | 13 | 0 | 2 | 1 | 7 | 7 | 6 |
| Jean Louis XXTESTPATIENT-Steuber | 16 | 3 | 0 | 0 | 13 | 13 | 3 |
| Burl XXTESTPATIENT-Predovic | 13 | 3 | 3 | 0 | 8 | 8 | 5 |
| Carri Dianna XXTESTPATIENT-Cartwright | 13 | 3 | 1 | 0 | 9 | 9 | 4 |
| Gene Orval XXTESTPATIENT-Witting | 12 | 2 | 1 | 0 | 8 | 8 | 4 |

## Rationale for each patient

### 1. Mitch XXTESTPATIENT-Trantow

Mitch combines repeated daily doses, a recorded three-day interval, and two as-needed medicines. This record supports testing daily and non-daily schedule entries together.

Patient ID: `49ddc2f5-02f8-da60-8d64-41595782a68f`

FHIR bundle: [Mitch_Trantow_49ddc2f5-02f8-da60-8d64-41595782a68f.json](Mitch_Trantow_49ddc2f5-02f8-da60-8d64-41595782a68f.json)

### 2. Stanley Ned XXTESTPATIENT-Schneider

Stanley has 16 active medicine products, including four as-needed medicines and three products with repeated daily doses. This record supports testing a long confirmation list and different recorded frequencies.

Patient ID: `f6c35acf-f855-2e0b-855f-abaa0d235afe`

FHIR bundle: [Stanley_Schneider_f6c35acf-f855-2e0b-855f-abaa0d235afe.json](Stanley_Schneider_f6c35acf-f855-2e0b-855f-abaa0d235afe.json)

### 3. Raylene Loriann XXTESTPATIENT-Ledner

Raylene combines different recorded frequencies, repeated daily doses, and three as-needed medicines. This record also supports testing instructions that need clarification before the app creates a schedule.

Patient ID: `59759632-2c03-4817-6232-519f1f17cf8d`

FHIR bundle: [Raylene_Loriann_Ledner_59759632-2c03-4817-6232-519f1f17cf8d.json](Raylene_Loriann_Ledner_59759632-2c03-4817-6232-519f1f17cf8d.json)

### 4. Yong Guillermo XXTESTPATIENT-Harvey

Yong has the largest active medicine list in this selection, with 17 products and seven as-needed medicines. This record supports testing a long confirmation list with extensive missing structured information.

Patient ID: `06ac9131-02da-75df-d057-0f9e34a125b6`

FHIR bundle: [Yong_Harvey_06ac9131-02da-75df-d057-0f9e34a125b6.json](Yong_Harvey_06ac9131-02da-75df-d057-0f9e34a125b6.json)

### 5. Genevive Despina XXTESTPATIENT-Ernser

Genevive combines repeated daily doses with two products that have recorded non-daily intervals. This record supports testing different intervals and asking the patient to check recorded instructions.

Patient ID: `16d68106-6618-6116-4c67-3b1334e9b1ce`

FHIR bundle: [Genevive_Despina_Ernser_16d68106-6618-6116-4c67-3b1334e9b1ce.json](Genevive_Despina_Ernser_16d68106-6618-6116-4c67-3b1334e9b1ce.json)

### 6. Lilliana Kimbra XXTESTPATIENT-Lockman

Lilliana combines repeated daily doses with a recorded three-day interval and no structured as-needed flags. This record offers a different confirmation example from the selections with as-needed medicines.

Patient ID: `ed8493b7-544a-91de-ffff-fecb512a3c7b`

FHIR bundle: [Lilliana_Kimbra_Lockman_ed8493b7-544a-91de-ffff-fecb512a3c7b.json](Lilliana_Kimbra_Lockman_ed8493b7-544a-91de-ffff-fecb512a3c7b.json)

### 7. Jean Louis XXTESTPATIENT-Steuber

Jean has 16 active medicine products, three as-needed medicines, and extensive missing structured information. This record supports testing medicine confirmation and requests for missing details.

Patient ID: `638916b8-3320-c108-e5d1-2a7a5552d046`

FHIR bundle: [Jean_Steuber_638916b8-3320-c108-e5d1-2a7a5552d046.json](Jean_Steuber_638916b8-3320-c108-e5d1-2a7a5552d046.json)

### 8. Burl XXTESTPATIENT-Predovic

Burl combines three products with repeated daily doses, different recorded frequencies, and three as-needed medicines. This record supports testing several potential daily entries while keeping as-needed medicines clearly identified.

Patient ID: `eacf0d03-4750-1277-126b-f9f63837601c`

FHIR bundle: [Burl_Predovic_eacf0d03-4750-1277-126b-f9f63837601c.json](Burl_Predovic_eacf0d03-4750-1277-126b-f9f63837601c.json)

### 9. Carri Dianna XXTESTPATIENT-Cartwright

Carri combines 13 active medicine products, different recorded frequencies, and three as-needed medicines. This record supports testing medicine confirmation, instruction clarification, and changes to a long medicine list.

Patient ID: `adf6866c-1a03-bc9e-6a7e-4a87daddd148`

FHIR bundle: [Carri_Dianna_Cartwright_adf6866c-1a03-bc9e-6a7e-4a87daddd148.json](Carri_Dianna_Cartwright_adf6866c-1a03-bc9e-6a7e-4a87daddd148.json)

### 10. Gene Orval XXTESTPATIENT-Witting

Gene combines 12 active medicine products, two as-needed medicines, and a recorded four-hour interval. This record adds a structured hourly interval to the demonstration examples.

Patient ID: `a5370d0e-e769-c129-5aff-bc7d87e3d733`

FHIR bundle: [Gene_Witting_a5370d0e-e769-c129-5aff-bc7d87e3d733.json](Gene_Witting_a5370d0e-e769-c129-5aff-bc7d87e3d733.json)

## Limits and useful app demonstrations

These records support the medicine confirmation and missing-information parts of the app flow.
They contain no recorded food requirements or required gaps between different medicines.
A recorded interval between doses does not establish a required gap between different medicines.
Food and medicine-spacing demonstrations need separate, reviewed instructions.
Routine times, supplements, saved schedules, and reminder preferences need separate app data.

Some free-text instructions and structured frequencies differ.
For example, Raylene and Carri have instructions stating `Every four hours (qualifier value)`.
Their corresponding structured fields state `frequency: 4`, `period: 1.0`, and `periodUnit: d`.
These values describe four doses per day, which differs from an interval of four hours.
Raylene also has `Every twelve hours as required (qualifier value)` alongside `asNeededBoolean: false`.
Genevive has a recorded interval of 60 days for `Levothyroxine sodium 75microgram tablets`.
The files preserve these values. They are useful examples for the instruction-checking flow.
The app should request clarification before it creates a schedule from conflicting or incomplete instructions.

Medicine names alone do not establish food requirements, required spacing, or an appropriate schedule.

## Selection source

The existing script `scripts/select_polypharmacy.py` produced this selection.
The original selection evidence appears in `demo-patients/manifest.json` at the repository root.
This folder keeps the same 10 patients and their original filenames.
