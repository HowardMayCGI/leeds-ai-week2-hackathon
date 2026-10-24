import type { Form, MedicineOption } from './catalogue';
import type { Dose } from './dose';
import type { RecordMedicine } from './record';
import { DEFAULT_MIN_INTERVAL_HOURS, rulesFor, timingConflict, type FoodTiming, type MealTiming, type TimingWhen } from './rules';
import { MEALS, type Day, type Meal } from './routine';

export const FREQUENCIES = ['once-daily', 'twice-daily', 'three-times-daily', 'four-times-daily', 'not-daily', 'as-needed'] as const;
export type Frequency = (typeof FREQUENCIES)[number];
type DailyFrequency = Exclude<Frequency, 'as-needed' | 'not-daily'>;
const DOSES_PER_DAY: Record<DailyFrequency, number> = { 'once-daily': 1, 'twice-daily': 2, 'three-times-daily': 3, 'four-times-daily': 4 };
const FREQUENCY_FOR: Record<number, DailyFrequency> = { 1: 'once-daily', 2: 'twice-daily', 3: 'three-times-daily', 4: 'four-times-daily' };

/** A medicine or supplement the patient added. It is never written to the clinical record. */
export interface PatientAddition {
  id: string;
  /** Set when the patient chose a suggestion; absent for a manual entry we could not match. */
  medicine?: MedicineOption;
  name: string;
  /** Size of one tablet, capsule or measure. From the suggestion when matched, otherwise as entered. */
  strength: string;
  dose: Dose;
  frequency: Frequency;
  /** When the patient takes it, relative to food. */
  timing: FoodTiming;
  /** The patient kept a timing that goes against the medicine's instructions. */
  keepOwnTiming?: boolean;
  instructions?: string;
}

/** What the schedule shows about each included item, kept with the proposal and saved schedule. */
export interface ItemSnapshot {
  key: string;
  source: 'record' | 'patient';
  name: string;
  strength?: string;
  form?: Form;
  /** The product description in the record, for a record medicine or a matched addition. */
  recordName?: string;
  dose?: Dose;
  frequency?: Frequency;
  /** For a record medicine taken every few days. */
  everyDays?: number;
  /** Record instructions in the record's language, or the patient's own words. */
  instructions: string[];
  language?: string;
  ingredients: string[];
  /** False for a patient addition we could not match, so no food or interaction rules were applied. */
  matched: boolean;
  /** For an addition: when the patient said they take it. */
  timing?: FoodTiming;
  /** For an addition: the patient kept a timing that goes against the rules. */
  timingFlag?: { chosen: MealTiming; recommended: MealTiming };
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
  separations: Separation[];
  /** A `when` code that refers to a meal the patient does not eat. */
  missingMeal?: Meal;
  /** The rule asks for the evening, shown as a note on the dose. */
  evening?: boolean;
  /** Minutes this must come before any other medicine that is swallowed. */
  beforeOthersMinutes?: number;
}

/** Doses kept apart from another item's doses: either way round, or with this item before or after it. */
export interface Separation {
  key: string;
  hours: number;
  order?: 'before' | 'after';
}

const SWALLOWED: Form[] = ['tablet', 'capsule', 'oral-liquid'];
// An item typed in without a medicine option has no form, so it is treated as swallowed.
const swallowed = (item: ItemSnapshot) => !item.form || SWALLOWED.includes(item.form);

export function recordSnapshot(medicine: RecordMedicine): ItemSnapshot {
  const { frequency } = medicine;
  return {
    key: `record:${medicine.id}`, source: 'record', name: medicine.medicine.name, strength: medicine.medicine.strength,
    form: medicine.medicine.form, recordName: medicine.medicine.recordName,
    dose: medicine.dose,
    frequency: frequency.kind === 'daily' ? FREQUENCY_FOR[frequency.timesPerDay] : frequency.kind === 'as-needed' ? 'as-needed' : frequency.kind === 'every-days' ? 'not-daily' : undefined,
    everyDays: frequency.kind === 'every-days' ? frequency.days : undefined,
    instructions: medicine.instructions, language: medicine.language,
    ingredients: medicine.medicine.ingredients, matched: true,
  };
}

export function additionSnapshot(addition: PatientAddition): ItemSnapshot {
  const medicine = addition.medicine;
  const conflict = medicine && addition.keepOwnTiming ? timingConflict(medicine.ingredients, addition.timing) : undefined;
  return {
    key: `patient:${addition.id}`, source: 'patient', name: medicine?.name ?? addition.name,
    strength: medicine ? medicine.strength : addition.strength || undefined,
    form: medicine?.form, recordName: medicine?.recordName,
    dose: addition.dose, frequency: addition.frequency, instructions: addition.instructions ? [addition.instructions] : [],
    ingredients: medicine?.ingredients ?? [], matched: Boolean(medicine), timing: addition.timing, timingFlag: conflict,
  };
}

interface Timed {
  snapshot: ItemSnapshot;
  doses: number;
  when: TimingWhen[];
  /** The patient's own timing, used when there is no rule or they chose to keep it. */
  patientFood?: Constraint['food'];
  keepOwnTiming?: boolean;
}

const FOOD_FOR: Record<FoodTiming, Constraint['food'] | undefined> = { 'before-food': 'empty-stomach', 'with-food': 'with-food', any: undefined, 'not-sure': undefined };

/**
 * Splits included items into those given set times, those taken only when
 * needed, those taken less often than every day, and record medicines whose
 * record does not say how often to take them, which get no times.
 */
export function classify(record: RecordMedicine[], selectedIds: string[], additions: PatientAddition[]) {
  const items: ItemSnapshot[] = [];
  const timed: Timed[] = [];
  const whenNeeded: string[] = [];
  const notDaily: string[] = [];
  const unscheduled: string[] = [];
  const place = (snapshot: ItemSnapshot, extra: Omit<Timed, 'snapshot' | 'doses' | 'when'> = {}) => {
    if (snapshot.frequency === 'as-needed') whenNeeded.push(snapshot.key);
    else if (snapshot.frequency === 'not-daily') notDaily.push(snapshot.key);
    else if (snapshot.frequency) timed.push({ snapshot, doses: DOSES_PER_DAY[snapshot.frequency], when: [], ...extra });
    else unscheduled.push(snapshot.key);
  };
  for (const medicine of record) {
    if (!selectedIds.includes(medicine.id)) continue;
    const snapshot = recordSnapshot(medicine);
    items.push(snapshot);
    place(snapshot);
  }
  for (const addition of additions) {
    const snapshot = additionSnapshot(addition);
    items.push(snapshot);
    place(snapshot, { patientFood: FOOD_FOR[addition.timing], keepOwnTiming: addition.keepOwnTiming });
  }
  return { items, timed, whenNeeded, notDaily, unscheduled };
}

const MEAL_FOR: Partial<Record<TimingWhen, Meal>> = { ACM: 'breakfast', ACD: 'lunch', ACV: 'dinner', CM: 'breakfast', CD: 'lunch', CV: 'dinner' };

export function buildConstraints(timed: Timed[], day: Day): Constraint[] {
  return timed.map(({ snapshot, doses, when, patientFood, keepOwnTiming }) => {
    const ingredients = snapshot.ingredients;
    const rules = rulesFor(ingredients);
    const ruleFood = rules.some(rule => rule.food === 'empty-stomach') ? 'empty-stomach' : rules.some(rule => rule.food === 'with-food') ? 'with-food' : undefined;
    // The rules decide, unless the patient chose to keep their own timing; with no rule the patient's timing is used.
    const food = (keepOwnTiming ? patientFood ?? ruleFood : ruleFood ?? patientFood) ?? 'any';
    const constraint: Constraint = {
      key: snapshot.key,
      doses,
      window: [day.wake, day.sleep],
      food,
      meals: MEALS.filter(meal => day.meals[meal] !== undefined),
      emptyStomach: rules.find(rule => rule.emptyStomach)?.emptyStomach ?? { beforeMinutes: 30, afterMinutes: 120 },
      minIntervalMinutes: (DEFAULT_MIN_INTERVAL_HOURS[doses] ?? 0) * 60,
      separations: [],
      beforeOthersMinutes: rules.find(rule => rule.beforeOtherMedicines)?.beforeOtherMedicines,
    };

    const narrow = (from: number, to: number) => {
      constraint.window = [Math.max(constraint.window[0], from), Math.min(constraint.window[1], to)];
    };
    // A kept patient timing replaces the rule's meal timing too, so only its time-of-day codes still apply.
    const ruleWhen = rules.flatMap(rule => rule.when ?? []).filter(code => !keepOwnTiming || !MEAL_FOR[code]);
    const withMeals: Meal[] = [];
    for (const code of [...when, ...ruleWhen]) {
      const meal = MEAL_FOR[code];
      if (code === 'C') constraint.food = constraint.food === 'empty-stomach' ? 'empty-stomach' : 'with-food';
      else if (code === 'MORN') narrow(day.wake, day.wake + 240);
      else if (code === 'WAKE') narrow(day.wake, day.wake + 30);
      else if (code === 'EVE') { narrow(day.sleep - 360, day.sleep); constraint.evening = true; }
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
      const otherIngredients = other.snapshot.ingredients;
      let hours = 0;
      for (const [mine, theirs] of [[ingredients, otherIngredients], [otherIngredients, ingredients]]) {
        for (const rule of rulesFor(mine)) {
          for (const separation of rule.separateFrom ?? []) {
            if (theirs.some(ingredient => separation.ingredients.includes(ingredient))) hours = Math.max(hours, separation.hours);
          }
        }
      }
      if (hours) constraint.separations.push({ key: other.snapshot.key, hours });
      const theirFirst = rulesFor(otherIngredients).find(rule => rule.beforeOtherMedicines)?.beforeOtherMedicines;
      if (constraint.beforeOthersMinutes && swallowed(other.snapshot)) {
        constraint.separations.push({ key: other.snapshot.key, hours: constraint.beforeOthersMinutes / 60, order: 'before' });
      } else if (theirFirst && swallowed(snapshot)) {
        constraint.separations.push({ key: other.snapshot.key, hours: theirFirst / 60, order: 'after' });
      }
    }
    return constraint;
  });
}
