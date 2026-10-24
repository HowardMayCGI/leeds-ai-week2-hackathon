import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Medication, MedicationsResponse, MedicineListResponse, PatientDemographics, PatientListResponse } from '@hackathon/api-contract';

const NHS_NUMBER_SYSTEM = 'https://fhir.nhs.uk/Id/nhs-number';
const INDEX_FILE = 'patients.json';

export interface PatientRepository {
  listPatients(): Promise<PatientListResponse>;
  getDemographics(nhsNumber: string): Promise<PatientDemographics | undefined>;
  getMedications(nhsNumber: string): Promise<MedicationsResponse | undefined>;
  /** Every distinct current medicine across all patients, for search suggestions. */
  listMedicines(): Promise<MedicineListResponse>;
}

type Resource = Record<string, any>;

export function toDemographics(patient: Resource): PatientDemographics {
  const name = patient.name?.find((n: Resource) => n.use === 'official') ?? patient.name?.[0] ?? {};
  const given: string[] = name.given ?? [];
  const family: string = name.family ?? '';
  const address = patient.address?.[0];
  return {
    nhsNumber: patient.identifier?.find((i: Resource) => i.system === NHS_NUMBER_SYSTEM)?.value,
    name: { prefix: name.prefix?.[0], given, family, text: [...given, family].filter(Boolean).join(' ') },
    birthDate: patient.birthDate,
    gender: patient.gender,
    phone: patient.telecom?.find((t: Resource) => t.system === 'phone')?.value,
    address: address && { lines: address.line ?? [], city: address.city, postalCode: address.postalCode },
  };
}

/** Maps a FHIR MedicationRequest to the API's Medication shape. Works with R4 `doseAndRate` and the flat `doseQuantity` in the test data. */
export function toMedication(request: Resource): Medication {
  const concept = request.medicationCodeableConcept;
  const coding = concept?.coding?.[0];
  const dosage = request.dosageInstruction?.[0] ?? {};
  const quantity = dosage.doseAndRate?.[0]?.doseQuantity ?? dosage.doseQuantity;
  const repeat = dosage.timing?.repeat;
  return {
    id: request.id,
    name: concept?.text ?? coding?.display ?? 'Unknown medicine',
    code: coding?.code,
    system: coding?.system,
    dose: typeof quantity?.value === 'number' ? { value: quantity.value, unit: quantity.unit } : undefined,
    frequency: repeat?.frequency
      ? { frequency: repeat.frequency, period: repeat.period ?? 1, periodUnit: repeat.periodUnit ?? 'd' }
      : undefined,
    asNeeded: dosage.asNeededBoolean === true,
    instructions: (dosage.additionalInstruction ?? []).map((i: Resource) => i.text ?? i.coding?.[0]?.display).filter(Boolean),
    prescribedOn: request.authoredOn,
    prescriber: request.requester?.agent?.display ?? request.requester?.display,
    organisation: request.requester?.onBehalfOf?.display,
  };
}

/** Reads FHIR bundles from a directory, using `patients.json` (NHS number -> file name) to find them. */
export function createFilePatientRepository(dataDirectory: string): PatientRepository {
  let indexPromise: Promise<Record<string, string>> | undefined;
  const bundles = new Map<string, Promise<Resource[]>>();

  const readIndex = () => (indexPromise ??= readFile(join(dataDirectory, INDEX_FILE), 'utf8').then(JSON.parse));

  async function resources(nhsNumber: string): Promise<Resource[] | undefined> {
    const index = await readIndex();
    if (!Object.hasOwn(index, nhsNumber)) return undefined;
    const file = index[nhsNumber];
    if (!bundles.has(file)) {
      bundles.set(file, readFile(join(dataDirectory, file), 'utf8').then((text) => JSON.parse(text).entry.map((e: Resource) => e.resource)));
    }
    return bundles.get(file);
  }

  const patientOf = (all: Resource[]) => all.find((r) => r.resourceType === 'Patient')!;

  const repository: PatientRepository = {
    async listPatients() {
      const index = await readIndex();
      const patients = await Promise.all(
        Object.keys(index).map(async (nhsNumber) => ({ nhsNumber, name: toDemographics(patientOf((await resources(nhsNumber))!)).name.text })),
      );
      return { patients: patients.sort((a, b) => a.name.localeCompare(b.name)) };
    },
    async getDemographics(nhsNumber) {
      const all = await resources(nhsNumber);
      return all && toDemographics(patientOf(all));
    },
    async getMedications(nhsNumber) {
      const all = await resources(nhsNumber);
      if (!all) return undefined;
      // Repeat prescriptions share a code; keep the most recent of each.
      const latest = new Map<string, Medication>();
      for (const m of all
        .filter((r) => r.resourceType === 'MedicationRequest' && r.status === 'active' && r.intent === 'order')
        .map(toMedication)) {
        const key = m.code ?? m.id;
        if (!latest.has(key) || (m.prescribedOn ?? '') > (latest.get(key)!.prescribedOn ?? '')) latest.set(key, m);
      }
      const medications = [...latest.values()].sort((a, b) => a.name.localeCompare(b.name));
      return { nhsNumber, medications };
    },
    async listMedicines() {
      const index = await readIndex();
      const byKey = new Map<string, MedicineListResponse['medicines'][number]>();
      for (const nhsNumber of Object.keys(index)) {
        for (const { name, code, system } of (await repository.getMedications(nhsNumber))?.medications ?? []) {
          const key = code ?? name.toLowerCase();
          if (!byKey.has(key)) byKey.set(key, { name, code, system });
        }
      }
      return { medicines: [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })) };
    },
  };
  return repository;
}

/** PATIENT_DATA_DIR overrides the default of `test_data` beside the working directory (the Lambda bundle root). */
export function defaultDataDirectory(): string {
  return process.env.PATIENT_DATA_DIR ?? join(process.cwd(), 'test_data');
}
