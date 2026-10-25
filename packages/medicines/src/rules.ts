/**
 * Administration rules for medicines in the patient data, keyed by the first
 * word of the active ingredient. The records hold no food or timing
 * instructions, so these come from NHS medicines guidance (linked in `source`).
 * They are a starting point for pharmacist review, not a clinical knowledge base.
 */
export const RULES_VERSION = 'rules-2026-10-25a';

/** A subset of FHIR R4 `Timing.repeat.when` codes. */
export type TimingWhen = 'ACM' | 'ACD' | 'ACV' | 'C' | 'CM' | 'CD' | 'CV' | 'MORN' | 'EVE' | 'HS' | 'WAKE';

export interface AdministrationRule {
  food?: 'with-food' | 'empty-stomach';
  /** For an empty stomach: minutes before the next meal and after the last. */
  emptyStomach?: { beforeMinutes: number; afterMinutes: number };
  /** Times of day or meals the dose is tied to, such as before breakfast. */
  when?: TimingWhen[];
  separateFrom?: { ingredients: string[]; hours: number; reason: string }[];
  /** Taken first: every other medicine that is swallowed comes at least this many minutes later. */
  beforeOtherMedicines?: number;
  /** Why, in plain English from the source. Explanations of the schedule may only use these words. */
  reason?: string;
  source?: string;
}

export const ADMINISTRATION_RULES: Record<string, AdministrationRule> = {
  alendronic: {
    food: 'empty-stomach', emptyStomach: { beforeMinutes: 30, afterMinutes: 120 }, when: ['ACM'], beforeOtherMedicines: 30,
    reason: 'Alendronic acid is taken first thing in the morning, at least 30 minutes before food, drinks other than plain water, or other medicines, because they stop it being absorbed properly.',
    source: 'https://www.nhs.uk/medicines/alendronic-acid/how-and-when-to-take-alendronic-acid/',
  },
  levothyroxine: {
    food: 'empty-stomach', emptyStomach: { beforeMinutes: 30, afterMinutes: 120 }, when: ['ACM'],
    separateFrom: [{ ingredients: ['ferrous', 'calcium', 'magnesium', 'multivitamin'], hours: 4, reason: 'Iron, calcium and some other supplements can stop levothyroxine being absorbed properly, so they are taken at least 4 hours apart.' }],
    reason: 'Levothyroxine is taken in the morning on an empty stomach, at least 30 minutes before breakfast, because food can stop it working as well as it should.',
    source: 'https://www.nhs.uk/medicines/levothyroxine/',
  },
  tacrolimus: {
    food: 'empty-stomach', emptyStomach: { beforeMinutes: 60, afterMinutes: 120 },
    reason: 'Tacrolimus is taken on an empty stomach, at least 1 hour before food or 2 hours after it, because food changes how much of it your body absorbs.',
    source: 'https://www.guysandstthomas.nhs.uk/health-information/tacrolimus',
  },
  naproxen: {
    food: 'with-food', reason: 'Naproxen is taken with or just after a meal or snack, so it is less likely to upset your stomach.',
    source: 'https://www.nhs.uk/medicines/naproxen/how-and-when-to-take-naproxen/',
  },
  ibuprofen: {
    food: 'with-food', reason: 'Ibuprofen is taken with or just after food, so it is less likely to upset your stomach.',
    source: 'https://www.nhs.uk/medicines/ibuprofen-for-adults/',
  },
  metformin: {
    food: 'with-food', reason: 'Metformin is taken with or just after a meal, which lowers the chance of it upsetting your stomach.',
    source: 'https://www.nhs.uk/medicines/metformin/',
  },
  // Rapid-acting insulin is injected at mealtimes.
  insulin: {
    food: 'with-food', reason: 'Mealtime insulin is injected around the time you eat, to match the food in your meal.',
    source: 'https://www.nhs.uk/conditions/type-1-diabetes/insulin/',
  },
  simvastatin: {
    when: ['EVE'], reason: 'Simvastatin is taken in the evening, because your body makes most of its cholesterol at night.',
    source: 'https://www.nhs.uk/medicines/simvastatin/',
  },
  warfarin: {
    when: ['EVE'], reason: 'Warfarin is taken once a day at the same time each day, usually in the evening.',
    source: 'https://www.nhs.uk/medicines/warfarin/how-and-when-to-take-warfarin/',
  },
  // A thiazide diuretic is taken in the morning so it does not wake the patient at night to pee.
  hydrochlorothiazide: {
    when: ['MORN'], reason: 'This kind of water tablet is taken in the morning, so you do not need to get up in the night to pee.',
    source: 'https://www.nhs.uk/medicines/bendroflumethiazide/',
  },
  ferrous: {
    separateFrom: [{ ingredients: ['calcium', 'omeprazole', 'lansoprazole'], hours: 2, reason: 'Calcium and some indigestion medicines can stop iron being absorbed properly, so they are taken at least 2 hours apart.' }],
    source: 'https://www.nhs.uk/medicines/ferrous-sulfate/',
  },
  calcium: { food: 'with-food', reason: 'Calcium supplements are usually taken with food.' },
};

/** Default minimum gaps between doses of the same medicine, by doses per day. */
export const DEFAULT_MIN_INTERVAL_HOURS: Record<number, number> = { 2: 4, 3: 3, 4: 3 };

export function rulesFor(ingredients: string[]): AdministrationRule[] {
  return ingredients.map(code => ADMINISTRATION_RULES[code]).filter(Boolean);
}

/** When a patient says they take a medicine, relative to food. */
export const FOOD_TIMINGS = ['before-food', 'with-food', 'any', 'not-sure'] as const;
export type FoodTiming = (typeof FOOD_TIMINGS)[number];
export type MealTiming = Extract<FoodTiming, 'before-food' | 'with-food'>;

/** The timing the rules ask for, if they say anything about food. */
export function recommendedTiming(ingredients: string[]): MealTiming | undefined {
  const rules = rulesFor(ingredients);
  if (rules.some(rule => rule.food === 'empty-stomach')) return 'before-food';
  if (rules.some(rule => rule.food === 'with-food')) return 'with-food';
  return undefined;
}

/** A patient's timing that goes against the rules, such as naproxen before food. */
export function timingConflict(ingredients: string[], timing: FoodTiming): { chosen: MealTiming; recommended: MealTiming } | undefined {
  const recommended = recommendedTiming(ingredients);
  if (!recommended || (timing !== 'before-food' && timing !== 'with-food') || timing === recommended) return undefined;
  return { chosen: timing, recommended };
}
