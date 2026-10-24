# Medicines scheduler: POC journey and design decisions

Design session date: 24 October 2026.

This document records the agreed design for the “Schedule my medicines” proof of concept. It covers the patient journey, questions, medicine selection, language support and the visible behaviour around a proposed and saved schedule. Detailed schedule generation using the patient record and a medicine interaction database is reserved for a follow-on session.

The starting points were [app_overview.md](app_overview.md) and the [example screens](../figma-make-concept/src/App.tsx). Where those differ from decisions below, this document records the decisions agreed in this session. Implementation recommendations are identified separately from agreed behaviour.

## Agreed decisions

| Area | Decision |
| --- | --- |
| Audience | An adult managing their own medicines. |
| POC scope | Balance functionality against ease of use; use one usual daily routine. |
| Routine questions | Two screens: waking and sleeping times, followed by meal times. Support indicating a skipped meal. |
| Questionnaire | Drive routine questions from a FHIR Questionnaire behind the scenes. |
| Medicine selection | Show a checkbox beside each medicine. All medicines start unchecked. |
| Recorded instructions | Show dose, frequency and instructions as read-only. |
| Extra medicines | Provide a separate “Add anything missing” screen after medicine selection. |
| Extra-medicine fields | Name, strength, dose, frequency and any instructions. Include medicines and supplements. |
| Schedule adjustments | Change the routine, then create and review a new proposal. |
| Schedule use | Patients can save and use their schedule without pharmacist review. |
| Reminders | One on/off setting for all medicines in the schedule, defaulted to ON. |
| Pharmacist review | Optional after schedule creation, accessed from the saved schedule. It does not prevent use of the schedule. |
| Review request in the POC | Show a confirmation clearly labelled as a demo request. |
| Languages | English, Polish and Urdu. English is the default. Include right-to-left support for Urdu. |

## First-time journey

**Prescriptions → Introduction → Routine → Select medicines → Add anything missing → Check answers → Proposed schedule → Save → Reminder preferences**

The saved schedule also offers the optional pharmacist-review request.

### 1. Entry and introduction

The patient enters through **Prescriptions → Schedule my medicines**.

Explain that the feature helps organise medicines around their usual day, and that they will need to check their medicine list and provide any missing medicines or supplements. Use **Get started** to begin.

Make language selection available from this first screen and throughout the journey. Keep technical details such as FHIR out of the patient-facing explanation.

### 2. Routine: waking and sleeping

Screen title: **Your waking and sleeping times**.

- “What time do you usually wake up?”
- “What time do you usually go to sleep?”

Explain that these times help fit the schedule around the patient's day. Use **Continue** to proceed and provide a Back link.

### 3. Routine: meals

Screen title: **Your meal times**.

- “What time do you usually have breakfast?”
- “What time do you usually have lunch?”
- “What time do you usually have your evening meal?”

For each meal, provide **I do not usually eat this meal**. Do not require a time for a skipped meal. Use **Continue** to proceed.

These screens describe one usual day. Different weekday patterns, multiple routine templates and shift-work scheduling are outside the initial POC.

### 4. Select medicines

Show medicines supplied from the patient record. Each entry contains:

- A checkbox, initially unchecked.
- Medicine name and strength, where supplied.
- Dose, frequency and prescribed instructions, shown read-only.

Checking a medicine includes it in the schedule. Leaving it unchecked excludes it from this schedule; it does not change the patient's record or represent an instruction to stop taking it.

The POC does not require a separate “correct / incorrect / unsure” response for each medicine. The agreed interaction is inclusion by checkbox.

### 5. Add anything missing

Provide a separate screen for medicines or supplements absent from the displayed record, including items bought without a prescription.

Use a short form containing:

| Field | Purpose |
| --- | --- |
| Name | Search for and select the medicine or supplement using suggestions shown as the patient types. |
| Strength | Capture the supplied strength and unit. |
| Dose | Capture how much the patient takes at a time. |
| Frequency | Capture how often the patient takes it. |
| Instructions | Capture any additional instructions, including those supplied by a pharmacist or prescriber. |

#### Search and medicine identity

- Suggest medicines as the patient types, supporting partial names, spelling mistakes and available generic/brand aliases. Require explicit selection and show strength and formulation to distinguish results.
- Use a small, replaceable POC catalogue, initially including medicines from the example screens. Do not infer the patient's dose or instructions from a search result.
- Store stable, language-independent identifiers with ingredient, strength and formulation details. Support later mapping to the interaction database using its provider and medicine identifiers; local identifiers are not verified mappings.
- If there is no match, allow manual entry marked as unlinked. Handling unlinked medicines during scheduling is follow-on work.

Distinguish patient-added information from information supplied by the record. Adding an item for the schedule does not imply a write to the clinical record.

Recommended POC behaviour: allow multiple additions, allow the patient to edit or remove their additions, and provide a clear route to continue when there is nothing to add. The precise frequency choices and validation rules remain implementation details to define alongside supported scheduling cases.

### 6. Check answers

Show the routine, selected record medicines and additional medicines before creating a proposal. Provide Change links back to the relevant sections and preserve entered answers.

Use **Create my schedule** as the action at this stage. Changing answers should return the patient to the review page without requiring them to repeat unchanged sections.

### 7. Proposed schedule

Show a chronological schedule with the time, medicine, dose and relevant instructions for each entry. Clearly identify it as a proposal until saved.

Provide:

- **Save my schedule** to confirm the proposal.
- **Change my routine** to revise routine answers and create a new proposal.

Do not provide direct editing of individual medicine times in this POC. Recorded doses, frequencies and instructions remain read-only.

Schedule generation and the handling of inputs that cannot produce a valid proposal are follow-on design work. Optional pharmacist review must not be treated as the mechanism that makes an otherwise unresolved scheduling case valid.

### 8. Save and set reminder preferences

Confirm that the schedule has been saved and can be used immediately. Pharmacist approval is not a prerequisite.

Offer one **Medicine reminders** switch, defaulted to **ON**, covering all medicines included in the schedule. Patients can switch it OFF. Per-medicine reminder settings are outside this POC.

Treat the preference and notification permission as separate states. If the preference remains ON, request permission where required. Show whether reminders are enabled, turned off, or awaiting permission; do not claim notifications are active solely because the switch defaults to ON.

Actual notification delivery is not specified by this design session. If the POC simulates delivery or permission, make that clear rather than claiming a working reminder service.

## Saved schedule and returning users

Returning users enter **Prescriptions → Schedule my medicines** and open their saved schedule directly.

From there, they can view dose details, change their routine or medicine selections, manage the single reminder preference, and request a pharmacist review.

Changes lead through reviewing the inputs, creating a new proposal and confirming the updated schedule. Recommended behaviour: keep the saved schedule distinct from any proposal until the replacement is explicitly saved.

### Optional pharmacist review

Offer **Request a pharmacist review** from the saved schedule.

For the POC, selecting it shows a confirmation clearly labelled as a **demo request**. Do not add an optional-note form or imply that a request has actually reached a pharmacist. The patient can continue using the saved schedule after making the demo request.

This session explicitly chose no mandatory pharmacist review for the POC. The pharmacist-reviewed approach suggested in [medication-planner-research.md](medication-planner-research.md) is not the agreed POC journey.

## FHIR-driven routine questionnaire

The agreed requirement is that the routine questions come from a **FHIR Questionnaire**, rather than being independently hard-coded into each screen. The patient still sees familiar NHS form controls.

Recommended implementation:

1. Start with a versioned FHIR R4 Questionnaire; confirm the required FHIR version when real integrations are defined.
2. Use two questionnaire groups mapped by the renderer to the two agreed routine screens.
3. Define question text, hints, answer types, required fields and conditional enablement in the questionnaire, using standard extensions where needed.
4. Capture answers in a QuestionnaireResponse referencing the exact Questionnaire version.
5. Use stable `linkId` values and coded or typed answers so language changes do not change answer identity or meaning.

| Group | Suggested items | Answer representation |
| --- | --- | --- |
| Waking and sleeping | Waking time; sleeping time | FHIR `time` questions and `valueTime` answers. |
| Meals | Whether each meal is usually eaten; the corresponding usual time | Boolean answers and conditional time questions. |

Map the meal controls to explicit structured answers. A skipped meal is distinct from a meal whose time has not yet been entered. Apply FHIR conditional enablement to the corresponding time question and exclude stale time answers when the meal is changed to skipped.

For the POC, the Questionnaire can be packaged as a static JSON resource with the UI. A FHIR server is not required merely to render the form or produce a QuestionnaireResponse. This is a small renderer for the agreed question types, rather than a commitment to implementing every FHIR Questionnaire feature.

Recommended form behaviour is to leave initial times blank, preserve answers on Back, and provide inline errors and an error summary. Detailed cross-field validation, including routines crossing midnight, should be defined with the scheduling work.

## Internationalisation and language selection

### Available languages

| Language | Selector label | Direction |
| --- | --- | --- |
| English | English | Left to right |
| Polish | Polski | Left to right |
| Urdu | اردو | Right to left |

English is the default. Show language names in their own language, without flags. Keep the control available from the introduction and throughout the journey.

Switching language must preserve the current screen, questionnaire answers, medicine selections, patient-added information and any saved schedule. Remember the preference on the device. Remembering a language preference does not imply storing clinical answers on the device.

### Translation coverage

Translate interface headings, question text, hints, options, navigation, buttons, validation messages, check-answer labels, confirmations and app-authored schedule explanations.

Keep recorded medicine names and instructions in their supplied wording and clearly identify untranslated content. Keep patient-entered free text as entered. Switching language does not automatically translate or alter clinical instructions.

Use prepared translations for the POC. Live machine translation of medicine instructions is outside this scope.

### Translation model

Recommended implementation:

- Keep question translations with the Questionnaire using the standard FHIR translation extension, including translated options and supporting text where applicable.
- Keep other interface text in a translation catalogue.
- Keep question identifiers, answer codes and stored time values independent of display language.
- Use locale-aware time presentation while retaining structured time values.
- Set the document language and direction appropriately, and isolate mixed-direction content such as Latin medicine names and numbers within Urdu text.
- If translated copy is missing, show an explicit English fallback rather than a blank label or internal translation key.

Language support must be checked across the whole journey, including the review page and confirmations. Urdu requires layout and mixed-direction testing as well as translated strings.

## NHS App design and accessibility

Follow the NHS App design system and NHS digital service manual. Match the host navigation appropriate to the integration context; the example prototype shell is a visual reference, not a decision to reproduce native navigation inside every web screen.

Use accessible checkbox, input, button and link components with clear labels. Preserve keyboard navigation and focus when moving between screens or changing language. Do not rely solely on icons or colour to explain medicine inclusion, errors, saved status or reminder state.

Use Back and Continue through questions, **Create my schedule** on the input review, and **Save my schedule** on the proposal. These actions should communicate the actual stage of the journey.

## POC architecture and follow-on scope

The deployment direction remains a **static UI and an API backend**, using AWS CloudFront, API Gateway and Lambdas. Questionnaire definitions and translation resources can be static assets. Any new infrastructure requires approval under the repository instructions.

This document does not introduce a FHIR server, notification service or pharmacist-review service.

The follow-on session will address:

- Patient-record integration, medicine data coverage and provenance.
- Medicine interaction and administration-rule sources.
- Supported frequencies, regimen types and missing or ambiguous instructions.
- Generating and validating schedules against routine and medicine requirements.
- Conflicts, unsupported cases and situations where no schedule can be produced.
- Time zones, daylight-saving changes and overnight timing constraints.
- API contracts and persistence for inputs, responses and saved schedules.
- Any real notification delivery or pharmacist-review workflow.

## Suggested POC walkthrough checks

- Complete the journey with record medicines selected deliberately from an initially unchecked list.
- Add an extra medicine, review the inputs and save a proposal.
- Skip a meal without being required to enter its time.
- Change the routine and review a replacement proposal before saving it.
- Switch between English, Polish and Urdu mid-journey without losing answers or selections.
- Check Urdu layout, medicine names, numbers and time presentation together.
- Confirm the reminder switch defaults to ON and accurately represents permission state.
- Request a demo pharmacist review and return to the usable saved schedule.
- Reopen the feature as a returning user and reach the saved schedule directly.

## References

- [Original app overview](app_overview.md).
- [Example screen implementation](../figma-make-concept/src/App.tsx).
- [Existing clinical and regulatory research](medication-planner-research.md); its recommendations are separate from the agreed POC decisions above.
- [NHS App design system](https://design-system.nhsapp.service.nhs.uk/).
- [NHS question-page guidance](https://service-manual.nhs.uk/design-system/patterns/question-pages).
- [NHS check-answers pattern](https://service-manual.nhs.uk/design-system/patterns/check-answers).
- [FHIR R4 Questionnaire](https://hl7.org/fhir/R4/questionnaire.html).
- [FHIR R4 QuestionnaireResponse](https://hl7.org/fhir/R4/questionnaireresponse.html).
- [FHIR R4 multilingual support](https://hl7.org/fhir/R4/languages.html).
