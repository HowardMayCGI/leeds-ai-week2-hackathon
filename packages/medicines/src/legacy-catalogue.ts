/**
 * The earlier local product list, kept for the schedule proposal API
 * (`apps/api/src/schedule-service.ts`), which accepts these local product
 * IDs alongside dm+d codes. The app itself now builds its medicine options
 * from the patient records (see `catalogue.ts`). Identifiers are local and
 * not verified mappings to dm+d. Ingredient codes are the first word of each
 * ingredient, as the administration rules are keyed.
 */
export const CATALOGUE_VERSION = 'poc-2026-10-24';

type LegacyForm = 'tablet' | 'capsule' | 'chewable-tablet' | 'soluble-tablet' | 'oral-liquid' | 'softgel';

interface LegacyStrength {
  value: number;
  unit: 'mg' | 'microgram' | 'g' | 'unit' | 'mg/5ml';
}

export interface LegacyProduct {
  id: string;
  name: string;
  kind: 'medicine' | 'supplement';
  form: LegacyForm;
  ingredients: { code: string; strength: LegacyStrength }[];
  aliases: { name: string; type: 'brand' | 'generic' }[];
}

const product = (
  id: string, name: string, kind: LegacyProduct['kind'], form: LegacyForm, ingredients: [string, number, LegacyStrength['unit']][],
  aliases: [string, 'brand' | 'generic'][] = [],
): LegacyProduct => ({
  id, name, kind, form,
  ingredients: ingredients.map(([code, value, unit]) => ({ code: code.split('-')[0], strength: { value, unit } })),
  aliases: aliases.map(([alias, type]) => ({ name: alias, type })),
});

const PRODUCTS: LegacyProduct[] = [
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

export function findProduct(id: string | undefined): LegacyProduct | undefined {
  return PRODUCTS.find(item => item.id === id);
}

export function ingredientCodes(item: LegacyProduct): string[] {
  return item.ingredients.map(ingredient => ingredient.code);
}

/** Display text such as "50 micrograms" or "1.5g + 400 units". */
export function formatStrength(item: LegacyProduct): string {
  if (item.ingredients[0]?.code === 'multivitamin') return '';
  return item.ingredients.map(({ strength: { value, unit } }) => {
    if (unit === 'microgram') return `${value} microgram${value === 1 ? '' : 's'}`;
    if (unit === 'unit') return `${value.toLocaleString('en-GB')} unit${value === 1 ? '' : 's'}`;
    return `${value}${unit}`;
  }).join(' + ');
}
