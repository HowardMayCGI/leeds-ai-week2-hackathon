import {
  AI_LANGUAGES,
  AI_LIMITS,
  MEDICINE_READING_FORMS,
  type AiLanguage,
  type AskAnswer,
  type AskRequest,
  type ExplainRequest,
  type MedicineReading,
  type MedicineReadingRequest,
  type RoutineReading,
  type ScheduleFact,
} from "@hackathon/api-contract";
import { numbersIn, textProblems } from "./guards";

/**
 * Requests are checked before anything reaches a model, and model output is
 * read field by field: anything malformed, out of range or failing the guards
 * is dropped rather than repaired.
 */

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Text as plain single-spaced characters, without control characters. */
export function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
  return text && text.length <= maxLength ? text : undefined;
}

const FACT_ID = /^[A-Za-z0-9:@._-]{1,80}$/;

function readFacts(value: unknown, field: string): Checked<ScheduleFact[]> {
  if (!Array.isArray(value) || value.length > AI_LIMITS.facts) return { ok: false, message: `${field} must be a list of at most ${AI_LIMITS.facts} facts` };
  const facts: ScheduleFact[] = [];
  for (const entry of value) {
    const text = isObject(entry) ? cleanText(entry.text, AI_LIMITS.factChars) : undefined;
    if (!isObject(entry) || typeof entry.id !== "string" || !FACT_ID.test(entry.id) || !text) {
      return { ok: false, message: `Each of ${field} needs an id and text of at most ${AI_LIMITS.factChars} characters` };
    }
    facts.push({ id: entry.id, text });
  }
  return { ok: true, value: facts };
}

function readLanguage(value: unknown): AiLanguage | undefined {
  return AI_LANGUAGES.includes(value as AiLanguage) ? (value as AiLanguage) : undefined;
}

export function checkMedicineRequest(value: unknown): Checked<MedicineReadingRequest> {
  if (!isObject(value)) return { ok: false, message: "Expected an object" };
  const request: MedicineReadingRequest = {};
  if (value.description !== undefined) {
    const description = cleanText(value.description, AI_LIMITS.descriptionChars);
    if (!description) return { ok: false, message: `description must be text of at most ${AI_LIMITS.descriptionChars} characters` };
    request.description = description;
  }
  if (value.image !== undefined) {
    const image = value.image;
    if (
      !isObject(image) ||
      !["image/jpeg", "image/png", "image/webp"].includes(image.mediaType as string) ||
      typeof image.data !== "string" ||
      !image.data.length ||
      image.data.length > AI_LIMITS.imageBase64Chars ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)
    ) {
      return { ok: false, message: "image must be a JPEG, PNG or WebP photo of up to about 3 MB, base64 encoded" };
    }
    request.image = { mediaType: image.mediaType as "image/jpeg" | "image/png" | "image/webp", data: image.data };
  }
  if (!request.description && !request.image) return { ok: false, message: "Send a description, a photo or both" };
  return { ok: true, value: request };
}

export function checkRoutineRequest(value: unknown): Checked<{ text: string }> {
  const text = isObject(value) ? cleanText(value.text, AI_LIMITS.routineChars) : undefined;
  return text ? { ok: true, value: { text } } : { ok: false, message: `text must be at most ${AI_LIMITS.routineChars} characters` };
}

export function checkExplainRequest(value: unknown): Checked<ExplainRequest> {
  if (!isObject(value)) return { ok: false, message: "Expected an object" };
  const language = readLanguage(value.language);
  if (!language) return { ok: false, message: "language must be en, pl or ur" };
  const facts = readFacts(value.facts, "facts");
  if (!facts.ok) return facts;
  if (!Array.isArray(value.doses) || !value.doses.length || value.doses.length > 60) return { ok: false, message: "doses must list 1 to 60 doses" };
  const doses: ExplainRequest["doses"] = [];
  const ids = new Set<string>();
  for (const dose of value.doses) {
    if (!isObject(dose) || typeof dose.id !== "string" || !FACT_ID.test(dose.id) || ids.has(dose.id)) return { ok: false, message: "Each dose needs a unique id" };
    const doseFacts = readFacts(dose.facts, "dose facts");
    if (!doseFacts.ok) return doseFacts;
    ids.add(dose.id);
    doses.push({ id: dose.id, facts: doseFacts.value });
  }
  return { ok: true, value: { language, facts: facts.value, doses } };
}

export function checkAskRequest(value: unknown): Checked<AskRequest> {
  if (!isObject(value)) return { ok: false, message: "Expected an object" };
  const language = readLanguage(value.language);
  if (!language) return { ok: false, message: "language must be en, pl or ur" };
  const question = cleanText(value.question, AI_LIMITS.questionChars);
  if (!question) return { ok: false, message: `question must be at most ${AI_LIMITS.questionChars} characters` };
  const facts = readFacts(value.facts, "facts");
  if (!facts.ok) return facts;
  if (!facts.value.length) return { ok: false, message: "facts must not be empty" };
  return { ok: true, value: { language, question, facts: facts.value } };
}

// ---------------------------------------------------------------------------
// Model output
// ---------------------------------------------------------------------------

function readNumber(value: unknown, min: number, max: number, integer = false): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return undefined;
  return integer && !Number.isInteger(value) ? undefined : value;
}

/** A label field: short, plain and without links or markup. */
function labelText(value: unknown, maxLength: number): string | undefined {
  const text = cleanText(value, maxLength);
  return text && !textProblems(text, [text], maxLength).length ? text : undefined;
}

/**
 * Reads a medicine from model output. For a description without a photo,
 * a strength or amount whose numbers the patient did not give is dropped, so
 * the model cannot fill gaps from what it knows about the medicine.
 */
export function readMedicineOutput(value: unknown, request: MedicineReadingRequest): MedicineReading {
  if (!isObject(value) || value.found !== true) return { found: false };
  const reading: MedicineReading = { found: true };
  const name = labelText(value.name, 80);
  const brand = labelText(value.brand, 60);
  if (name) reading.name = name;
  if (brand) reading.brand = brand;
  if (!reading.name && !reading.brand) return { found: false };
  const given = request.image ? undefined : numbersIn(request.description ?? "");
  const said = (text: string) => !given || [...numbersIn(text)].every((number) => given.has(number));
  const strength = labelText(value.strength, 40);
  if (strength && /\d/.test(strength) && said(strength)) reading.strength = strength;
  if (MEDICINE_READING_FORMS.includes(value.form as MedicineReading["form"] & string)) reading.form = value.form as MedicineReading["form"];
  const amount = readNumber(value.amount, 0.25, 20);
  if (amount !== undefined && (amount === 1 || said(String(amount)))) {
    reading.amount = amount;
    const amountMax = readNumber(value.amountMax, amount, 20);
    if (amountMax !== undefined && amountMax > amount && said(String(amountMax))) reading.amountMax = amountMax;
  }
  const timesPerDay = readNumber(value.timesPerDay, 1, 4, true);
  if (timesPerDay !== undefined) reading.timesPerDay = timesPerDay;
  if (value.asNeeded === true) reading.asNeeded = true;
  if (value.lessThanDaily === true) reading.lessThanDaily = true;
  if (value.timing === "before-food" || value.timing === "with-food") reading.timing = value.timing;
  const instructions = labelText(value.instructions, 200);
  if (instructions) reading.instructions = instructions;
  return reading;
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Reads routine times from model output; anything that is not a 24-hour "HH:MM" time is dropped. */
export function readRoutineOutput(value: unknown): RoutineReading {
  if (!isObject(value)) return {};
  const routine: RoutineReading = {};
  for (const key of ["wake", "sleep"] as const) {
    if (typeof value[key] === "string" && CLOCK.test(value[key] as string)) routine[key] = value[key] as string;
  }
  // Each meal is { time, skipped }: a skipped meal becomes null, one not mentioned is left out.
  for (const key of ["breakfast", "lunch", "dinner"] as const) {
    const entry = value[key];
    if (!isObject(entry)) continue;
    if (entry.skipped === true) routine[key] = null;
    else if (typeof entry.time === "string" && CLOCK.test(entry.time)) routine[key] = entry.time;
  }
  return routine;
}

/** Explanations for the requested doses that pass the guards; each is checked against its own dose's facts. */
export function readExplainOutput(value: unknown, request: ExplainRequest): { id: string; text: string }[] {
  if (!isObject(value) || !Array.isArray(value.explanations)) return [];
  const shared = request.facts.map((fact) => fact.text);
  const explained: { id: string; text: string }[] = [];
  for (const entry of value.explanations) {
    if (!isObject(entry)) continue;
    const dose = request.doses.find((candidate) => candidate.id === entry.id);
    if (!dose || explained.some((done) => done.id === dose.id)) continue;
    const text = cleanText(entry.text, 320);
    if (!text) continue;
    if (textProblems(text, [...shared, ...dose.facts.map((fact) => fact.text)], 320).length) continue;
    explained.push({ id: dose.id, text });
  }
  return explained;
}

/**
 * Reads an answer from model output. An answer must cite the facts it uses,
 * and every number in it must appear in those facts; otherwise the patient is
 * told the app cannot answer.
 */
export function readAskOutput(value: unknown, request: AskRequest): AskAnswer {
  const cannot: AskAnswer = { kind: "cannot-answer", reason: "outside-schedule" };
  if (!isObject(value)) return cannot;
  if (value.kind === "emergency") return { kind: "emergency" };
  if (value.kind === "cannot-answer") return { kind: "cannot-answer", reason: value.reason === "medical-advice" ? "medical-advice" : "outside-schedule" };
  if (value.kind !== "answer" || !Array.isArray(value.factIds)) return cannot;
  const cited = request.facts.filter((fact) => (value.factIds as unknown[]).includes(fact.id));
  const text = cleanText(value.text, 500);
  if (!text || !cited.length) return cannot;
  if (textProblems(text, cited.map((fact) => fact.text), 500).length) return cannot;
  return { kind: "answer", text, factIds: cited.map((fact) => fact.id) };
}
