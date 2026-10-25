export interface RandomNumberResponse {
  number: number;
}

export interface JokeResponse {
  joke: string;
}

export function isJokeResponse(value: unknown): value is JokeResponse {
  return typeof value === "object" && value !== null && "joke" in value &&
    typeof value.joke === "string" && value.joke.trim().length > 0;
}

export function isRandomNumberResponse(value: unknown): value is RandomNumberResponse {
  if (typeof value !== "object" || value === null || !("number" in value)) return false;
  return (
    typeof value.number === "number" &&
    Number.isInteger(value.number) &&
    value.number >= 1 &&
    value.number <= 100
  );
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
  /** Original FHIR dosage instructions, including text and fields not normalised by this demo. */
  dosageInstructions?: Record<string, unknown>[];
}

export interface MedicationsResponse {
  nhsNumber: string;
  medications: Medication[];
}

/** A medicine product that appears in at least one patient's current medicines. */
export interface MedicineSummary {
  name: string;
  code?: string;
  system?: string;
}

export interface MedicineListResponse {
  medicines: MedicineSummary[];
}

export function isPatientListResponse(value: unknown): value is PatientListResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as PatientListResponse).patients)
  )
    return false;
  return (value as PatientListResponse).patients.every(
    (patient) => typeof patient?.nhsNumber === "string" && typeof patient.name === "string",
  );
}

export function isMedicationsResponse(value: unknown): value is MedicationsResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as MedicationsResponse).medications)
  )
    return false;
  return (value as MedicationsResponse).medications.every(
    (medication) =>
      typeof medication?.id === "string" &&
      typeof medication.name === "string" &&
      typeof medication.asNeeded === "boolean" &&
      Array.isArray(medication.instructions),
  );
}

export function isMedicineListResponse(value: unknown): value is MedicineListResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as MedicineListResponse).medicines)
  )
    return false;
  return (value as MedicineListResponse).medicines.every(
    (medicine) => typeof medicine?.name === "string",
  );
}

export const NHS_NUMBER_PATTERN = /^\d{10}$/;

/** Actions are independent of severity: a serious interaction is not necessarily a contraindication. */
export type InteractionManagement =
  | {
      action: "separate_doses";
      minimumGapMinutes: number;
      direction: "either_order";
      guidance: string;
    }
  | { action: "prescriber_review"; guidance: string }
  | {
      action: "dose_review";
      ingredientId: string;
      maximumDailyDose: { value: number; unit: "mg" };
      guidance: string;
    };

export interface InteractionRule {
  id: string;
  /** Unordered ingredient pair; mechanisms and management may still be directional. */
  ingredients: [string, string];
  severity: "moderate" | "major";
  mechanism: "pharmacokinetic" | "pharmacodynamic";
  effect: string;
  patientGuidance: string;
  management: InteractionManagement;
  sourceIds: string[];
}

export interface InteractionDataset {
  version: string;
  demoOnly: true;
  clinicallyValidated: false;
  compiledOn: string;
  ingredients: { id: string; name: string }[];
  products: {
    code: string;
    system: string;
    name: string;
    ingredientIds: string[];
    route: string;
  }[];
  sources: { id: string; title: string; url: string; accessedOn: string }[];
  interactions: InteractionRule[];
}

export interface MatchedInteraction extends InteractionRule {
  ruleId: string;
  medications: [Medication, Medication];
}

export interface InteractionsResponse {
  nhsNumber: string;
  datasetVersion: string;
  demoOnly: true;
  clinicallyValidated: false;
  assessment: "potential_interactions_from_record";
  /** Never means safe: this is a deliberately incomplete example dataset. */
  coverage: "limited_demo_rules";
  notice: string;
  sources: InteractionDataset["sources"];
  interactions: MatchedInteraction[];
  uncheckedMedications: { medication: Medication; reason: "unmapped_product" | "no_demo_rules" }[];
  scheduling: {
    status: "review_required" | "spacing_constraints" | "no_rules_matched";
    reviewInteractionIds: string[];
    constraints: {
      interactionId: string;
      medicationIds: [string, string];
      minimumGapMinutes: number;
      direction: "either_order";
      appliesAcrossMidnight: true;
    }[];
  };
}

export type AdministrationConstraint =
  | {
      type: "food";
      relationship: "with_food" | "before_first_food";
      minimumGapMinutes?: number;
      strength: "requirement" | "preference";
    }
  | { type: "time_of_day"; value: "on_waking" | "evening"; strength: "requirement" | "preference" }
  | { type: "before_other_oral_medicines"; minimumGapMinutes: number; strength: "requirement" }
  | { type: "remain_upright"; durationMinutes: number; strength: "requirement" }
  | { type: "plain_water_only"; strength: "requirement" };

export interface AdministrationDataset {
  version: string;
  demoOnly: true;
  clinicallyValidated: false;
  sources: InteractionDataset["sources"];
  rules: {
    id: string;
    productCodes: string[];
    system: string;
    constraints: AdministrationConstraint[];
    instructions: string[];
    sourceIds: string[];
  }[];
}

export interface ScheduleInputMedicine {
  medication: Medication;
  /** An absent PRN flag is unconfirmed, not evidence of regular treatment. */
  use: "regular" | "as_needed" | "unconfirmed";
  prescriptionTiming: {
    frequency?: MedicationFrequency;
    timeOfDay: string[];
    when: string[];
    minimumDoseIntervalMinutes?: number;
    /** Needed for every-N-days, weekly, or fixed-interval courses. Never assume today is a dose day. */
    requiresAnchor: boolean;
  };
  administration: {
    coverage: "demo_rule" | "not_defined";
    ruleIds: string[];
    constraints: AdministrationConstraint[];
    instructions: string[];
    sourceIds: string[];
  };
  issues: {
    code: string;
    message: string;
    resolution: "confirm_prescription" | "professional_review";
  }[];
}

export interface ScheduleInputsResponse {
  nhsNumber: string;
  demoOnly: true;
  clinicallyValidated: false;
  versions: { administration: string; interactions: string };
  notice: string;
  medicines: ScheduleInputMedicine[];
  interactions: InteractionsResponse;
  sources: InteractionDataset["sources"];
  /** These supplement, rather than replace, the interaction spacing constraints. */
  administrationSeparations: {
    medicationId: string;
    beforeMedicationId: string;
    minimumGapMinutes: number;
    ruleId: string;
    appliesAcrossMidnight: true;
  }[];
  readiness: {
    status: "review_required" | "confirmation_required";
    requiresCurrentMedicineConfirmation: true;
    requiresRoutine: true;
    routineFields: ["wake", "sleep", "meals.breakfast", "meals.lunch", "meals.dinner"];
    requiresSpecialInstructionAcknowledgement: boolean;
    medicinesWithIssues: string[];
  };
}

export interface ScheduleRoutine {
  wake: string;
  sleep: string;
  /** HH:MM; null means this meal is skipped. */
  meals: { breakfast: string | null; lunch: string | null; dinner: string | null };
}

export type ScheduleRegimen =
  | {
      kind: "daily";
      dosesPerDay: number;
      fixedTimes?: string[];
      minimumGapMinutes?: number;
      when?: ("ACM" | "ACD" | "ACV" | "C" | "CM" | "CD" | "CV" | "MORN" | "EVE" | "HS" | "WAKE")[];
    }
  | { kind: "as_needed" }
  | { kind: "interval"; every: { value: number; unit: "h" | "d" | "wk" }; anchor?: string };

/** A confirmed selection, not an instruction to load or modify a clinical record. */
export interface ScheduleMedicine {
  id: string;
  source: "record" | "user";
  name: string;
  code?: string;
  system?: string;
  /** Existing UI catalogue ID; never treated as a SNOMED code. */
  productId?: string;
  dose: { quantity: number; quantityMax?: number; unit: string };
  regimen: ScheduleRegimen;
  administration?: {
    food?: "any" | "with-food" | "empty-stomach";
    emptyStomach?: { beforeMinutes: number; afterMinutes: number };
  };
  instructions?: string;
  instructionsConfirmed?: boolean;
}

export interface ScheduleRequest {
  routine: ScheduleRoutine;
  medicines: ScheduleMedicine[];
}

export interface ScheduleWarning {
  code: string;
  severity: "info" | "warning" | "error";
  blocking: boolean;
  medicineIds: string[];
  message: string;
  action: "information" | "confirm_instructions" | "medication_review" | "change_routine";
}

export interface ScheduleResponse {
  status: "proposed" | "blocked";
  demoOnly: true;
  clinicallyValidated: false;
  versions: { scheduler: string; administration: string; interactions: string; catalogue: string };
  warnings: ScheduleWarning[];
  interactions: MatchedInteraction[];
  sources: InteractionDataset["sources"];
  schedule: {
    routine: ScheduleRoutine;
    doses: {
      medicineId: string;
      name: string;
      source: "record" | "user";
      dose: ScheduleMedicine["dose"];
      time: string;
      /** 1 identifies the following calendar day for overnight routines. */
      dayOffset: number;
      minute: number;
      instructions: string[];
    }[];
    asNeeded: ScheduleMedicine[];
  } | null;
}

export interface ScheduleValidationError {
  message: string;
  errors: { path: string; message: string }[];
}
