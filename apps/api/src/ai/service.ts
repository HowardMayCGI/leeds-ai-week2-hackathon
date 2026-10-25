import type {
  AiStatusResponse,
  AskResponse,
  ExplainResponse,
  MedicineReadingResponse,
  RoutineReadingResponse,
} from "@hackathon/api-contract";
import { bedrockCreateMessage, claudeEngine, DEFAULT_MODEL_ID } from "./claude";
import { AiUnavailableError, type AiEngine } from "./engine";
import { checkQuestion } from "./guards";
import { standInEngine } from "./stand-in";
import {
  checkAskRequest, checkExplainRequest, checkMedicineRequest, checkRoutineRequest,
  readAskOutput, readExplainOutput, readMedicineOutput, readRoutineOutput, type Checked,
} from "./validate";

export type AiTask = "medicine" | "routine" | "explain" | "ask";
export const AI_TASKS: AiTask[] = ["medicine", "routine", "explain", "ask"];

export type AiResult =
  | { status: 200; body: MedicineReadingResponse | RoutineReadingResponse | ExplainResponse | AskResponse }
  | { status: 400 | 503; body: { message: string } };

export interface AiService {
  status(): AiStatusResponse;
  run(task: AiTask, body: unknown): Promise<AiResult>;
}

/** Live calls get this long in total, retries included, inside the Lambda's 29 seconds. */
const TIME_LIMIT_MS = 24_000;

/**
 * Chooses the engine from the environment: AI_PROVIDER is "bedrock" (Claude
 * on Amazon Bedrock, in AWS_REGION), "test" (stand-ins, no model) or "off".
 */
export function createAiService(env: Record<string, string | undefined>, fallback: "off" | "test" = "off"): AiService {
  const provider = env.AI_PROVIDER ?? fallback;
  if (provider === "bedrock") {
    const region = env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? "eu-west-2";
    return aiService(claudeEngine(bedrockCreateMessage(region), env.AI_MODEL_ID || DEFAULT_MODEL_ID));
  }
  return aiService(provider === "test" ? standInEngine() : undefined);
}

/** Logs what happened without any of the patient's words, photo or schedule. */
function log(task: AiTask, mode: string, outcome: string, started: number) {
  console.info(JSON.stringify({ event: "ai", task, mode, outcome, ms: Date.now() - started }));
}

export function aiService(engine: AiEngine | undefined): AiService {
  const unavailable = (message: string): AiResult => ({ status: 503, body: { message } });
  const invalid = (checked: Checked<unknown>): AiResult => ({ status: 400, body: { message: checked.ok ? "Invalid request" : checked.message } });

  return {
    status: () => (engine ? { mode: engine.mode, model: engine.model } : { mode: "off" }),

    async run(task, body) {
      if (!engine) return unavailable("AI features are turned off");
      const mode = engine.mode;
      const started = Date.now();
      const signal = AbortSignal.timeout(TIME_LIMIT_MS);
      try {
        switch (task) {
          case "medicine": {
            const request = checkMedicineRequest(body);
            if (!request.ok) return invalid(request);
            const reading = readMedicineOutput(await engine.medicine(request.value, signal), request.value);
            log(task, mode, reading.found ? "found" : "not-found", started);
            return { status: 200, body: { reading, mode } };
          }
          case "routine": {
            const request = checkRoutineRequest(body);
            if (!request.ok) return invalid(request);
            const routine = readRoutineOutput(await engine.routine(request.value.text, signal));
            log(task, mode, `${Object.keys(routine).length}-found`, started);
            return { status: 200, body: { routine, mode } };
          }
          case "explain": {
            const request = checkExplainRequest(body);
            if (!request.ok) return invalid(request);
            const explanations = readExplainOutput(await engine.explain(request.value, signal), request.value);
            log(task, mode, `${explanations.length}-of-${request.value.doses.length}`, started);
            return { status: 200, body: { explanations, language: engine.translates ? request.value.language : "en", mode } };
          }
          case "ask": {
            const request = checkAskRequest(body);
            if (!request.ok) return invalid(request);
            const language = engine.translates ? request.value.language : "en";
            // Emergencies and requests for medical advice get fixed wording, without asking a model.
            const check = checkQuestion(request.value.question);
            if (check) {
              log(task, mode, check, started);
              return {
                status: 200,
                body: { answer: check === "emergency" ? { kind: "emergency" } : { kind: "cannot-answer", reason: "medical-advice" }, language, mode },
              };
            }
            const answer = readAskOutput(await engine.ask(request.value, signal), request.value);
            log(task, mode, answer.kind, started);
            return { status: 200, body: { answer, language, mode } };
          }
        }
      } catch (error) {
        log(task, mode, error instanceof AiUnavailableError ? error.reason : error instanceof Error ? error.name : "error", started);
        return unavailable("AI is not available right now");
      }
    },
  };
}
