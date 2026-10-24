import { findProduct, formatStrength, ingredientCodes } from './catalogue';
import type { Dose } from './dose';
import type { RecordMedicine } from './record';
import { ADMINISTRATION_RULES, DEFAULT_MIN_INTERVAL_HOURS, type TimingWhen } from './rules';
import { MEALS, type Day, type Meal } from './routine';

export const FREQUENCIES = ['once-daily', 'twice-daily', 'three-times-daily', 'four-times-daily', 'as-needed'] as const;
export type Frequency = (typeof FREQUENCIES)[number];
const DOSES_PER_DAY: Record<Exclude<Frequency, 'as-needed'>, number> = { 'once-daily': 1, 'twice-daily': 2, 'three-times-daily': 3, 'four-times-daily': 4 };

/** A medicine or supplement the patient added. It is never written to the clinical record. */
export interface PatientAddition {
  id: string;
  /** Set when the patient chose a catalogue match; absent for an unlinked manual entry. */
  productId?: string;
  name: string;
  /** Size of one tablet, capsule or measure. From the product when matched, otherwise as entered. */
  strength: string;
  dose: Dose;
  frequency: Frequency;
  instructions?: string;
}

/** What the schedule shows about each included item, kept with the proposal and saved schedule. */
export interface ItemSnapshot {
  key: string;
  source: 'record' | 'patient';
  name: string;
  strength?: string;
  dose: Dose;
  /** Record wording, shown as supplied. */
  frequencyText?: string;
  /** Patient additions use a coded frequency so it can be shown in any language. */
  frequency?: Frequency;
  instructionText?: string;
  /** Language of record-supplied text. */
  language?: string;
  productId?: string;
  /** False for a patient addition we could not match, so no food or interaction rules were applied. */
  matched: boolean;
}

export interface Constraint {
  key: string;
  doses: number;
  /** Earliest and latest permitted minutes, within the waking day. */
  window: [number, number];
  food: 'any' | 'with-food' | 'empty-stomach';
  /** Meals a with-food dose may be taken with. */
  meals: Meal[];
  emptyStomach: { beforeMinutes: number; afterMinutes: number };
  minIntervalMinutes: number;
  separations: { key: string; hours: number }[];
  /** A `when` code that refers to a meal the patient does not eat. */
  missingMeal?: Meal;
}

export function recordSnapshot(medicine: RecordMedicine): ItemSnapshot {
  return {
    key: `record:${medicine.id}`, source: 'record', name: medicine.name, strength: medicine.strength,
    dose: medicine.dose, frequencyText: medicine.frequencyText, instructionText: medicine.instructionText,
    language: medicine.language, productId: medicine.productId, matched: true,
  };
}

export function additionSnapshot(addition: PatientAddition): ItemSnapshot {
  const product = findProduct(addition.productId);
  return {
    key: `patient:${addition.id}`, source: 'patient', name: addition.name,
    strength: product ? formatStrength(product) || undefined : addition.strength || undefined,
    dose: addition.dose, frequency: addition.frequency, instructionText: addition.instructions || undefined,
    productId: product?.id, matched: Boolean(product),
  };
}

interface Timed { snapshot: ItemSnapshot; doses: number; when: TimingWhen[] }

/**
 * Splits included items into those given set times and those taken only when
 * needed. Every daily item gets times. An unmatched addition has no rules to
 * look up, so it is timed by its frequency alone.
 */
export function classify(record: RecordMedicine[], selectedIds: string[], additions: PatientAddition[]) {
  const items: ItemSnapshot[] = [];
  const timed: Timed[] = [];
  const whenNeeded: string[] = [];
  for (const medicine of record) {
    if (!selectedIds.includes(medicine.id)) continue;
    const snapshot = recordSnapshot(medicine);
    items.push(snapshot);
    if (medicine.dosage.asNeeded) whenNeeded.push(snapshot.key);
    else timed.push({ snapshot, doses: medicine.dosage.timesPerDay, when: medicine.dosage.when ?? [] });
  }
  for (const addition of additions) {
    const snapshot = additionSnapshot(addition);
    items.push(snapshot);
    if (addition.frequency === 'as-needed') whenNeeded.push(snapshot.key);
    else timed.push({ snapshot, doses: DOSES_PER_DAY[addition.frequency], when: [] });
  }
  return { items, timed, whenNeeded };
}

const MEAL_FOR: Partial<Record<TimingWhen, Meal>> = { ACM: 'breakfast', ACD: 'lunch', ACV: 'dinner', CM: 'breakfast', CD: 'lunch', CV: 'dinner' };

export function buildConstraints(timed: Timed[], day: Day): Constraint[] {
  const ingredientsByKey = new Map(timed.map(({ snapshot }) => {
    const product = findProduct(snapshot.productId);
    return [snapshot.key, product ? ingredientCodes(product) : []];
  }));
  return timed.map(({ snapshot, doses, when }) => {
    const ingredients = ingredientsByKey.get(snapshot.key)!;
    const rules = ingredients.map(code => ADMINISTRATION_RULES[code]).filter(Boolean);
    const constraint: Constraint = {
      key: snapshot.key,
      doses,
      window: [day.wake, day.sleep],
      food: rules.some(rule => rule.food === 'empty-stomach') ? 'empty-stomach' : rules.some(rule => rule.food === 'with-food') ? 'with-food' : 'any',
      meals: MEALS.filter(meal => day.meals[meal] !== undefined),
      emptyStomach: rules.find(rule => rule.emptyStomach)?.emptyStomach ?? { beforeMinutes: 30, afterMinutes: 120 },
      minIntervalMinutes: (DEFAULT_MIN_INTERVAL_HOURS[doses] ?? 0) * 60,
      separations: [],
    };

    const narrow = (from: number, to: number) => {
      constraint.window = [Math.max(constraint.window[0], from), Math.min(constraint.window[1], to)];
    };
    const withMeals: Meal[] = [];
    for (const code of when) {
      const meal = MEAL_FOR[code];
      if (code === 'C') constraint.food = constraint.food === 'empty-stomach' ? 'empty-stomach' : 'with-food';
      else if (code === 'MORN') narrow(day.wake, day.wake + 240);
      else if (code === 'WAKE') narrow(day.wake, day.wake + 30);
      else if (code === 'EVE') narrow(day.sleep - 360, day.sleep);
      else if (code === 'HS') narrow(day.sleep - 60, day.sleep);
      else if (meal && code.startsWith('AC')) {
        constraint.food = 'empty-stomach';
        const time = day.meals[meal];
        // With no such meal, keep the empty-stomach rule in the morning.
        if (time === undefined) narrow(day.wake, day.wake + 180);
        else narrow(time - 60, time - constraint.emptyStomach.beforeMinutes);
      } else if (meal) {
        constraint.food = 'with-food';
        withMeals.push(meal);
      }
    }
    if (withMeals.length) {
      constraint.missingMeal = withMeals.find(meal => day.meals[meal] === undefined);
      constraint.meals = constraint.meals.filter(meal => withMeals.includes(meal));
    }

    // Separation rules apply in either direction, so collect both sides.
    for (const other of timed) {
      if (other.snapshot.key === snapshot.key) continue;
      const otherIngredients = ingredientsByKey.get(other.snapshot.key)!;
      let hours = 0;
      for (const [mine, theirs] of [[ingredients, otherIngredients], [otherIngredients, ingredients]]) {
        for (const code of mine) {
          for (const rule of ADMINISTRATION_RULES[code]?.separateFrom ?? []) {
            if (theirs.some(ingredient => rule.ingredients.includes(ingredient))) hours = Math.max(hours, rule.hours);
          }
        }
      }
      if (hours) constraint.separations.push({ key: other.snapshot.key, hours });
    }
    return constraint;
  });
}
