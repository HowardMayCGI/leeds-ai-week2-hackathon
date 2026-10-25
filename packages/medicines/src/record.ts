import { toMedicineOption, type MedicineOption, type SourceMedicine } from './catalogue';
import { toDoseUnit, unitForForm, type Dose } from './dose';

/** How often the record says to take a medicine, read from FHIR `Timing.repeat`. */
export type RecordFrequency =
  | { kind: 'daily'; timesPerDay: number }
  | { kind: 'as-needed' }
  | { kind: 'every-days'; days: number }
  | { kind: 'missing' };

/**
 * A current medicine from the patient's record. Instructions keep the record's
 * own wording and language; they are shown read-only and never translated.
 */
export interface RecordMedicine {
  id: string;
  medicine: MedicineOption;
  /** Missing when the record has no structured dose. */
  dose?: Dose;
  frequency: RecordFrequency;
  instructions: string[];
  language: string;
  prescribedOn?: string;
}

/** A current medicine as the patient data API returns it. */
export interface SourceMedication extends SourceMedicine {
  id: string;
  dose?: { value: number; unit?: string };
  frequency?: { frequency: number; period: number; periodUnit: string };
  asNeeded: boolean;
  instructions: string[];
  prescribedOn?: string;
}

const HOURS_PER_UNIT: Record<string, number> = { h: 1, d: 24, wk: 24 * 7 };

export function recordFrequency(source: SourceMedication): RecordFrequency {
  if (source.asNeeded) return { kind: 'as-needed' };
  const repeat = source.frequency;
  const unitHours = repeat && HOURS_PER_UNIT[repeat.periodUnit];
  if (!repeat || !unitHours || repeat.frequency < 1 || repeat.period <= 0) return { kind: 'missing' };
  const hoursApart = (repeat.period * unitHours) / repeat.frequency;
  // "Every 4 hours" is given up to 4 times across the waking day, as for "4 times a day".
  if (repeat.periodUnit === 'h') return { kind: 'daily', timesPerDay: Math.max(1, Math.min(4, Math.floor(24 / hoursApart))) };
  if (hoursApart > 24 && repeat.frequency === 1) return { kind: 'every-days', days: hoursApart / 24 };
  const timesPerDay = (24 / hoursApart);
  return Number.isInteger(timesPerDay) && timesPerDay >= 1 && timesPerDay <= 4 ? { kind: 'daily', timesPerDay } : { kind: 'missing' };
}

// SNOMED CT display names end in a semantic tag, such as "Every six hours (qualifier value)".
const SEMANTIC_TAG = /\s*\((qualifier value|finding|procedure|regime\/therapy)\)$/i;

export function toRecordMedicine(source: SourceMedication): RecordMedicine {
  const medicine = toMedicineOption(source);
  const unit = toDoseUnit(source.dose?.unit) ?? unitForForm(medicine.form);
  return {
    id: source.id,
    medicine,
    dose: source.dose && source.dose.value > 0 ? { quantity: source.dose.value, unit } : undefined,
    frequency: recordFrequency(source),
    instructions: source.instructions.map(text => text.replace(SEMANTIC_TAG, '')),
    language: 'en',
    prescribedOn: source.prescribedOn,
  };
}
