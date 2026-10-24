import {
  isMedicationsResponse, isMedicineListResponse, isPatientListResponse,
  type PatientSummary,
} from '@hackathon/api-contract';
import { medicineOptions, toRecordMedicine, type MedicineOption, type RecordMedicine } from '@hackathon/medicines';

async function getJson<T>(path: string, valid: (value: unknown) => value is T, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  const body: unknown = await response.json();
  if (!valid(body)) throw new Error(`${path} returned an unexpected response`);
  return body;
}

/** Test records mark family names with "XXTESTPATIENT-"; people see the name without it. */
export function displayName(name: string): string {
  return name.replace(/XXTESTPATIENT-/g, '').replace(/\s+/g, ' ').trim();
}

export async function fetchPatients(signal?: AbortSignal): Promise<PatientSummary[]> {
  return (await getJson('/api/patients', isPatientListResponse, signal)).patients;
}

export interface PatientData {
  record: RecordMedicine[];
  options: MedicineOption[];
}

/** One patient's current medicines, and the medicines across all patients that search suggests. */
export async function fetchPatientData(nhsNumber: string, signal?: AbortSignal): Promise<PatientData> {
  const [medications, medicines] = await Promise.all([
    getJson(`/api/patients/${encodeURIComponent(nhsNumber)}/medications`, isMedicationsResponse, signal),
    getJson('/api/medicines', isMedicineListResponse, signal),
  ]);
  const record = medications.medications.map(toRecordMedicine).sort((a, b) => a.medicine.name.localeCompare(b.medicine.name) || a.medicine.recordName.localeCompare(b.medicine.recordName));
  return { record, options: medicineOptions(medicines.medicines) };
}
