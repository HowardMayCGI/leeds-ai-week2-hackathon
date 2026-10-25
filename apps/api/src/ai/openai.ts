import type { AskRequest, ExplainRequest, MedicineReadingRequest } from "@hackathon/api-contract";
import { AiUnavailableError, type AiEngine } from "./engine";
import {
  ASK_SCHEMA, askContent, askSystem, EXPLAIN_SCHEMA, explainContent, explainSystem,
  MEDICINE_SCHEMA, MEDICINE_SYSTEM, medicineContent, ROUTINE_SCHEMA, ROUTINE_SYSTEM, routineContent,
} from "./prompts";

/** The same model as the joke demo, unless OPENAI_MODEL says otherwise. */
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";
const RESPONSES_URL = "https://api.openai.com/v1/responses";

type InputContent = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" };
type ResponseBody = { status?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };

/**
 * GPT through OpenAI's Responses API, with the same instructions and JSON
 * schemas as Claude. Requests are not stored by OpenAI (`store: false`), and
 * error details from OpenAI are never passed on or logged.
 */
export function openAiEngine(apiKey: string, model = DEFAULT_OPENAI_MODEL, fetchImpl: typeof fetch = fetch): AiEngine {
  async function complete(
    name: string,
    instructions: string,
    content: InputContent[],
    schema: Record<string, unknown>,
    maxTokens: number,
    signal: AbortSignal,
  ): Promise<unknown> {
    const response = await fetchImpl(RESPONSES_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        instructions,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name, schema, strict: true } },
        reasoning: { effort: "none" },
        max_output_tokens: maxTokens,
        store: false,
      }),
      signal,
    });
    if (!response.ok) throw new AiUnavailableError(`http-${response.status}`);
    const body = (await response.json()) as ResponseBody;
    if (body.status !== "completed") throw new AiUnavailableError(body.status ?? "unknown");
    // A refusal comes back as a "refusal" part instead of "output_text".
    const text = body.output
      ?.flatMap((item) => (item.type === "message" ? (item.content ?? []) : []))
      .find((part) => part.type === "output_text")?.text;
    if (!text) throw new AiUnavailableError("no-text");
    try {
      return JSON.parse(text);
    } catch {
      throw new AiUnavailableError("invalid-json");
    }
  }

  const text = (value: string): InputContent => ({ type: "input_text", text: value });

  return {
    mode: "live",
    model: `OpenAI ${model}`,
    translates: true,
    medicine(request: MedicineReadingRequest, signal) {
      const content: InputContent[] = [];
      if (request.image) content.push({ type: "input_image", image_url: `data:${request.image.mediaType};base64,${request.image.data}`, detail: "auto" });
      content.push(text(medicineContent(request.description, Boolean(request.image))));
      return complete("medicine_reading", MEDICINE_SYSTEM, content, MEDICINE_SCHEMA, 1000, signal);
    },
    routine(description, signal) {
      return complete("routine_reading", ROUTINE_SYSTEM, [text(routineContent(description))], ROUTINE_SCHEMA, 500, signal);
    },
    explain(request: ExplainRequest, signal) {
      return complete("schedule_explanations", explainSystem(request.language), [text(explainContent(request))], EXPLAIN_SCHEMA, 4000, signal);
    },
    ask(request: AskRequest, signal) {
      return complete("schedule_answer", askSystem(request.language), [text(askContent(request))], ASK_SCHEMA, 800, signal);
    },
  };
}
