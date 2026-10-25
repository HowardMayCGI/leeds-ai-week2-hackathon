import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isJokeResponse, isMedicationsResponse, isMedicineListResponse, isPatientListResponse, isRandomNumberResponse } from './index';

test('recognises jokes and rejects empty or malformed responses', () => {
  assert.equal(isJokeResponse({ joke: 'A joke.' }), true);
  for (const value of [null, undefined, {}, 'joke', { joke: 42 }, { joke: '' }, { joke: '  ' }]) {
    assert.equal(isJokeResponse(value), false);
  }
});

test('accepts the contract boundaries and rejects malformed API responses', () => {
  for (const number of [1, 42, 100]) assert.equal(isRandomNumberResponse({ number }), true);
  for (const value of [null, undefined, {}, 42, { number: '42' }, { number: 0 }, { number: 101 }, { number: 1.5 }, { number: NaN }]) {
    assert.equal(isRandomNumberResponse(value), false);
  }
});

test('recognises patient, medication and medicine list responses', () => {
  assert.equal(isPatientListResponse({ patients: [{ nhsNumber: '9993679666', name: 'Mitch Trantow' }] }), true);
  assert.equal(isPatientListResponse({ patients: [{ nhsNumber: 9993679666 }] }), false);
  assert.equal(isMedicationsResponse({ nhsNumber: '1', medications: [{ id: 'a', name: 'Naproxen 250mg tablets', asNeeded: false, instructions: [] }] }), true);
  assert.equal(isMedicationsResponse({ medications: [{ id: 'a' }] }), false);
  assert.equal(isMedicineListResponse({ medicines: [{ code: '1', name: 'Naproxen 250mg tablets' }] }), true);
  assert.equal(isMedicineListResponse({ medicines: null }), false);
});
