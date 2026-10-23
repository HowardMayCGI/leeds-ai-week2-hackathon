import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRandomNumberResponse } from './index';

test('accepts the contract boundaries and rejects malformed API responses', () => {
  for (const number of [1, 42, 100]) assert.equal(isRandomNumberResponse({ number }), true);
  for (const value of [null, undefined, {}, 42, { number: '42' }, { number: 0 }, { number: 101 }, { number: 1.5 }, { number: NaN }]) {
    assert.equal(isRandomNumberResponse(value), false);
  }
});
