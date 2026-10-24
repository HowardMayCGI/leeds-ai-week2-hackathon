import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editDistance, medicineOptions, parseMedicineName, searchMedicines, toMedicineOption } from './catalogue';

// Product descriptions as they appear in the patient data.
const RECORDED = [
  ['39728011000001102', 'Alendronic acid 10mg tablets'],
  ['783048008', 'Amlodipine 10mg tablets'],
  ['42206211000001100', 'amLODIPine 2.5 MG Oral Tablet'],
  ['39695411000001103', 'atorvastatin 10 MG Oral Tablet'],
  ['18358011000001101', 'Glyceryl trinitrate 400micrograms/dose pump sublingual spray'],
  ['3280111000001104', 'Insulin Lispro 100 UNT/ML Injectable Solution [Humalog]'],
  ['1217387008', 'Naproxen 250mg tablets'],
  ['42107811000001100', 'Naproxen 500mg tablets'],
  ['2891711000001108', 'OxyContin 10mg modified-release tablets (Napp Pharmaceuticals Ltd)'],
  ['322341003', 'Paracetamol 500mg / Codeine phosphate 30mg tablets'],
  ['322236009', 'Paracetamol 500mg tablets'],
  ['36120011000001101', 'Fentanyl 25micrograms/hour transdermal patches'],
  ['39107411000001105', 'Ferrous sulfate 325mg modified-release tablets'],
].map(([code, name]) => ({ code, name }));
const OPTIONS = medicineOptions([...RECORDED, RECORDED[1]]);
const names = (query: string) => searchMedicines(OPTIONS, query).map(result => `${result.option.name} ${result.option.strength}`);

test('reads a short name, strength and form from each product description', () => {
  const read = (text: string) => {
    const { name, strength, form, ingredients } = parseMedicineName(text);
    return { name, strength, form, ingredients };
  };
  assert.deepEqual(read('amLODIPine 2.5 MG Oral Tablet'), { name: 'Amlodipine', strength: '2.5mg', form: 'tablet', ingredients: ['amlodipine'] });
  assert.deepEqual(read('Paracetamol 500mg / Codeine phosphate 30mg tablets'), { name: 'Paracetamol and codeine phosphate', strength: '500mg + 30mg', form: 'tablet', ingredients: ['paracetamol', 'codeine'] });
  assert.deepEqual(read('Insulin Lispro 100 UNT/ML Injectable Solution [Humalog]'), { name: 'Insulin lispro (Humalog)', strength: '100 units/ml', form: 'injection', ingredients: ['insulin'] });
  assert.deepEqual(read('Fentanyl 25micrograms/hour transdermal patches'), { name: 'Fentanyl', strength: '25 micrograms an hour', form: 'patch', ingredients: ['fentanyl'] });
  assert.deepEqual(read('Glyceryl trinitrate 400micrograms/dose pump sublingual spray'), { name: 'Glyceryl trinitrate', strength: '400 micrograms per dose', form: 'spray', ingredients: ['glyceryl'] });
  assert.deepEqual(read('OxyContin 10mg modified-release tablets (Napp Pharmaceuticals Ltd)'), { name: 'OxyContin', strength: '10mg', form: 'tablet', ingredients: ['oxycontin'] });
});

test('gives one option per recorded product, keeping its code and description', () => {
  assert.equal(OPTIONS.length, RECORDED.length);
  assert.equal(new Set(OPTIONS.map(option => option.id)).size, OPTIONS.length);
  const naproxen = toMedicineOption({ code: '1217387008', name: 'Naproxen 250mg tablets' });
  assert.equal(naproxen.id, '1217387008');
  assert.equal(naproxen.recordName, 'Naproxen 250mg tablets');
  // Options identify a product only; dose and instructions come from the patient.
  assert.equal('dose' in naproxen || 'instructions' in naproxen, false);
});

test('suggests partial names, misspellings, brands and other names from the patient data', () => {
  assert.deepEqual(names('napr'), ['Naproxen 250mg', 'Naproxen 500mg']);
  assert.deepEqual(names('naproxin'), ['Naproxen 250mg', 'Naproxen 500mg']);
  assert.ok(names('paracetemol').includes('Paracetamol 500mg'));
  const cocodamol = searchMedicines(OPTIONS, 'co-codamol');
  assert.equal(cocodamol[0].option.name, 'Paracetamol and codeine phosphate');
  assert.deepEqual(cocodamol[0].matchedAlias, { name: 'Co-codamol', type: 'generic' });
  assert.equal(searchMedicines(OPTIONS, 'Humalog')[0].option.ingredients[0], 'insulin');
  assert.ok(names('iron').includes('Ferrous sulfate 325mg'));
  assert.ok(names('GTN').includes('Glyceryl trinitrate 400 micrograms per dose'));
});

test('a strength in the query narrows the results and unknown names find nothing', () => {
  assert.deepEqual(names('naproxen 500'), ['Naproxen 500mg']);
  assert.deepEqual(names('amlodipine 2.5'), ['Amlodipine 2.5mg']);
  assert.deepEqual(names('turmeric'), []);
  assert.deepEqual(names('n'), []);
  assert.equal(editDistance('naproxin', 'naproxen'), 1);
});
