// Rewrites US drug names/brands to UK names in MedicationRequest and MedicationAdministration
// resources. Usage: pnpm exec tsx scripts/ukify-medication-names.ts [--dry-run] <file.json> [...]
import { readFileSync, writeFileSync } from 'node:fs';

// Order matters: more specific patterns first.
const REPLACEMENTS: [RegExp, string][] = [
  [/\bPenicillin V Potassium\b/gi, 'Phenoxymethylpenicillin'],
  [/\bPenicillin G\b/gi, 'Benzylpenicillin'],
  [/\bAcetaminophen\b/gi, 'Paracetamol'],
  [/\bAlbuterol\b/gi, 'Salbutamol'],
  [/\bMeperidine\b/gi, 'Pethidine'],
  [/\bNitroglycerin\b/gi, 'Glyceryl trinitrate'],
  [/\bChlorpheniramine\b/gi, 'Chlorphenamine'],
  [/\[Tylenol\]/g, '[Panadol]'],
  [/\[ProAir\]/g, '[Ventolin]'],
  [/\[Flovent\]/g, '[Flixotide]'],
  [/\[Epogen\]/g, '[Eprex]'],
  [/\bNDA\d+ /g, ''], // US FDA application number prefix
];

const TARGET_TYPES = new Set(['MedicationRequest', 'MedicationAdministration']);

function ukify(text: string): string {
  let out = text;
  for (const [re, to] of REPLACEMENTS) {
    out = out.replace(re, (m) => (m[0] === m[0].toLowerCase() && /[a-z]/.test(m[0]) ? to.toLowerCase() : to));
  }
  return out;
}

const changes = new Map<string, string>();

function walk(node: unknown, inTarget: boolean) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, inTarget));
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const target = inTarget || TARGET_TYPES.has(obj.resourceType as string);
  for (const [k, v] of Object.entries(obj)) {
    if (target && (k === 'display' || k === 'text') && typeof v === 'string') {
      const next = ukify(v);
      if (next !== v) {
        obj[k] = next;
        changes.set(v, next);
      }
    } else {
      walk(v, target);
    }
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const files = args.filter((a) => a !== '--dry-run');
if (files.length === 0) {
  console.error('Usage: tsx scripts/ukify-medication-names.ts [--dry-run] <file.json> [...]');
  process.exit(1);
}

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const json = JSON.parse(raw);
  walk(json, false);
  if (dryRun) continue;
  // Preserve each file's existing layout (pretty-printed vs single line)
  const pretty = raw.startsWith('{\n');
  const out = JSON.stringify(json, null, pretty ? 2 : undefined) + (raw.endsWith('\n') ? '\n' : '');
  if (out !== raw) writeFileSync(file, out);
}

console.table([...changes].map(([from, to]) => ({ from, to })));
console.log(`${changes.size} distinct name(s) ${dryRun ? 'would be ' : ''}changed`);
