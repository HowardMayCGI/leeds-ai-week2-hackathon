import type { TimingWhen } from './rules';

/**
 * A medicine supplied by the patient's record. Text fields keep the record's
 * own wording and language; they are shown read-only and never translated.
 * `dosage` is the structured form the scheduler uses.
 */
export interface RecordMedicine {
  id: string;
  productId?: string;
  name: string;
  strength?: string;
  doseText: string;
  frequencyText: string;
  instructionText?: string;
  language: string;
  dosage: { timesPerDay: number; when?: TimingWhen[]; asNeeded?: boolean };
}

/** SYNTHETIC record for the demonstration patient. Not a real person or medical advice. */
export const DEMO_RECORD: RecordMedicine[] = [
  {
    id: 'rec-levothyroxine',
    productId: 'levothyroxine-50mcg-tablet',
    name: 'Levothyroxine',
    strength: '50 micrograms tablets',
    doseText: '1 tablet',
    frequencyText: 'Once a day',
    instructionText: 'Take in the morning on an empty stomach, at least 30 minutes before breakfast',
    language: 'en',
    dosage: { timesPerDay: 1, when: ['ACM'] },
  },
  {
    id: 'rec-metformin',
    productId: 'metformin-500mg-tablet',
    name: 'Metformin',
    strength: '500mg tablets',
    doseText: '1 tablet',
    frequencyText: 'Twice a day',
    instructionText: 'Take with or just after food',
    language: 'en',
    dosage: { timesPerDay: 2, when: ['C'] },
  },
  {
    id: 'rec-amlodipine',
    productId: 'amlodipine-5mg-tablet',
    name: 'Amlodipine',
    strength: '5mg tablets',
    doseText: '1 tablet',
    frequencyText: 'Once a day',
    instructionText: 'Take at the same time each day',
    language: 'en',
    dosage: { timesPerDay: 1 },
  },
  {
    id: 'rec-atorvastatin',
    productId: 'atorvastatin-20mg-tablet',
    name: 'Atorvastatin',
    strength: '20mg tablets',
    doseText: '1 tablet',
    frequencyText: 'Once a day',
    instructionText: 'Take in the evening',
    language: 'en',
    dosage: { timesPerDay: 1, when: ['EVE'] },
  },
  {
    id: 'rec-paracetamol',
    productId: 'paracetamol-500mg-tablet',
    name: 'Paracetamol',
    strength: '500mg tablets',
    doseText: '1 or 2 tablets',
    frequencyText: 'Up to 4 times a day when needed',
    instructionText: 'Leave at least 4 hours between doses. Do not take more than 8 tablets in 24 hours',
    language: 'en',
    dosage: { timesPerDay: 4, asNeeded: true },
  },
];
