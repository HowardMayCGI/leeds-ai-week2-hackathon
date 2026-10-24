import type { SourceMedication } from './record';

/**
 * Demonstration prescriptions for products whose test records leave out the
 * dose or how often to take it. A real GP record carries both, so the app
 * never asks a patient how to take a medicine they were prescribed. These are
 * typical adult doses chosen for the demonstration, keyed by dm+d or SNOMED CT
 * product code. Demo only: not clinically validated or individually reconciled.
 */
export const DEMO_PRESCRIPTIONS_VERSION = 'demo-prescriptions-2026-10-24-v1';

interface DemoPrescription {
  dose: { value: number; unit: string };
  /** Doses a day for a regular medicine. */
  timesPerDay?: number;
  /** Taken only when needed, such as a GTN spray. */
  asNeeded?: true;
}

const DEMO_PRESCRIPTIONS: Record<string, DemoPrescription> = {
  '39728011000001102': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Alendronic acid 10mg
  '783048008': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Amlodipine 10mg
  '319781007': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Aspirin 75mg
  '42370411000001101': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Atenolol 100mg
  '39695411000001103': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Atorvastatin 10mg
  '1255204003': { dose: { value: 2, unit: 'ml' }, timesPerDay: 2 }, // Budesonide 250 micrograms/ml nebuliser
  '39689111000001106': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Clopidogrel 75mg
  '42208511000001101': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Digoxin 125 micrograms
  '42188011000001108': { dose: { value: 1, unit: 'tablet' }, asNeeded: true }, // Diphenhydramine 25mg
  '39107411000001105': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Ferrous sulfate 325mg
  '38897511000001104': { dose: { value: 1, unit: 'puff' }, timesPerDay: 2 }, // Fluticasone and salmeterol inhaler
  '18358011000001101': { dose: { value: 1, unit: 'spray' }, asNeeded: true }, // Glyceryl trinitrate spray
  '3280111000001104': { dose: { value: 6, unit: 'unit' }, timesPerDay: 3 }, // Insulin lispro (Humalog)
  '318474009': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 2 }, // Metoprolol tartrate 100mg
  '1217387008': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 2 }, // Naproxen 250mg
  '42107811000001100': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 2 }, // Naproxen 500mg
  '39702811000001103': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Prasugrel 10mg
  '770300007': { dose: { value: 2, unit: 'puff' }, asNeeded: true }, // Salbutamol inhaler
  '39709511000001105': { dose: { value: 1, unit: 'ml' }, asNeeded: true }, // Salbutamol 5mg/ml nebuliser
  '42382111000001102': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Simvastatin 20mg
  '28808811000001101': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Tacrolimus 1mg modified-release
  '322623000': { dose: { value: 1, unit: 'capsule' }, asNeeded: true }, // Tramadol 50mg
  '42217411000001102': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 3 }, // Verapamil 80mg
  '42217911000001105': { dose: { value: 1, unit: 'tablet' }, timesPerDay: 1 }, // Warfarin 5mg
};

/** Fills in a missing dose or frequency from the demonstration prescription. Recorded values always win. */
export function withDemoPrescription(source: SourceMedication): SourceMedication {
  const demo = source.code ? DEMO_PRESCRIPTIONS[source.code] : undefined;
  if (!demo) return source;
  const timingMissing = !source.frequency && !source.asNeeded;
  return {
    ...source,
    dose: source.dose ?? demo.dose,
    frequency: source.frequency ?? (timingMissing && demo.timesPerDay ? { frequency: demo.timesPerDay, period: 1, periodUnit: 'd' } : undefined),
    asNeeded: source.asNeeded || (timingMissing && demo.asNeeded === true),
  };
}
