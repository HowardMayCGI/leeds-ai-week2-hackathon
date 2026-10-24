export interface RandomNumberResponse {
  number: number;
}

export function isRandomNumberResponse(value: unknown): value is RandomNumberResponse {
  if (typeof value !== 'object' || value === null || !('number' in value)) return false;
  return typeof value.number === 'number' && Number.isInteger(value.number) && value.number >= 1 && value.number <= 100;
}

export interface PatientSummary {
  nhsNumber: string;
  name: string;
}

export interface PatientListResponse {
  patients: PatientSummary[];
}

export interface PatientDemographics {
  nhsNumber: string;
  name: { prefix?: string; given: string[]; family: string; text: string };
  birthDate?: string;
  gender?: string;
  phone?: string;
  address?: { lines: string[]; city?: string; postalCode?: string };
}

export interface MedicationDose {
  value: number;
  unit?: string;
}

export interface MedicationFrequency {
  /** Number of doses per period, e.g. 2 per 1 day. */
  frequency: number;
  period: number;
  /** FHIR UnitsOfTime code: s, min, h, d, wk, mo, a. */
  periodUnit: string;
}

/** A current (active) medicine, derived from a FHIR R4 MedicationRequest. */
export interface Medication {
  id: string;
  /** Medicine name, e.g. "Clopidogrel 75mg tablets". */
  name: string;
  /** SNOMED CT / dm+d code. */
  code?: string;
  system?: string;
  dose?: MedicationDose;
  frequency?: MedicationFrequency;
  asNeeded: boolean;
  instructions: string[];
  prescribedOn?: string;
  prescriber?: string;
  organisation?: string;
}

export interface MedicationsResponse {
  nhsNumber: string;
  medications: Medication[];
}

export const NHS_NUMBER_PATTERN = /^\d{10}$/;
