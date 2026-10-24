import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from './en';
import { CATALOGUES, formatTime, LANGUAGES, translate } from './index';

function leaves(node: unknown, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return { [prefix]: node };
  return Object.assign({}, ...Object.entries(node as object).map(([key, value]) => leaves(value, prefix ? `${prefix}.${key}` : key)));
}
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('Polish and Urdu cover every interface string with the same placeholders', () => {
  const english = leaves(en);
  for (const { code } of LANGUAGES) {
    const translated = leaves(CATALOGUES[code]);
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(english).sort(), code);
    for (const [key, text] of Object.entries(translated)) {
      assert.ok(text.trim(), `${code} ${key} is empty`);
      assert.deepEqual(placeholders(text), placeholders(english[key]), `${code} ${key} placeholders`);
      if (code !== 'en' && !['common.pageTitleSuffix'].includes(key) && !/^\{?\w*\}?$/.test(english[key])) {
        assert.notEqual(text, english[key], `${code} ${key} looks untranslated`);
      }
    }
  }
});

test('missing translations fall back to explicit English, never a key or blank', () => {
  const original = CATALOGUES.pl;
  CATALOGUES.pl = {};
  try {
    assert.deepEqual(translate('pl', 'intro.start'), { text: 'Get started', lang: 'en' });
  } finally {
    CATALOGUES.pl = original;
  }
  assert.deepEqual(translate('ur', 'prescriptions.yourMedicinesDetail', { count: 5 }), { text: '5 موجودہ دوائیں', lang: 'ur' });
});

test('presents structured times in each language without changing the stored value', () => {
  assert.equal(formatTime('07:00', 'en'), '7am');
  assert.equal(formatTime('18:30', 'en'), '6:30pm');
  assert.equal(formatTime('00:15', 'en'), '12:15am');
  assert.equal(formatTime('18:30', 'pl'), '18:30');
  assert.match(formatTime('18:30', 'ur'), /6:30/);
});
