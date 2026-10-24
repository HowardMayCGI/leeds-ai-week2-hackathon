import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from './en';
import { CATALOGUES, formatAmount, formatTime, LANGUAGES, translate } from './index';

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
      if (code !== 'en' && !['common.pageTitleSuffix', 'dose.withStrength'].includes(key) && !key.startsWith('units.ml') && !/^\{?\w*\}?$/.test(english[key])) {
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
  assert.deepEqual(translate('ur', 'addForm.brand', { name: 'Panadol' }), { text: 'برانڈ: Panadol', lang: 'ur' });
});

test('presents structured times in each language without changing the stored value', () => {
  assert.equal(formatTime('07:00', 'en'), '7am');
  assert.equal(formatTime('18:30', 'en'), '6:30pm');
  assert.equal(formatTime('00:15', 'en'), '12:15am');
  assert.equal(formatTime('18:30', 'pl'), '6:30 PM');
  assert.equal(formatTime('18:30', 'ur'), '6:30 PM');
});

test('words a dose amount with each language\'s plural forms', () => {
  assert.equal(formatAmount({ quantity: 1, unit: 'tablet' }, 'en').text, '1 tablet');
  assert.equal(formatAmount({ quantity: 1, quantityMax: 2, unit: 'tablet' }, 'en').text, '1 or 2 tablets');
  assert.equal(formatAmount({ quantity: 0.5, unit: 'tablet' }, 'en').text, '0.5 tablets');
  assert.equal(formatAmount({ quantity: 5, unit: 'ml' }, 'en').text, '5ml');
  assert.equal(formatAmount({ quantity: 2, unit: 'tablet' }, 'pl').text, '2 tabletki');
  assert.equal(formatAmount({ quantity: 5, unit: 'tablet' }, 'pl').text, '5 tabletek');
  assert.equal(formatAmount({ quantity: 1, unit: 'tablet' }, 'ur').text, '1 گولی');
  assert.equal(formatAmount({ quantity: 2, unit: 'tablet' }, 'ur').text, '2 گولیاں');
});
