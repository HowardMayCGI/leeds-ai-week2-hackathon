// Usage: pnpm exec tsx scripts/list-medications.ts [--dose <text>] [--nhs-number <number>] [--csv] [--unique] <file.json> [more files...]
import { readFileSync } from 'node:fs';

interface Row {
  medicine: string;
  code: string;
  system: string;
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

function toRow(r: Record<string, any>): Row {
  const cc = r.medicationCodeableConcept;
  const coding = cc?.coding?.[0];
  return {
    medicine: cc?.text ?? coding?.display ?? r.medicationReference?.display ?? '(unknown)',
    code: coding?.code ?? '',
    system: coding?.system ?? '',
  };
}

const USAGE =
  'Usage: tsx scripts/list-medications.ts [--dose <text>] [--nhs-number <number>] [--csv] [--unique] <file.json> [more files...]';
const files: string[] = [];
let dose: string | undefined;
let nhsNumber: string | undefined;
let csv = false;
let unique = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dose') dose = args[++i];
  else if (args[i] === '--nhs-number') nhsNumber = args[++i]?.replace(/\s/g, '');
  else if (args[i] === '--csv') csv = true;
  else if (args[i] === '--unique') unique = true;
  else files.push(args[i]);
}
if (files.length === 0 || dose === '' || nhsNumber === '') {
  console.error(USAGE);
  process.exit(1);
}

// Dose matches against dosageInstruction text (case-insensitive substring)
const matchesDose = (r: Record<string, any>) =>
  !dose ||
  (r.dosageInstruction ?? []).some((d: any) =>
    JSON.stringify(d).toLowerCase().includes(dose!.toLowerCase()),
  );

const matchesNhsNumber = (r: Record<string, any>, patientNumbers: Set<string>) => {
  if (!nhsNumber) return true;
  const own = r.subject?.identifier?.value?.replace(/\s/g, '');
  return own ? own === nhsNumber : patientNumbers.has(nhsNumber);
};

const rows: Row[] = [];
for (const file of files) {
  try {
    const json = JSON.parse(readFileSync(file, 'utf8'));
    const patientNumbers = new Set<string>(
      findResources(json, 'Patient').flatMap((p) =>
        (p.identifier ?? []).map((i: any) => String(i.value ?? '').replace(/\s/g, '')),
      ),
    );
    findResources(json, 'MedicationRequest')
      .filter((r) => matchesDose(r) && matchesNhsNumber(r, patientNumbers))
      .forEach((r) => rows.push(toRow(r)));
  } catch (e) {
    console.error(`Skipping ${file}: ${(e as Error).message}`);
  }
}

const output = unique
  ? rows.filter(
      (r, i) => rows.findIndex((o) => o.medicine === r.medicine && o.code === r.code && o.system === r.system) === i,
    )
  : rows;

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
if (csv) {
  console.log('medicine,code,system');
  output.forEach((r) => console.log([r.medicine, r.code, r.system].map(esc).join(',')));
} else {
  console.table(output);
}
