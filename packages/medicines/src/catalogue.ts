/**
 * A small, replaceable proof-of-concept catalogue. Identifiers are local and
 * language independent. They are NOT verified mappings to dm+d or to any
 * interaction database; `mappings` stays empty until a provider is chosen.
 */
export const CATALOGUE_SYSTEM = 'https://lai-app.example/fhir/CodeSystem/poc-medicines';
export const CATALOGUE_VERSION = 'poc-2026-10-24';

export type Form = 'tablet' | 'capsule' | 'chewable-tablet' | 'soluble-tablet' | 'oral-liquid' | 'softgel';
export type ProductKind = 'medicine' | 'supplement';

export interface Strength {
  value: number;
  unit: 'mg' | 'microgram' | 'g' | 'unit' | 'mg/5ml';
}

export interface Ingredient {
  code: string;
  strength: Strength;
}

export interface CatalogueProduct {
  id: string;
  name: string;
  kind: ProductKind;
  form: Form;
  ingredients: Ingredient[];
  /** Generic and brand names that patients might search for. */
  aliases: { name: string; type: 'brand' | 'generic' }[];
  mappings: { system: string; code: string; verified: boolean }[];
}

const product = (
  id: string, name: string, kind: ProductKind, form: Form, ingredients: [string, number, Strength['unit']][],
  aliases: [string, 'brand' | 'generic'][] = [],
): CatalogueProduct => ({
  id, name, kind, form,
  ingredients: ingredients.map(([code, value, unit]) => ({ code, strength: { value, unit } })),
  aliases: aliases.map(([alias, type]) => ({ name: alias, type })),
  mappings: [],
});

export const CATALOGUE: CatalogueProduct[] = [
  product('levothyroxine-25mcg-tablet', 'Levothyroxine', 'medicine', 'tablet', [['levothyroxine', 25, 'microgram']], [['Eltroxin', 'brand'], ['Thyroxine', 'generic']]),
  product('levothyroxine-50mcg-tablet', 'Levothyroxine', 'medicine', 'tablet', [['levothyroxine', 50, 'microgram']], [['Eltroxin', 'brand'], ['Thyroxine', 'generic']]),
  product('levothyroxine-100mcg-tablet', 'Levothyroxine', 'medicine', 'tablet', [['levothyroxine', 100, 'microgram']], [['Eltroxin', 'brand'], ['Thyroxine', 'generic']]),
  product('metformin-500mg-tablet', 'Metformin', 'medicine', 'tablet', [['metformin', 500, 'mg']], [['Glucophage', 'brand']]),
  product('metformin-850mg-tablet', 'Metformin', 'medicine', 'tablet', [['metformin', 850, 'mg']], [['Glucophage', 'brand']]),
  product('amlodipine-5mg-tablet', 'Amlodipine', 'medicine', 'tablet', [['amlodipine', 5, 'mg']], [['Istin', 'brand']]),
  product('amlodipine-10mg-tablet', 'Amlodipine', 'medicine', 'tablet', [['amlodipine', 10, 'mg']], [['Istin', 'brand']]),
  product('atorvastatin-20mg-tablet', 'Atorvastatin', 'medicine', 'tablet', [['atorvastatin', 20, 'mg']], [['Lipitor', 'brand']]),
  product('atorvastatin-40mg-tablet', 'Atorvastatin', 'medicine', 'tablet', [['atorvastatin', 40, 'mg']], [['Lipitor', 'brand']]),
  product('simvastatin-40mg-tablet', 'Simvastatin', 'medicine', 'tablet', [['simvastatin', 40, 'mg']], [['Zocor', 'brand']]),
  product('omeprazole-20mg-capsule', 'Omeprazole', 'medicine', 'capsule', [['omeprazole', 20, 'mg']], [['Losec', 'brand']]),
  product('lansoprazole-30mg-capsule', 'Lansoprazole', 'medicine', 'capsule', [['lansoprazole', 30, 'mg']], [['Zoton', 'brand']]),
  product('ramipril-5mg-capsule', 'Ramipril', 'medicine', 'capsule', [['ramipril', 5, 'mg']], [['Tritace', 'brand']]),
  product('paracetamol-500mg-tablet', 'Paracetamol', 'medicine', 'tablet', [['paracetamol', 500, 'mg']], [['Panadol', 'brand'], ['Acetaminophen', 'generic']]),
  product('paracetamol-120mg5ml-liquid', 'Paracetamol', 'medicine', 'oral-liquid', [['paracetamol', 120, 'mg/5ml']], [['Calpol', 'brand']]),
  product('ibuprofen-200mg-tablet', 'Ibuprofen', 'medicine', 'tablet', [['ibuprofen', 200, 'mg']], [['Nurofen', 'brand']]),
  product('ibuprofen-400mg-tablet', 'Ibuprofen', 'medicine', 'tablet', [['ibuprofen', 400, 'mg']], [['Nurofen', 'brand']]),
  product('ferrous-sulfate-200mg-tablet', 'Ferrous sulfate', 'supplement', 'tablet', [['ferrous-sulfate', 200, 'mg']], [['Iron tablets', 'generic'], ['Ferrous sulphate', 'generic']]),
  product('ferrous-fumarate-210mg-tablet', 'Ferrous fumarate', 'supplement', 'tablet', [['ferrous-fumarate', 210, 'mg']], [['Iron tablets', 'generic'], ['Galfer', 'brand']]),
  product('calcium-vitd-chewable', 'Calcium carbonate and colecalciferol', 'supplement', 'chewable-tablet', [['calcium-carbonate', 1.5, 'g'], ['colecalciferol', 400, 'unit']], [['Adcal-D3', 'brand'], ['Calcium and vitamin D', 'generic']]),
  product('colecalciferol-1000unit-tablet', 'Colecalciferol', 'supplement', 'tablet', [['colecalciferol', 1000, 'unit']], [['Vitamin D3', 'generic'], ['Vitamin D', 'generic'], ['Cholecalciferol', 'generic']]),
  product('folic-acid-400mcg-tablet', 'Folic acid', 'supplement', 'tablet', [['folic-acid', 400, 'microgram']], [['Folate', 'generic']]),
  product('cod-liver-oil-softgel', 'Cod liver oil', 'supplement', 'softgel', [['cod-liver-oil', 1000, 'mg']], [['Seven Seas', 'brand'], ['Omega-3', 'generic']]),
  product('multivitamin-tablet', 'Multivitamins', 'supplement', 'tablet', [['multivitamin', 1, 'unit']], [['Centrum', 'brand'], ['A to Z multivitamin', 'generic']]),
  product('magnesium-375mg-tablet', 'Magnesium', 'supplement', 'tablet', [['magnesium', 375, 'mg']], [['Magnesium citrate', 'generic']]),
];

export function findProduct(id: string | undefined): CatalogueProduct | undefined {
  return CATALOGUE.find(item => item.id === id);
}

export function ingredientCodes(item: CatalogueProduct): string[] {
  return item.ingredients.map(ingredient => ingredient.code);
}

/** Display text such as "50 micrograms" or "1.5g + 400 units". */
export function formatStrength(item: CatalogueProduct): string {
  if (item.ingredients[0]?.code === 'multivitamin') return '';
  return item.ingredients.map(({ strength: { value, unit } }) => {
    if (unit === 'microgram') return `${value} microgram${value === 1 ? '' : 's'}`;
    if (unit === 'unit') return `${value.toLocaleString('en-GB')} unit${value === 1 ? '' : 's'}`;
    return `${value}${unit}`;
  }).join(' + ');
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  product: CatalogueProduct;
  /** The alias that matched, when it was not the product name. */
  matchedAlias?: { name: string; type: 'brand' | 'generic' };
  score: number;
}

const normalise = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Optimal string alignment distance, which counts a swapped pair of letters as one edit. */
export function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

function allowedEdits(length: number) {
  return length < 4 ? 0 : length < 7 ? 1 : 2;
}

/** How well one query word matches a name: 3 exact, 2 prefix, 1 close spelling, 0 none. */
function wordScore(word: string, name: string): number {
  const words = name.split(' ');
  let best = 0;
  for (const candidate of words) {
    if (candidate === word) return 3;
    if (candidate.startsWith(word)) best = Math.max(best, 2);
    else if (allowedEdits(word.length) > 0) {
      // Compare with the start of the candidate too, so partial misspellings still match.
      const prefix = candidate.slice(0, Math.max(word.length, Math.min(candidate.length, word.length + 1)));
      const distance = Math.min(editDistance(word, candidate), editDistance(word, prefix));
      if (distance <= allowedEdits(word.length)) best = Math.max(best, 1);
    }
  }
  return best;
}

function nameScore(words: string[], name: string): number {
  const normalised = normalise(name);
  if (normalised.startsWith(words.join(' '))) return 10 + words.length;
  let total = 0;
  for (const word of words) {
    const score = wordScore(word, normalised);
    if (!score) return 0;
    total += score;
  }
  return total;
}

/**
 * Suggests products for a partial, misspelt, generic or brand name. Numbers in
 * the query narrow results to a matching strength. Results never carry a dose
 * or instructions; the patient supplies those.
 */
export function searchCatalogue(query: string, limit = 6): SearchResult[] {
  const words = normalise(query).split(' ').filter(Boolean);
  const numbers = words.filter(word => /^\d/.test(word)).map(word => parseFloat(word));
  const text = words.filter(word => !/^\d/.test(word));
  if (!text.length || text.join('').length < 2) return [];

  const results: SearchResult[] = [];
  for (const item of CATALOGUE) {
    if (numbers.length && !numbers.every(number => item.ingredients.some(({ strength }) => strength.value === number))) continue;
    let best: SearchResult | undefined;
    const names = [{ name: item.name, alias: undefined }, ...item.aliases.map(alias => ({ name: alias.name, alias }))];
    for (const { name, alias } of names) {
      // Prefer the product's own name when it matches as well as an alias.
      const score = nameScore(text, name) - (alias ? 0.5 : 0);
      if (score > 0 && (!best || score > best.score)) best = { product: item, matchedAlias: alias, score };
    }
    if (best) results.push(best);
  }
  return results
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name) || a.product.ingredients[0].strength.value - b.product.ingredients[0].strength.value)
    .slice(0, limit);
}
