// Extracts the distinct medicines (coding + dosage shape) used in FHIR bundles.
// Usage: pnpm exec tsx scripts/extract-medicines.ts <out.json> <file.json> [...]
import { readFileSync, writeFileSync } from 'node:fs';

const [out, ...files] = process.argv.slice(2);
if (!out || files.length === 0) {
  console.error('Usage: tsx scripts/extract-medicines.ts <out.json> <file.json> [...]');
  process.exit(1);
}

const TYPES = ['MedicationRequest', 'MedicationAdministration'];
const meds = new Map<string, any>();

function walk(node: any) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== 'object') return;
  if (TYPES.includes(node.resourceType)) {
    const coding = node.medicationCodeableConcept?.coding?.[0] ?? {};
    const key = `${coding.system}|${coding.code}`;
    const m = meds.get(key) ?? {
      system: coding.system,
      code: coding.code,
      display: coding.display,
      count: 0,
      resourceTypes: new Set<string>(),
      doseUnits: new Set<string>(),
      timings: new Set<string>(),
    };
    m.count++;
    m.resourceTypes.add(node.resourceType);
    for (const d of node.dosageInstruction ?? []) {
      const q = d.doseQuantity ?? d.doseAndRate?.[0]?.doseQuantity;
      m.doseUnits.add(q?.unit ?? '(none)');
      const r = d.timing?.repeat;
      if (r) m.timings.add(`${r.frequency}/${r.period}${r.periodUnit}`);
    }
    if (node.dosage?.dose) m.doseUnits.add(node.dosage.dose.unit ?? '(none)');
    meds.set(key, m);
  }
  Object.values(node).forEach(walk);
}

files.forEach((f) => walk(JSON.parse(readFileSync(f, 'utf8'))));

const rows = [...meds.values()]
  .map((m) => ({ ...m, resourceTypes: [...m.resourceTypes], doseUnits: [...m.doseUnits], timings: [...m.timings] }))
  .sort((a, b) => String(a.display).localeCompare(String(b.display)));
writeFileSync(out, JSON.stringify(rows, null, 2) + '\n');
console.log(`${rows.length} distinct medicines -> ${out}`);
