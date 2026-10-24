// Builds test_data/patients.json, a map of NHS number -> bundle file name.
// Usage: pnpm exec tsx scripts/build-patient-index.ts [dir]   (default: test_data)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NHS_NUMBER_SYSTEM = 'https://fhir.nhs.uk/Id/nhs-number';
const dir = process.argv[2] ?? 'test_data';
const index: Record<string, string> = {};

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'patients.json').sort()) {
  const bundle = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const patient = bundle.entry?.find((e: any) => e.resource?.resourceType === 'Patient')?.resource;
  const nhsNumber = patient?.identifier?.find((i: any) => i.system === NHS_NUMBER_SYSTEM)?.value;
  if (!nhsNumber) {
    console.warn(`Skipping ${file}: no NHS number`);
    continue;
  }
  index[nhsNumber] = file;
}

writeFileSync(join(dir, 'patients.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`${Object.keys(index).length} patients -> ${join(dir, 'patients.json')}`);
