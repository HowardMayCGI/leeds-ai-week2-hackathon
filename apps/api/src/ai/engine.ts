import type { AskRequest, ExplainRequest, MedicineReadingRequest } from "@hackathon/api-contract";

/**
 * What answers the AI tasks: Claude on Amazon Bedrock ("live"), or built-in
 * stand-ins that call no model ("test"). Both return raw output, which the
 * service checks before anything reaches the patient.
 */
export interface AiEngine {
  mode: "live" | "test";
  /** The model behind live answers, for the web page. */
  model?: string;
  /** Whether explanations and answers come back in the requested language. */
  translates: boolean;
  medicine(request: MedicineReadingRequest, signal: AbortSignal): Promise<unknown>;
  routine(text: string, signal: AbortSignal): Promise<unknown>;
  explain(request: ExplainRequest, signal: AbortSignal): Promise<unknown>;
  ask(request: AskRequest, signal: AbortSignal): Promise<unknown>;
}

/** The model could not give a usable answer: it timed out, refused, or its output could not be read. */
export class AiUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`AI unavailable: ${reason}`);
    this.name = "AiUnavailableError";
  }
}
