import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withDemoPrescription } from './demo-prescriptions';
import { recordFrequency, toRecordMedicine, type SourceMedication } from './record';
import { recommendedTiming, timingConflict } from './rules';

const source = (changes: Partial<SourceMedication>): SourceMedication => ({ id: 'm1', code: '1', name: 'Clopidogrel 75mg tablets', asNeeded: false, instructions: [], ...changes });
const daily = (frequency: number, period = 1, periodUnit = 'd') => ({ frequency, period, periodUnit });

test('reads how often to take a medicine from the recorded timing', () => {
  assert.deepEqual(recordFrequency(source({ frequency: daily(1) })), { kind: 'daily', timesPerDay: 1 });
  assert.deepEqual(recordFrequency(source({ frequency: daily(4) })), { kind: 'daily', timesPerDay: 4 });
  assert.deepEqual(recordFrequency(source({ frequency: daily(1, 3) })), { kind: 'every-days', days: 3 });
  assert.deepEqual(recordFrequency(source({ frequency: daily(1, 4, 'h') })), { kind: 'daily', timesPerDay: 4 });
  assert.deepEqual(recordFrequency(source({ frequency: daily(1, 12, 'h') })), { kind: 'daily', timesPerDay: 2 });
  assert.deepEqual(recordFrequency(source({ asNeeded: true, frequency: daily(1) })), { kind: 'as-needed' });
  assert.deepEqual(recordFrequency(source({})), { kind: 'missing' });
  assert.deepEqual(recordFrequency(source({ frequency: daily(6) })), { kind: 'missing' });
});

test('reads the dose in the record\'s own units', () => {
  const complete = toRecordMedicine(source({ dose: { value: 1, unit: 'tablet' }, frequency: daily(1) }));
  assert.deepEqual(complete.dose, { quantity: 1, unit: 'tablet' });
  const patch = toRecordMedicine(source({ name: 'Fentanyl 25micrograms/hour transdermal patches', dose: { value: 1, unit: 'patch' }, frequency: daily(1, 3) }));
  assert.deepEqual(patch.dose, { quantity: 1, unit: 'patch' });
  assert.deepEqual(patch.frequency, { kind: 'every-days', days: 3 });
});

test('fills a missing dose or frequency from the demonstration prescription, never replacing recorded values', () => {
  const clopidogrel = toRecordMedicine(withDemoPrescription(source({ code: '39689111000001106' })));
  assert.deepEqual(clopidogrel.dose, { quantity: 1, unit: 'tablet' });
  assert.deepEqual(clopidogrel.frequency, { kind: 'daily', timesPerDay: 1 });
  const spray = withDemoPrescription(source({ code: '18358011000001101', name: 'Glyceryl trinitrate 400micrograms/dose pump sublingual spray' }));
  assert.equal(spray.asNeeded, true);
  assert.equal(spray.frequency, undefined);
  const recorded = withDemoPrescription(source({ code: '39689111000001106', dose: { value: 2, unit: 'tablet' }, frequency: daily(2) }));
  assert.deepEqual([recorded.dose, recorded.frequency], [{ value: 2, unit: 'tablet' }, daily(2)]);
  // A medicine the record marks as needed stays that way.
  assert.equal(withDemoPrescription(source({ code: '783048008', asNeeded: true })).frequency, undefined);
  const unknown = source({ code: 'unknown' });
  assert.equal(withDemoPrescription(unknown), unknown);
});

test('shows recorded instructions without their SNOMED CT tag', () => {
  const medicine = toRecordMedicine(source({ instructions: ['Every six hours (qualifier value)', 'Warning. Avoid alcoholic drink (qualifier value)'] }));
  assert.deepEqual(medicine.instructions, ['Every six hours', 'Warning. Avoid alcoholic drink']);
});

test('flags a patient timing that goes against a medicine\'s food rule', () => {
  assert.equal(recommendedTiming(['naproxen']), 'with-food');
  assert.equal(recommendedTiming(['alendronic']), 'before-food');
  assert.equal(recommendedTiming(['clopidogrel']), undefined);
  assert.deepEqual(timingConflict(['naproxen'], 'before-food'), { chosen: 'before-food', recommended: 'with-food' });
  assert.deepEqual(timingConflict(['tacrolimus'], 'with-food'), { chosen: 'with-food', recommended: 'before-food' });
  assert.equal(timingConflict(['naproxen'], 'with-food'), undefined);
  assert.equal(timingConflict(['naproxen'], 'any'), undefined);
  assert.equal(timingConflict(['clopidogrel'], 'before-food'), undefined);
});
