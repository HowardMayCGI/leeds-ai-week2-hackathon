import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Medication } from '@hackathon/api-contract';
import { checkInteractions, interactionDataset } from './interactions';
import { createFilePatientRepository } from './patient-data';

function medicine(code: string, id = code): Medication {
  const product = interactionDataset.products.find(product => product.code === code)!;
  return { id, code, system: product.system, name: product.name, asNeeded: false, instructions: [] };
}
const check = (...medications: Medication[]) => checkInteractions({ nhsNumber: '9993679666', medications });
const levo = () => medicine('39698911000001100');
const iron = () => medicine('39107411000001105');
const warfarin = () => medicine('42217911000001105');
const naproxen = () => medicine('1217387008');

test('dataset has unique products, ingredients, pairs and sources with valid references', () => {
  const data = interactionDataset;
  assert.equal(data.products.length, 36);
  assert.equal(data.interactions.length, 10);
  assert.equal(new Set(data.products.map(p => `${p.system}|${p.code}`)).size, 36);
  const ingredients = new Set(data.ingredients.map(i => i.id));
  assert.equal(ingredients.size, data.ingredients.length);
  assert.equal(new Set(data.sources.map(s => s.id)).size, data.sources.length);
  assert.equal(new Set(data.interactions.map(r => r.id)).size, data.interactions.length);
  assert.equal(new Set(data.interactions.map(r => [...r.ingredients].sort().join('|'))).size, data.interactions.length);
  for (const p of data.products) {
    assert.ok(p.ingredientIds.length);
    assert.ok(p.ingredientIds.every(id => ingredients.has(id)));
  }
  for (const rule of data.interactions) {
    assert.equal(rule.ingredients.length, 2);
    assert.notEqual(rule.ingredients[0], rule.ingredients[1]);
    assert.ok(rule.ingredients.every(id => ingredients.has(id)));
    assert.ok(rule.sourceIds.length && rule.sourceIds.every(id => data.sources.some(s => s.id === id)));
    if (rule.management.action === 'separate_doses') assert.ok(rule.management.minimumGapMinutes > 0);
  }
  assert.deepEqual(data.products.find(p => p.code === '322341003')!.ingredientIds, ['paracetamol', 'codeine']);
});

test('levothyroxine and iron yield a four-hour constraint in either input order', () => {
  const result = check(levo(), iron());
  assert.deepEqual(check(iron(), levo()), result);
  assert.equal(result.interactions.length, 1);
  assert.equal(result.scheduling.status, 'spacing_constraints');
  assert.equal(result.scheduling.constraints[0].minimumGapMinutes, 240);
  assert.equal(result.scheduling.constraints[0].appliesAcrossMidnight, true);
  assert.deepEqual(new Set(result.scheduling.constraints[0].medicationIds), new Set([levo().id, iron().id]));
  assert.equal(result.sources[0].id, 'levothyroxine-label');
});

test('bleeding risks require review and never generate a spacing fix, including PRN use', () => {
  const result = check(warfarin(), { ...naproxen(), asNeeded: true });
  assert.equal(result.scheduling.status, 'review_required');
  assert.equal(result.interactions[0].ruleId, 'warfarin--naproxen');
  assert.equal(result.interactions[0].management.action, 'prescriber_review');
  assert.equal(result.scheduling.constraints.length, 0);
  assert.deepEqual(result.scheduling.reviewInteractionIds, [result.interactions[0].id]);
});

test('review takes priority while retaining independent spacing constraints', () => {
  const result = check(levo(), iron(), warfarin(), naproxen());
  assert.equal(result.scheduling.status, 'review_required');
  assert.equal(result.scheduling.constraints.length, 1);
  assert.equal(result.scheduling.reviewInteractionIds.length, 1);
});

test('multiple strengths match the same ingredient rule and preserve product identities', () => {
  const result = check(warfarin(), naproxen(), medicine('42107811000001100'));
  assert.equal(result.interactions.length, 2);
  assert.equal(new Set(result.interactions.map(i => i.id)).size, 2);
  assert.ok(result.interactions.every(i => i.ruleId === 'warfarin--naproxen'));
});

test('dose limits are reviews, never inferred from tablet strength or claimed to be contraindications', () => {
  for (const code of ['42381911000001105', '42382111000001102']) {
    const result = check(medicine(code), medicine('783048008'));
    assert.equal(result.scheduling.status, 'review_required');
    const management = result.interactions[0].management;
    assert.equal(management.action, 'dose_review');
    if (management.action === 'dose_review') assert.deepEqual(management.maximumDailyDose, { value: 20, unit: 'mg' });
    assert.equal(result.scheduling.constraints.length, 0);
  }
});

test('unmapped coding systems and missing codes are explicit; names are never fuzzy-matched', () => {
  const unknown = { ...iron(), id: 'unknown', system: 'urn:other' };
  const missing = { ...iron(), id: 'missing', code: undefined };
  const result = check(levo(), unknown, missing);
  assert.equal(result.interactions.length, 0);
  assert.equal(result.uncheckedMedications.length, 2);
  assert.ok(result.uncheckedMedications.every(m => m.reason === 'unmapped_product'));
  assert.equal(result.coverage, 'limited_demo_rules');
});

test('no matches and empty records never claim clinical safety', () => {
  for (const result of [check(), check(medicine('322236009'))]) {
    assert.equal(result.scheduling.status, 'no_rules_matched');
    assert.equal(result.demoOnly, true);
    assert.equal(result.clinicallyValidated, false);
    assert.match(result.notice, /No matches does not mean safe/);
  }
  assert.equal(check(medicine('322236009')).uncheckedMedications[0].reason, 'no_demo_rules');
});

test('all indexed patient products map, and every rule matches its ingredient pair', async () => {
  const patients = createFilePatientRepository(fileURLToPath(new URL('../../../test_data', import.meta.url)));
  for (const patient of (await patients.listPatients()).patients) {
    const record = (await patients.getMedications(patient.nhsNumber))!;
    assert.ok(checkInteractions(record).uncheckedMedications.every(m => m.reason !== 'unmapped_product'));
  }
  for (const rule of interactionDataset.interactions) {
    const pair = rule.ingredients.map((id, index) => medicine(interactionDataset.products.find(p => p.ingredientIds.includes(id))!.code, `medicine-${index}`));
    assert.ok(check(...pair).interactions.some(i => i.ruleId === rule.id));
  }
});
