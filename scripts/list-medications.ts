// Usage: pnpm exec tsx scripts/list-medications.ts <file.json> [more files...]
import { readFileSync } from 'node:fs';

interface Row {
  file: string;
  id: string;
  medicine: string;
  code: string;
  status: string;
  authoredOn: string;
}

// Equivalent of JSONPath `$..[?(@.resourceType=='MedicationRequest')]`
function findResources(node: unknown, resourceType: string, out: Record<string, any>[] = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => findResources(n, resourceType, out));
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, any>;
    if (obj.resourceType === resourceType) out.push(obj);
    Object.values(obj).forEach((v) => findResources(v, resourceType, out));
  }
  return out;
}

function toRow(file: string, r: Record<string, any>): Row {
  const cc = r.medicationCodeableConcept;
  const coding = cc?.coding?.[0];
  return {
    file: file.split('/').pop() ?? file,
    id: r.id ?? '',
    medicine: cc?.text ?? coding?.display ?? r.medicationReference?.display ?? '(unknown)',
    code: coding?.code ?? '',
    status: r.status ?? '',
    authoredOn: (r.authoredOn ?? '').slice(0, 10),
  };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: tsx scripts/list-medications.ts <file.json> [more files...]');
  process.exit(1);
}

const rows: Row[] = [];
for (const file of files) {
  try {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    findResources(json, 'MedicationRequest').forEach((r) => rows.push(toRow(file, r)));
  } catch (e) {
    console.error(`Skipping ${file}: ${(e as Error).message}`);
  }
}

console.table(rows);
console.log(`${rows.length} MedicationRequest resource(s) in ${files.length} file(s)`);
