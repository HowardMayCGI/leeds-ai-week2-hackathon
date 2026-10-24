import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOGUE, editDistance, formatStrength, searchCatalogue } from './catalogue';

const ids = (query: string) => searchCatalogue(query).map(result => result.product.id);

test('identifiers are stable, unique and not presented as verified mappings', () => {
  assert.equal(new Set(CATALOGUE.map(item => item.id)).size, CATALOGUE.length);
  for (const item of CATALOGUE) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.ok(item.ingredients.length > 0);
    assert.ok(item.mappings.every(mapping => !mapping.verified));
    // Search results identify a product only; dose and instructions come from the patient.
    assert.equal('dose' in item || 'instructions' in item, false);
  }
});

test('suggests partial names, misspellings, brands and generic aliases', () => {
  assert.deepEqual(ids('levo'), ['levothyroxine-25mcg-tablet', 'levothyroxine-50mcg-tablet', 'levothyroxine-100mcg-tablet']);
  assert.deepEqual(ids('metfromin'), ['metformin-500mg-tablet', 'metformin-850mg-tablet']);
  assert.ok(ids('paracetemol').includes('paracetamol-500mg-tablet'));
  assert.ok(ids('ibuprofin').includes('ibuprofen-400mg-tablet'));
  const lipitor = searchCatalogue('Lipitor');
  assert.equal(lipitor[0].product.name, 'Atorvastatin');
  assert.deepEqual(lipitor[0].matchedAlias, { name: 'Lipitor', type: 'brand' });
  assert.ok(ids('iron').includes('ferrous-sulfate-200mg-tablet'));
  assert.ok(ids('vitamin d').includes('colecalciferol-1000unit-tablet'));
  assert.ok(ids('Ferrous sulphate').includes('ferrous-sulfate-200mg-tablet'));
});

test('a strength in the query narrows the results and unknown names find nothing', () => {
  assert.deepEqual(ids('atorvastatin 40'), ['atorvastatin-40mg-tablet']);
  assert.deepEqual(ids('turmeric'), []);
  assert.deepEqual(ids('l'), []);
});

test('formats strengths for display and measures transpositions as one edit', () => {
  assert.equal(formatStrength(CATALOGUE.find(item => item.id === 'levothyroxine-50mcg-tablet')!), '50 micrograms');
  assert.equal(formatStrength(CATALOGUE.find(item => item.id === 'calcium-vitd-chewable')!), '1.5g + 400 units');
  assert.equal(editDistance('metfromin', 'metformin'), 1);
});
