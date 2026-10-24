import type { Form } from './catalogue';

/** Units a patient counts a dose in. Language independent; the interface words them. */
export const DOSE_UNITS = ['tablet', 'capsule', 'ml', 'sachet', 'drop', 'puff', 'spray', 'patch', 'unit'] as const;
export type DoseUnit = (typeof DOSE_UNITS)[number];

/** How much to take each time, such as 1 tablet, or 1 or 2 tablets. */
export interface Dose {
  quantity: number;
  /** Set for a range such as "1 or 2 tablets". */
  quantityMax?: number;
  unit: DoseUnit;
}

const UNIT_FOR_FORM: Record<Form, DoseUnit> = {
  tablet: 'tablet', capsule: 'capsule', inhaler: 'puff', spray: 'spray', patch: 'patch', nebuliser: 'ml', injection: 'unit', 'oral-liquid': 'ml',
};

export function unitForForm(form: Form): DoseUnit {
  return UNIT_FOR_FORM[form];
}

export function isDoseUnit(value: unknown): value is DoseUnit {
  return DOSE_UNITS.includes(value as DoseUnit);
}

/** Reads a recorded unit such as "tablet", "Capsules" or "UNT". */
export function toDoseUnit(text: string | undefined): DoseUnit | undefined {
  const word = text?.trim().toLowerCase().replace(/patches$/, 'patch').replace(/s$/, '');
  if (!word) return undefined;
  if (word === 'unt' || word === 'iu') return 'unit';
  if (word === 'actuation' || word === 'dose') return 'puff';
  return isDoseUnit(word) ? word : undefined;
}

/** Reads a typed quantity such as "1", "2.5", "1,5" or "½". Returns null for anything else. */
export function parseQuantity(text: string): number | null {
  const value = text.trim().replace(',', '.').replace(/^½$/, '0.5').replace(/^(\d+)\s*½$/, '$1.5');
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const quantity = Number(value);
  return quantity > 0 && quantity <= 100 ? quantity : null;
}
