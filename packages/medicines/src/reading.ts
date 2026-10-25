import { parseMedicineName, searchMedicines, type Form, type MedicineOption } from './catalogue';
import { unitForForm, type DoseUnit } from './dose';
import type { Frequency } from './items';
import type { FoodTiming } from './rules';

/**
 * Turns a medicine read by AI from a photo or description into answers for
 * the "Add a medicine" form. Nothing is added until the patient has checked
 * each answer and pressed Add, and every rule and check still applies.
 */

/** A medicine as read from a label or description; see MedicineReading in the API contract. */
export interface ReadMedicine {
  found: boolean;
  name?: string;
  brand?: string;
  strength?: string;
  form?: string;
  amount?: number;
  amountMax?: number;
  timesPerDay?: number;
  asNeeded?: boolean;
  lessThanDaily?: boolean;
  timing?: 'before-food' | 'with-food';
  instructions?: string;
}

export type ReadingField = 'name' | 'strength' | 'amount' | 'frequency' | 'timing';

export interface FormAnswers {
  /** One medicine from the list that matches the name, strength and form read. */
  medicine?: MedicineOption;
  /** Text for the medicine search when more than one product could match, such as two strengths. */
  query?: string;
  /** For a medicine not in the list: the name and strength as read, for manual entry. */
  manual?: { name: string; strength: string; unit?: DoseUnit };
  quantity?: number;
  frequency?: Frequency;
  timing?: FoodTiming;
  instructions?: string;
  /** What could not be read, for the patient to fill in. */
  missing: ReadingField[];
}

const FREQUENCY_FOR: Record<number, Frequency> = { 1: 'once-daily', 2: 'twice-daily', 3: 'three-times-daily', 4: 'four-times-daily' };
const LIST_FORMS: Record<string, Form | undefined> = {
  tablet: 'tablet', capsule: 'capsule', 'oral-liquid': 'oral-liquid', inhaler: 'inhaler', spray: 'spray', patch: 'patch', injection: 'injection',
};

/** Numbers in a strength such as "1,000 units" or "200mg". */
function strengthNumbers(strength: string | undefined): number[] {
  return [...(strength ?? '').replace(/(\d),(?=\d{3}\b)/g, '$1').matchAll(/\d+(?:[.,]\d+)?/g)].map(match => Number(match[0].replace(',', '.')));
}

export function answersFromReading(reading: ReadMedicine, options: MedicineOption[]): FormAnswers {
  const missing: ReadingField[] = [];
  const answers: FormAnswers = { missing };
  const name = reading.name ?? reading.brand;
  if (!reading.found || !name) return { missing: ['name', 'strength', 'amount', 'frequency', 'timing'] };

  // Search by name alone, then keep products whose strength and form agree with what was read.
  const numbers = strengthNumbers(reading.strength);
  const form = reading.form ? LIST_FORMS[reading.form] : undefined;
  const candidates = [reading.name, reading.brand]
    .filter((text): text is string => Boolean(text))
    .flatMap(text => searchMedicines(options, text, 20))
    .filter(result => result.score >= 3)
    .map(result => result.option)
    .filter((option, index, all) => all.findIndex(other => other.id === option.id) === index)
    .filter(option => !form || option.form === form);
  const sameStrength = numbers.length
    ? candidates.filter(option => {
      const values = parseMedicineName(option.recordName).strengthValues;
      return values.length === numbers.length && numbers.every(number => values.includes(number));
    })
    : [];
  if (sameStrength.length === 1) answers.medicine = sameStrength[0];
  // With no strength read, or several matching products, the patient chooses from the list.
  else if (candidates.length && (!numbers.length || sameStrength.length > 1)) answers.query = reading.name ?? name;
  // A strength the list does not have is entered as read, rather than matched to a different product.
  else {
    const unit = reading.form && LIST_FORMS[reading.form] ? unitForForm(LIST_FORMS[reading.form]!) : undefined;
    answers.manual = { name: reading.brand && reading.name ? `${reading.name} (${reading.brand})` : name, strength: reading.strength ?? '', unit };
  }
  if (!reading.strength && !answers.medicine) missing.push('strength');

  // The form takes one amount, so "1 or 2 tablets" is left for the patient to answer.
  if (reading.amount !== undefined && reading.amountMax === undefined) answers.quantity = reading.amount;
  else missing.push('amount');

  if (reading.asNeeded) answers.frequency = 'as-needed';
  else if (reading.lessThanDaily) answers.frequency = 'not-daily';
  else if (reading.timesPerDay && FREQUENCY_FOR[reading.timesPerDay]) answers.frequency = FREQUENCY_FOR[reading.timesPerDay];
  else missing.push('frequency');

  if (reading.timing) answers.timing = reading.timing;
  else missing.push('timing');
  if (reading.instructions) answers.instructions = reading.instructions;
  return answers;
}
