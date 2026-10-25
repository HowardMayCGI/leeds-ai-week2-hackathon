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

/** A medicine the patient has chosen for their schedule, checked against the interaction rules by its code. */
export interface SelectedMedicine {
  /** The app's own key for the medicine, returned unchanged in each match. */
  id: string;
  name: string;
  code?: string;
  system?: string;
}

export interface SelectionInteractionsRequest {
  medicines: SelectedMedicine[];
}

/** Interaction matches for the medicines in a schedule. No matches never means the combination is safe. */
export interface SelectionInteractionsResponse {
  datasetVersion: string;
  clinicallyValidated: false;
  coverage: "limited_demo_rules";
  interactions: {
    id: string;
    ruleId: string;
    severity: InteractionRule["severity"];
    action: InteractionManagement["action"];
    /** For separate_doses: the minimum gap between the two medicines' doses. */
    minimumGapMinutes?: number;
    effect: string;
    patientGuidance: string;
    medicineIds: [string, string];
    sourceIds: string[];
  }[];
  /** Medicines the rules could not check, such as ones typed in by the patient. */
  uncheckedIds: string[];
  sources: InteractionDataset["sources"];
}

export function isSelectionInteractionsResponse(value: unknown): value is SelectionInteractionsResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as SelectionInteractionsResponse;
  return (
    typeof response.datasetVersion === "string" &&
    Array.isArray(response.interactions) &&
    Array.isArray(response.uncheckedIds) &&
    Array.isArray(response.sources) &&
    response.interactions.every(
      (interaction) =>
        typeof interaction?.id === "string" &&
        typeof interaction.patientGuidance === "string" &&
        Array.isArray(interaction.medicineIds) &&
        interaction.medicineIds.length === 2,
    )
  );
}

// ---------------------------------------------------------------------------
// AI assistance. The model only ever suggests: code checks every answer before
// it is returned, and the patient confirms anything that changes their
// schedule. "test" mode answers with built-in stand-ins and calls no model.
// ---------------------------------------------------------------------------

export type AiMode = "live" | "test" | "off";
export const AI_LANGUAGES = ["en", "pl", "ur"] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number];

export interface AiStatusResponse {
  mode: AiMode;
  /** The model behind live answers, such as "Claude Haiku 5.5 on Amazon Bedrock". */
  model?: string;
}

export const MEDICINE_READING_FORMS = [
  "tablet",
  "capsule",
  "oral-liquid",
  "inhaler",
  "spray",
  "patch",
  "injection",
  "other",
] as const;

/**
 * A medicine read from a photo of its box or pharmacy label, or from the
 * patient's own description. Fields that could not be read are left out; the
 * patient checks and completes every field before it is used.
 */
export interface MedicineReading {
  /** False when no medicine could be read, such as for a blurred photo. */
  found: boolean;
  /** Generic name as printed, such as "Ferrous sulfate". */
  name?: string;
  brand?: string;
  /** Strength of one tablet, capsule or measure as printed, such as "200mg". */
  strength?: string;
  form?: (typeof MEDICINE_READING_FORMS)[number];
  /** How many to take each time, such as 1; amountMax is set for "1 or 2". */
  amount?: number;
  amountMax?: number;
  /** 1 to 4 doses a day. */
  timesPerDay?: number;
  asNeeded?: boolean;
  lessThanDaily?: boolean;
  timing?: "before-food" | "with-food";
  /** Any other direction from the label, in its own words. */
  instructions?: string;
}

export interface MedicineReadingRequest {
  /** What the patient typed, such as "vitamin D 1000 units once a day". */
  description?: string;
  /** A photo, base64 encoded without a data: prefix. */
  image?: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };
}

export interface MedicineReadingResponse {
  reading: MedicineReading;
  mode: Exclude<AiMode, "off">;
}

/**
 * Times read from a description of the patient's usual day, as 24-hour
 * "HH:MM". A meal set to null is one the patient does not eat; anything not
 * mentioned is left out, never guessed.
 */
export interface RoutineReading {
  wake?: string;
  sleep?: string;
  breakfast?: string | null;
  lunch?: string | null;
  dinner?: string | null;
}

export interface RoutineReadingRequest {
  text: string;
}

export interface RoutineReadingResponse {
  routine: RoutineReading;
  mode: Exclude<AiMode, "off">;
}

/** Something the app knows about the patient's schedule, in English. Facts are all the AI may use. */
export interface ScheduleFact {
  id: string;
  text: string;
}

export interface ExplainRequest {
  language: AiLanguage;
  /** Facts that apply to every dose, such as the patient's routine. */
  facts: ScheduleFact[];
  doses: { id: string; facts: ScheduleFact[] }[];
}

export interface ExplainResponse {
  /** One explanation per dose that passed the checks; a dose that failed them is left out. */
  explanations: { id: string; text: string }[];
  /** The language of the explanations: English when test mode cannot translate. */
  language: AiLanguage;
  mode: Exclude<AiMode, "off">;
}

export interface AskRequest {
  language: AiLanguage;
  question: string;
  facts: ScheduleFact[];
}

export type AskAnswer =
  | { kind: "answer"; text: string; factIds: string[] }
  /** The app shows its own wording for these, never the model's. */
  | { kind: "cannot-answer"; reason: "medical-advice" | "outside-schedule" }
  | { kind: "emergency" };

export interface AskResponse {
  answer: AskAnswer;
  /** The language of the answer text: English when test mode cannot translate. */
  language: AiLanguage;
  mode: Exclude<AiMode, "off">;
}

export const AI_LIMITS = {
  /** A photo of up to about 3 MB once base64 encoded. */
  imageBase64Chars: 4_000_000,
  descriptionChars: 300,
  routineChars: 600,
  questionChars: 300,
  facts: 200,
  factChars: 400,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isAiLanguage = (value: unknown): value is AiLanguage => AI_LANGUAGES.includes(value as AiLanguage);

export function isAiStatusResponse(value: unknown): value is AiStatusResponse {
  return isRecord(value) && ["live", "test", "off"].includes(value.mode as string) && (value.model === undefined || typeof value.model === "string");
}

export function isMedicineReadingResponse(value: unknown): value is MedicineReadingResponse {
  return isRecord(value) && isRecord(value.reading) && typeof value.reading.found === "boolean";
}

export function isRoutineReadingResponse(value: unknown): value is RoutineReadingResponse {
  return (
    isRecord(value) &&
    isRecord(value.routine) &&
    Object.entries(value.routine).every(
      ([key, time]) => ["wake", "sleep", "breakfast", "lunch", "dinner"].includes(key) && (time === null || typeof time === "string"),
    )
  );
}

export function isExplainResponse(value: unknown): value is ExplainResponse {
  return (
    isRecord(value) &&
    isAiLanguage(value.language) &&
    Array.isArray(value.explanations) &&
    value.explanations.every((entry) => isRecord(entry) && typeof entry.id === "string" && typeof entry.text === "string")
  );
}

export function isAskResponse(value: unknown): value is AskResponse {
  if (!isRecord(value) || !isAiLanguage(value.language) || !isRecord(value.answer)) return false;
  const answer = value.answer;
  if (answer.kind === "answer") return typeof answer.text === "string" && Array.isArray(answer.factIds) && answer.factIds.every((id) => typeof id === "string");
  if (answer.kind === "cannot-answer") return answer.reason === "medical-advice" || answer.reason === "outside-schedule";
  return answer.kind === "emergency";
}
