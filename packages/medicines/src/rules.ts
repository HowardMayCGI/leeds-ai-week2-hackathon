/**
 * ILLUSTRATIVE administration rules for the demonstration only. They are not a
 * clinical knowledge base. Choosing real administration-rule and interaction
 * sources is follow-on work; these stand in so the journey can be shown.
 */
export const RULES_VERSION = 'demo-rules-2026-10-24';

/** A subset of FHIR R4 `Timing.repeat.when` codes used by the record. */
export type TimingWhen = 'ACM' | 'ACD' | 'ACV' | 'C' | 'CM' | 'CD' | 'CV' | 'MORN' | 'EVE' | 'HS' | 'WAKE';

export interface AdministrationRule {
  food?: 'with-food' | 'empty-stomach';
  /** For an empty stomach: minutes before the next meal and after the last. */
  emptyStomach?: { beforeMinutes: number; afterMinutes: number };
  separateFrom?: { ingredients: string[]; hours: number }[];
}

export const ADMINISTRATION_RULES: Record<string, AdministrationRule> = {
  levothyroxine: {
    food: 'empty-stomach',
    emptyStomach: { beforeMinutes: 30, afterMinutes: 120 },
    separateFrom: [{ ingredients: ['ferrous-sulfate', 'ferrous-fumarate', 'calcium-carbonate', 'magnesium', 'multivitamin'], hours: 4 }],
  },
  metformin: { food: 'with-food' },
  ibuprofen: { food: 'with-food' },
  'ferrous-sulfate': { separateFrom: [{ ingredients: ['calcium-carbonate', 'omeprazole', 'lansoprazole'], hours: 2 }] },
  'ferrous-fumarate': { separateFrom: [{ ingredients: ['calcium-carbonate', 'omeprazole', 'lansoprazole'], hours: 2 }] },
  'calcium-carbonate': { food: 'with-food' },
};

/** Default minimum gaps between doses of the same medicine, by doses per day. */
export const DEFAULT_MIN_INTERVAL_HOURS: Record<number, number> = { 2: 4, 3: 3, 4: 3 };
