/**
 * Medicine options built from the medicines in patient records, so search
 * only suggests medicines that appear in the data. Each option keeps the
 * record's code (SNOMED CT or dm+d) and its product description, and adds a
 * patient-friendly name, strength and form parsed from that description.
 */
export type Form = 'tablet' | 'capsule' | 'inhaler' | 'spray' | 'patch' | 'nebuliser' | 'injection' | 'oral-liquid';

export interface Alias {
  name: string;
  type: 'brand' | 'generic';
}

export interface MedicineOption {
  /** The record's code when it has one, so the same product is one option. */
  id: string;
  code?: string;
  system?: string;
  /** A short name such as "Naproxen" or "Paracetamol and codeine phosphate". */
  name: string;
  /** The size of one tablet, capsule or measure, such as "250mg". */
  strength?: string;
  form: Form;
  /** Lower-case first word of each active ingredient, used to look up administration rules. */
  ingredients: string[];
  /** The product description as recorded, such as "Naproxen 250mg tablets". */
  recordName: string;
  /** Other names patients may search for. Search helpers only, not verified mappings. */
  aliases: Alias[];
}

/** The parts of a recorded medicine that options are built from. */
export interface SourceMedicine {
  id?: string;
  code?: string;
  system?: string;
  name: string;
}

// Other names patients use, keyed by the option's ingredients joined with "+".
const ALIASES: Record<string, [string, Alias['type']][]> = {
  'paracetamol+codeine': [['Co-codamol', 'generic']],
  paracetamol: [['Panadol', 'brand'], ['Acetaminophen', 'generic']],
  'fluticasone+salmeterol': [['Seretide', 'brand']],
  alendronic: [['Fosamax', 'brand'], ['Alendronate', 'generic']],
  amlodipine: [['Istin', 'brand']],
  atenolol: [['Tenormin', 'brand']],
  atorvastatin: [['Lipitor', 'brand']],
  budesonide: [['Pulmicort', 'brand']],
  clopidogrel: [['Plavix', 'brand']],
  digoxin: [['Lanoxin', 'brand']],
  diphenhydramine: [['Nytol', 'brand']],
  fentanyl: [['Durogesic', 'brand']],
  ferrous: [['Iron tablets', 'generic'], ['Ferrous sulphate', 'generic']],
  glyceryl: [['GTN spray', 'generic'], ['Nitroglycerin', 'generic']],
  levothyroxine: [['Thyroxine', 'generic']],
  lisinopril: [['Zestril', 'brand']],
  metoprolol: [['Lopresor', 'brand']],
  morphine: [['Zomorph', 'brand']],
  naproxen: [['Naprosyn', 'brand']],
  oxycodone: [['OxyNorm', 'brand']],
  oxycontin: [['Oxycodone', 'generic']],
  pethidine: [['Meperidine', 'generic']],
  prasugrel: [['Efient', 'brand']],
  salbutamol: [['Ventolin', 'brand'], ['Albuterol', 'generic']],
  simvastatin: [['Zocor', 'brand']],
  tramadol: [['Zydol', 'brand']],
};

const STRENGTH = /(\d+(?:[.,]\d+)?)\s*(mg|micrograms?|mcg|g|units?|unt|ml)\b(?:\s*\/\s*(dose|ml|hour|hr|h)\b)?/i;

const FORMS: [RegExp, Form][] = [
  [/inhaler/, 'inhaler'], [/spray/, 'spray'], [/patch/, 'patch'], [/nebuli[sz]er/, 'nebuliser'], [/inject/, 'injection'],
  [/capsule/, 'capsule'], [/tablet/, 'tablet'], [/liquid|solution|suspension|syrup/, 'oral-liquid'],
];

function formatComponentStrength(match: RegExpExecArray): string {
  const value = Number(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  const per = match[3]?.toLowerCase();
  const amount = unit === 'mg' || unit === 'g' || unit === 'ml' ? `${value}${unit}`
    : unit.startsWith('microgram') || unit === 'mcg' ? `${value} microgram${value === 1 ? '' : 's'}`
      : `${value} unit${value === 1 ? '' : 's'}`;
  if (!per) return amount;
  if (per === 'dose') return `${amount} per dose`;
  if (per === 'ml') return `${amount}/ml`;
  return `${amount} an hour`;
}

/** "amLODIPine" and "Insulin Lispro" become "Amlodipine" and "Insulin lispro"; a brand such as "OxyContin" stays as it is. */
function tidyName(text: string, first: boolean): string {
  return text.split(/\s+/).filter(Boolean).map((word, index) => {
    if (index > 0 || !first) return word.toLowerCase();
    return /^[a-z]/.test(word) || word === word.toUpperCase() ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;
  }).join(' ');
}

const ingredientCode = (name: string) => name.toLowerCase().split(/[\s-]+/)[0];

export interface ParsedName {
  name: string;
  strength?: string;
  /** Each number in the strength, used to narrow a search such as "naproxen 500". */
  strengthValues: number[];
  form: Form;
  ingredients: string[];
  brand?: string;
}

/** Reads a short name, strength and form from a product description such as "Naproxen 250mg tablets". */
export function parseMedicineName(description: string): ParsedName {
  const brand = /\[([^\]]+)\]/.exec(description)?.[1]?.trim();
  const text = description.replace(/\[[^\]]*\]/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const form = FORMS.find(([pattern]) => pattern.test(lower))?.[1] ?? 'tablet';

  // Combination products separate their ingredients with a spaced slash.
  const parts = text.split(/\s+\/\s+/);
  const names: string[] = [];
  const strengths: string[] = [];
  const strengthValues: number[] = [];
  for (const part of parts) {
    const match = STRENGTH.exec(part);
    const name = (match ? part.slice(0, match.index) : part.replace(/\b(oral|tablets?|capsules?)\b.*$/i, '')).trim();
    if (name) names.push(name);
    if (match) {
      strengths.push(formatComponentStrength(match));
      strengthValues.push(Number(match[1].replace(',', '.')));
    }
  }
  if (!names.length) names.push(text);
  const name = names.map((part, index) => tidyName(part, index === 0)).join(' and ');
  return {
    name: brand ? `${name} (${brand})` : name,
    strength: strengths.length ? strengths.join(' + ') : undefined,
    strengthValues,
    form,
    ingredients: names.map(ingredientCode),
    brand,
  };
}

export function toMedicineOption(source: SourceMedicine): MedicineOption {
  const parsed = parseMedicineName(source.name);
  const aliases: Alias[] = (ALIASES[parsed.ingredients.join('+')] ?? []).map(([name, type]) => ({ name, type }));
  if (parsed.brand && !aliases.some(alias => alias.name === parsed.brand)) aliases.unshift({ name: parsed.brand, type: 'brand' });
  return {
    id: source.code ?? `name:${source.name.toLowerCase()}`,
    code: source.code,
    system: source.system,
    name: parsed.name,
    strength: parsed.strength,
    form: parsed.form,
    ingredients: parsed.ingredients,
    recordName: source.name,
    aliases,
  };
}

/** One option per product, in name order. */
export function medicineOptions(sources: SourceMedicine[]): MedicineOption[] {
  const byId = new Map<string, MedicineOption>();
  for (const source of sources) {
    const option = toMedicineOption(source);
    if (!byId.has(option.id)) byId.set(option.id, option);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name) || strengthOf(a) - strengthOf(b));
}

function strengthOf(option: MedicineOption): number {
  return parseMedicineName(option.recordName).strengthValues[0] ?? 0;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  option: MedicineOption;
  /** The alias that matched, when it was not the option's name. */
  matchedAlias?: Alias;
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
 * Suggests options for a partial, misspelt, generic or brand name. Numbers in
 * the query narrow results to a matching strength. Results never carry a dose
 * or instructions; the patient supplies those.
 */
export function searchMedicines(options: MedicineOption[], query: string, limit = 6): SearchResult[] {
  const numbers = [...query.matchAll(/\d+(?:[.,]\d+)?/g)].map(match => Number(match[0].replace(',', '.')));
  const text = normalise(query.replace(/\d+(?:[.,]\d+)?\s*(mg|mcg|micrograms?|g|ml|units?)?/gi, ' ')).split(' ').filter(Boolean);
  if (!text.length || text.join('').length < 2) return [];

  const results: SearchResult[] = [];
  for (const option of options) {
    if (numbers.length) {
      const values = parseMedicineName(option.recordName).strengthValues;
      if (!numbers.every(number => values.includes(number))) continue;
    }
    let best: SearchResult | undefined;
    const names = [{ name: option.name, alias: undefined }, ...option.aliases.map(alias => ({ name: alias.name, alias }))];
    for (const { name, alias } of names) {
      // Prefer the option's own name when it matches as well as an alias.
      const score = nameScore(text, name) - (alias ? 0.5 : 0);
      if (score > 0 && (!best || score > best.score)) best = { option, matchedAlias: alias, score };
    }
    if (best) results.push(best);
  }
  return results
    .sort((a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name) || strengthOf(a.option) - strengthOf(b.option))
    .slice(0, limit);
}
