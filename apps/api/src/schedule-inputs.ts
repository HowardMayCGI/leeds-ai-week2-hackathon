import type { AdministrationDataset, Medication, MedicationsResponse, ScheduleInputMedicine, ScheduleInputsResponse } from '@hackathon/api-contract';
import data from './data/demo-administration.json';
import { checkInteractions, interactionDataset } from './interactions';

export const administrationDataset = data as AdministrationDataset;
const products = new Map(interactionDataset.products.map(product => [`${product.system}|${product.code}`, product]));
const knownWhen = new Set(['ACM', 'ACD', 'ACV', 'C', 'CM', 'CD', 'CV', 'MORN', 'EVE', 'HS', 'WAKE']);
const clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/;
// Exact coded instructions present in the synthetic data; no free-text inference.
const intervalMinutes: Record<string, number> = { '225757006': 240, '307468000': 360, '225756002': 240, '1831000175103': 720, '396143001': 4320 };
const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

function medicineInputs(medication: Medication): ScheduleInputMedicine {
  const dosages = medication.dosageInstructions ?? [];
  const dosage = dosages[0] ?? {};
  const timing = object(dosage.timing);
  const repeat = object(timing.repeat);
  // The legacy medication response supplies display defaults for missing period/unit.
  // A scheduler must instead require explicit prescription values.
  const frequency = typeof repeat.frequency === 'number' && typeof repeat.period === 'number' && typeof repeat.periodUnit === 'string'
    ? { frequency: repeat.frequency, period: repeat.period, periodUnit: repeat.periodUnit } : undefined;
  const rules = administrationDataset.rules.filter(rule => rule.system === medication.system && rule.productCodes.includes(medication.code ?? ''));
  const result: ScheduleInputMedicine = {
    medication,
    use: dosage.asNeededBoolean === true ? 'as_needed' : dosage.asNeededBoolean === false ? 'regular' : 'unconfirmed',
    prescriptionTiming: {
      frequency,
      timeOfDay: array(repeat.timeOfDay).filter((value): value is string => typeof value === 'string'),
      when: array(repeat.when).filter((value): value is string => typeof value === 'string'),
      requiresAnchor: false,
    },
    administration: {
      coverage: rules.length ? 'demo_rule' : 'not_defined',
      ruleIds: rules.map(rule => rule.id),
      constraints: rules.flatMap(rule => rule.constraints),
      instructions: rules.flatMap(rule => rule.instructions),
      sourceIds: [...new Set(rules.flatMap(rule => rule.sourceIds))],
    },
    issues: [],
  };
  const issue = (code: string, message: string, resolution: 'confirm_prescription' | 'professional_review' = 'confirm_prescription') => {
    if (!result.issues.some(existing => existing.code === code)) result.issues.push({ code, message, resolution });
  };
  if (!rules.length) issue('administration_not_defined', 'No administration rule is defined for this product in the demo. Confirm food, timing and special instructions.');
  if (dosages.length !== 1) issue('dosage_steps_unresolved', 'Confirm the complete prescription: dosage instructions are missing or contain multiple steps.', dosages.length > 1 ? 'professional_review' : 'confirm_prescription');
  if (!positive(medication.dose?.value)) issue('dose_missing_or_invalid', 'Confirm the amount to take per dose; never infer it from the product strength.');
  if (!medication.dose?.unit?.trim()) issue('dose_unit_missing', 'Confirm the dose unit, such as tablets, millilitres or units.');
  if (result.use === 'unconfirmed') issue('regular_or_prn_unconfirmed', 'Confirm whether this medicine is regular or only taken when needed.');
  if (result.use === 'as_needed') issue('prn_limits_unconfirmed', 'Keep this medicine out of the regular timetable. Confirm minimum intervals and maximum doses separately.');
  const validFrequency = frequency && Number.isInteger(frequency.frequency) && positive(frequency.frequency) && positive(frequency.period) && ['s', 'min', 'h', 'd', 'wk', 'mo', 'a'].includes(frequency.periodUnit);
  if (result.use !== 'as_needed' && !validFrequency) issue('frequency_missing_or_invalid', 'Confirm how often the medicine is prescribed; no default frequency is assumed.');
  if (frequency && validFrequency && (frequency.periodUnit !== 'd' || frequency.period !== 1)) {
    result.prescriptionTiming.requiresAnchor = true;
    issue('interval_anchor_required', 'Confirm the first or last dose date and time for this interval. Do not assume a dose is due today.');
  }
  const prescribedGaps: number[] = [];
  if (frequency && validFrequency && frequency.frequency === 1 && ['s', 'min', 'h'].includes(frequency.periodUnit)) {
    const multiplier = frequency.periodUnit === 'h' ? 60 : frequency.periodUnit === 's' ? 1 / 60 : 1;
    prescribedGaps.push(frequency.period * multiplier);
  }
  for (const instruction of array(dosage.additionalInstruction)) {
    const codes = array(object(instruction).coding);
    const known = codes.map(object).find(coding => coding.system === 'http://snomed.info/sct' && typeof coding.code === 'string' && intervalMinutes[coding.code]);
    if (known) prescribedGaps.push(intervalMinutes[known.code as string]);
  }
  if (prescribedGaps.length) result.prescriptionTiming.minimumDoseIntervalMinutes = Math.max(...prescribedGaps);
  if (dosage.text || dosage.patientInstruction || medication.instructions.length) {
    issue('instruction_text_requires_confirmation', 'Check the original wording against the structured fields and demo rules. Text is preserved, not automatically interpreted.');
  }
  const allowedDosage = new Set(['sequence', 'asNeededBoolean', 'additionalInstruction', 'timing', 'doseQuantity', 'doseAndRate', 'text', 'patientInstruction', 'route']);
  const allowedRepeat = new Set(['frequency', 'period', 'periodUnit', 'timeOfDay', 'when']);
  const doseAndRate = array(dosage.doseAndRate);
  if (Object.keys(dosage).some(key => !allowedDosage.has(key)) || Object.keys(repeat).some(key => !allowedRepeat.has(key)) || Object.keys(timing).some(key => key !== 'repeat') || doseAndRate.length > 1 || doseAndRate.some(value => Object.keys(object(value)).some(key => !['type', 'doseQuantity'].includes(key)))) {
    issue('unsupported_regimen', 'This prescription contains fields the demo cannot normalise, such as ranges, bounds, events, rates or multiple dose steps. Review the original instructions.', 'professional_review');
  }
  if ((repeat.timeOfDay !== undefined && !Array.isArray(repeat.timeOfDay)) || (repeat.when !== undefined && !Array.isArray(repeat.when)) || result.prescriptionTiming.timeOfDay.some(time => !clockTime.test(time)) || result.prescriptionTiming.when.some(code => !knownWhen.has(code)) || array(repeat.timeOfDay).length !== result.prescriptionTiming.timeOfDay.length || array(repeat.when).length !== result.prescriptionTiming.when.length) {
    issue('unsupported_timing', 'A prescribed time or timing code is unsupported or invalid.', 'professional_review');
  }
  if (frequency && validFrequency && frequency.periodUnit === 'd' && frequency.period === 1) {
    const times = result.prescriptionTiming.timeOfDay;
    if (times.length && (times.length !== frequency.frequency || new Set(times).size !== times.length)) issue('conflicting_timing', 'Fixed dose times do not agree with the prescribed daily frequency.', 'professional_review');
    if (result.prescriptionTiming.minimumDoseIntervalMinutes && frequency.frequency * result.prescriptionTiming.minimumDoseIntervalMinutes > 1440) issue('conflicting_interval', 'The prescribed frequency and minimum dose interval do not fit a repeating day.', 'professional_review');
  }
  return result;
}

/** Data for the frontend to combine with confirmed selections and a routine; never changes a prescription. */
export function buildScheduleInputs(record: MedicationsResponse): ScheduleInputsResponse {
  const medicines = record.medications.map(medicineInputs);
  const interactions = checkInteractions(record);
  const administrationSeparations: ScheduleInputsResponse['administrationSeparations'] = [];
  for (const medicine of medicines) {
    for (const rule of administrationDataset.rules.filter(rule => medicine.administration.ruleIds.includes(rule.id))) {
      for (const constraint of rule.constraints) {
        if (constraint.type !== 'before_other_oral_medicines') continue;
        for (const other of medicines) {
          if (other.medication.id === medicine.medication.id) continue;
          const product = products.get(`${other.medication.system}|${other.medication.code}`);
          if (product?.route === 'oral') administrationSeparations.push({
            medicationId: medicine.medication.id, beforeMedicationId: other.medication.id,
            minimumGapMinutes: constraint.minimumGapMinutes, ruleId: rule.id, appliesAcrossMidnight: true,
          });
        }
      }
    }
  }
  // Two "take before other oral medicines" rules can conflict. Never pick an order silently.
  for (const separation of administrationSeparations) {
    if (!administrationSeparations.some(other => other.medicationId === separation.beforeMedicationId && other.beforeMedicationId === separation.medicationId)) continue;
    const medicine = medicines.find(item => item.medication.id === separation.medicationId)!;
    if (!medicine.issues.some(issue => issue.code === 'administration_order_conflict')) medicine.issues.push({
      code: 'administration_order_conflict', resolution: 'professional_review',
      message: 'Two medicines have competing administration-order requirements. Ask a pharmacist to confirm an appropriate sequence before scheduling.',
    });
  }
  const ids = new Set(medicines.flatMap(medicine => medicine.administration.sourceIds));
  return {
    nhsNumber: record.nhsNumber, demoOnly: true, clinicallyValidated: false,
    versions: { administration: administrationDataset.version, interactions: interactions.datasetVersion },
    notice: 'Demonstration data only, not for clinical use. Confirm current medicines and original prescription instructions. Missing rules do not mean no restrictions. Do not automatically change doses, resolve conflicting instructions or schedule PRN medicines as regular doses.',
    medicines, interactions,
    sources: [...administrationDataset.sources.filter(source => ids.has(source.id)), ...interactions.sources],
    administrationSeparations,
    readiness: {
      status: interactions.scheduling.status === 'review_required' || medicines.some(medicine => medicine.issues.some(issue => issue.resolution === 'professional_review')) ? 'review_required' : 'confirmation_required',
      requiresCurrentMedicineConfirmation: true, requiresRoutine: true,
      routineFields: ['wake', 'sleep', 'meals.breakfast', 'meals.lunch', 'meals.dinner'],
      requiresSpecialInstructionAcknowledgement: medicines.some(medicine => medicine.administration.instructions.length > 0),
      medicinesWithIssues: medicines.filter(medicine => medicine.issues.length).map(medicine => medicine.medication.id),
    },
  };
}
