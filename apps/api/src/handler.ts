import { randomInt, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import {
  NHS_NUMBER_PATTERN,
  type RandomNumberResponse,
  type SelectedMedicine,
} from "@hackathon/api-contract";
import { AI_TASKS, createAiService, type AiService, type AiTask } from "./ai/service";
import {
  createFilePatientRepository,
  defaultDataDirectory,
  type PatientRepository,
} from "./patient-data";
import { checkInteractions, checkSelection } from "./interactions";
import { buildScheduleInputs } from "./schedule-inputs";
import { createSchedule } from "./schedule-service";
import { MAX_SCHEDULE_BODY_BYTES, validateScheduleRequest } from "./schedule-validation";

export const ORIGIN_HEADER = "x-hackathon-origin";

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body?: string;
}

interface HandlerOptions {
  originSecret: string | undefined;
  generateNumber?: () => number;
  patients?: PatientRepository;
  /** AI features; off unless configured. */
  ai?: AiService;
}

/** The largest request any route accepts: a medicine photo. Each route sets its own limit. */
export const MAX_REQUEST_BODY_BYTES = 4_500_000;
const AI_BODY_BYTES: Record<AiTask, number> = {
  medicine: MAX_REQUEST_BODY_BYTES,
  routine: 16_384,
  explain: 131_072,
  ask: 131_072,
};
const INTERACTIONS_BODY_BYTES = 32_768;

function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    body: JSON.stringify(body),
  };
}

function matchesSecret(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const actual = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function methodNotAllowed(allow = "GET") {
  const response = json(405, { message: "Method not allowed" });
  response.headers = { ...response.headers, allow };
  return response;
}

const PATIENT_ROUTE =
  /^\/api\/patients\/([^/]+)\/(demographics|medications|interactions|schedule-inputs)$/;
const AI_ROUTE = /^\/api\/ai\/(medicine|routine|explain|ask)$/;

/** A JSON request body within a size limit, or the error response to send instead. */
function readJson(
  request: ApiRequest,
  limit: number,
): { ok: true; value: unknown } | { ok: false; response: APIGatewayProxyStructuredResultV2 } {
  if (Buffer.byteLength(request.body ?? "", "utf8") > limit)
    return { ok: false, response: json(413, { message: `Request exceeds ${Math.round(limit / 1024)} KiB` }) };
  if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json")
    return { ok: false, response: json(415, { message: "Content-Type must be application/json" }) };
  try {
    return { ok: true, value: JSON.parse(request.body ?? "") };
  } catch {
    return { ok: false, response: json(400, { message: "Invalid JSON body" }) };
  }
}

/** The medicines in a schedule, as the app sends them for an interaction check. */
function readSelection(value: unknown): SelectedMedicine[] | undefined {
  const medicines = (value as { medicines?: unknown } | null)?.medicines;
  if (!Array.isArray(medicines) || medicines.length > 100) return undefined;
  const text = (entry: unknown, max: number) => typeof entry === "string" && entry.length > 0 && entry.length <= max;
  const optional = (entry: unknown, max: number) => entry === undefined || text(entry, max);
  const valid = medicines.every(
    (medicine) =>
      typeof medicine === "object" &&
      medicine !== null &&
      text(medicine.id, 120) &&
      text(medicine.name, 200) &&
      optional(medicine.code, 40) &&
      optional(medicine.system, 200),
  );
  return valid
    ? medicines.map(({ id, name, code, system }) => ({ id, name, code, system }))
    : undefined;
}

async function handleAi(request: ApiRequest, ai: AiService): Promise<APIGatewayProxyStructuredResultV2> {
  if (request.path === "/api/ai/status") {
    return request.method === "GET" ? json(200, ai.status()) : methodNotAllowed();
  }
  const task = AI_ROUTE.exec(request.path)?.[1] as AiTask | undefined;
  if (!task || !AI_TASKS.includes(task)) return json(404, { message: "Not found" });
  if (request.method !== "POST") return methodNotAllowed("POST");
  const body = readJson(request, AI_BODY_BYTES[task]);
  if (!body.ok) return body.response;
  const result = await ai.run(task, body.value);
  return json(result.status, result.body);
}

export async function handleRequest(
  request: ApiRequest,
  options: HandlerOptions,
): Promise<APIGatewayProxyStructuredResultV2> {
  // Fail closed if deployment configuration is missing, too.
  if (!matchesSecret(request.headers[ORIGIN_HEADER], options.originSecret)) {
    return json(403, { message: "Forbidden" });
  }
  if (request.path === "/api/schedules") {
    if (request.method !== "POST") return methodNotAllowed("POST");
    if (Buffer.byteLength(request.body ?? "", "utf8") > MAX_SCHEDULE_BODY_BYTES)
      return json(413, { message: "Schedule request exceeds 128 KiB" });
    if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json")
      return json(415, { message: "Content-Type must be application/json" });
    let value: unknown;
    try {
      value = JSON.parse(request.body ?? "");
    } catch {
      return json(400, { message: "Invalid JSON body" });
    }
    const validation = validateScheduleRequest(value);
    if (!validation.valid) return json(400, validation.error);
    try {
      return json(200, createSchedule(validation.value));
    } catch (error) {
      console.error(
        "Schedule generation failed",
        error instanceof Error ? error.name : "Unknown error",
      );
      return json(500, { message: "Internal server error" });
    }
  }
  if (request.path === "/api/interactions") {
    if (request.method !== "POST") return methodNotAllowed("POST");
    const body = readJson(request, INTERACTIONS_BODY_BYTES);
    if (!body.ok) return body.response;
    const medicines = readSelection(body.value);
    if (!medicines)
      return json(400, { message: "medicines must list up to 100 medicines, each with an id and name" });
    return json(200, checkSelection(medicines));
  }
  if (request.path.startsWith("/api/ai/")) return handleAi(request, options.ai ?? defaultAi());
  const route = PATIENT_ROUTE.exec(request.path);
  const known =
    request.path === "/api/random" ||
    request.path === "/api/patients" ||
    request.path === "/api/medicines" ||
    route;
  if (!known) return json(404, { message: "Not found" });
  if (request.method !== "GET") return methodNotAllowed();

  if (request.path === "/api/random") {
    const response: RandomNumberResponse = {
      number: (options.generateNumber ?? (() => randomInt(1, 101)))(),
    };
    return json(200, response);
  }

  const patients = options.patients ?? defaultRepository();
  try {
    if (request.path === "/api/patients") return json(200, await patients.listPatients());
    if (request.path === "/api/medicines") return json(200, await patients.listMedicines());
    const [, nhsNumber, resource] = route!;
    if (!NHS_NUMBER_PATTERN.test(nhsNumber))
      return json(400, { message: "NHS number must be 10 digits" });
    if (resource === "demographics") {
      const result = await patients.getDemographics(nhsNumber);
      return result ? json(200, result) : json(404, { message: "Patient not found" });
    }
    // Interactions use the same current, de-duplicated record as medications.
    const result = await patients.getMedications(nhsNumber);
    if (!result) return json(404, { message: "Patient not found" });
    if (resource === "schedule-inputs") return json(200, buildScheduleInputs(result));
    return json(200, resource === "interactions" ? checkInteractions(result) : result);
  } catch (error) {
    console.error("Patient data error", error);
    return json(500, { message: "Internal server error" });
  }
}

let repository: PatientRepository | undefined;
let lambdaAi: AiService | undefined;
function defaultAi(): AiService {
  return (lambdaAi ??= createAiService(process.env));
}
function defaultRepository(): PatientRepository {
  return (repository ??= createFilePatientRepository(defaultDataDirectory()));
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  return handleRequest(
    {
      method: event.requestContext.http.method,
      path: event.rawPath,
      headers: event.headers,
      body:
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : event.body,
    },
    { originSecret: process.env.ORIGIN_SECRET },
  );
}
