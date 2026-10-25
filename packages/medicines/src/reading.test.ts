import assert from 'node:assert/strict';
import { test } from 'node:test';
import { medicineOptions } from './catalogue';
import { answersFromReading } from './reading';

const options = medicineOptions([
  { code: '322236009', name: 'Paracetamol 500mg tablets' },
  { code: '1217387008', name: 'Naproxen 250mg tablets' },
  { code: '42107811000001100', name: 'Naproxen 500mg tablets' },
  { code: '39107411000001105', name: 'Ferrous sulfate 325mg modified-release tablets' },
  { code: '3280111000001104', name: 'Insulin Lispro 100 UNT/ML Injectable Solution [Humalog]' },
]);

test('a reading that names one product in the list selects it, with the directions as answers', () => {
  const answers = answersFromReading({ found: true, name: 'Naproxen', strength: '500mg', form: 'tablet', amount: 1, timesPerDay: 2, timing: 'with-food', instructions: 'Swallow whole' }, options);
  assert.equal(answers.medicine?.code, '42107811000001100');
  assert.deepEqual({ ...answers, medicine: undefined }, {
    medicine: undefined, quantity: 1, frequency: 'twice-daily', timing: 'with-food', instructions: 'Swallow whole', missing: [],
  });
  // "1 or 2 tablets" is left for the patient, because the form takes one amount.
  const range = answersFromReading({ found: true, name: 'Paracetamol', strength: '500mg', form: 'tablet', amount: 1, amountMax: 2, timesPerDay: 4 }, options);
  assert.equal(range.medicine?.code, '322236009');
  assert.equal(range.quantity, undefined);
  assert.deepEqual(range.missing, ['amount', 'timing']);
  // A brand matches through the list's own brand names.
  assert.equal(answersFromReading({ found: true, brand: 'Humalog', strength: '100 units/ml', form: 'injection' }, options).medicine?.code, '3280111000001104');
});

test('the patient chooses from the list when the strength is unknown, and enters it themselves when the list has no such strength', () => {
  const unknownStrength = answersFromReading({ found: true, name: 'Naproxen', asNeeded: true }, options);
  assert.equal(unknownStrength.medicine, undefined);
  assert.equal(unknownStrength.query, 'Naproxen');
  assert.equal(unknownStrength.frequency, 'as-needed');
  assert.deepEqual(unknownStrength.missing, ['strength', 'amount', 'timing']);

  const otherStrength = answersFromReading({ found: true, name: 'Ferrous sulfate', strength: '200mg', form: 'tablet', amount: 1, timesPerDay: 3 }, options);
  assert.equal(otherStrength.medicine, undefined);
  assert.deepEqual(otherStrength.manual, { name: 'Ferrous sulfate', strength: '200mg', unit: 'tablet' });
  assert.equal(otherStrength.frequency, 'three-times-daily');

  const notListed = answersFromReading({ found: true, name: 'Colecalciferol', brand: 'Fultium-D3', strength: '800 units', form: 'capsule', lessThanDaily: true }, options);
  assert.deepEqual(notListed.manual, { name: 'Colecalciferol (Fultium-D3)', strength: '800 units', unit: 'capsule' });
  assert.equal(notListed.frequency, 'not-daily');
});

test('nothing is filled in when nothing could be read', () => {
  assert.deepEqual(answersFromReading({ found: false }, options), { missing: ['name', 'strength', 'amount', 'frequency', 'timing'] });
  assert.deepEqual(answersFromReading({ found: true }, options).missing.length, 5);
});
