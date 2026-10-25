import type Anthropic from "@anthropic-ai/sdk";
import type { AskRequest, ExplainRequest, MedicineReadingRequest } from "@hackathon/api-contract";
import { AiUnavailableError, type AiEngine } from "./engine";
import {
  ASK_SCHEMA, askContent, askSystem, EXPLAIN_SCHEMA, explainContent, explainSystem,
  MEDICINE_SCHEMA, MEDICINE_SYSTEM, medicineContent, ROUTINE_SCHEMA, ROUTINE_SYSTEM, routineContent,
} from "./prompts";

/** Claude Haiku 5.5 through Claude in Amazon Bedrock, which serves the Messages API. */
export const DEFAULT_MODEL_ID = "anthropic.claude-haiku-5-5";

const MODEL_NAMES: Record<string, string> = {
  "anthropic.claude-haiku-5-5": "Claude Haiku 5.5",
  "anthropic.claude-sonnet-5-5": "Claude Sonnet 5.5",
  "anthropic.claude-opus-5-5": "Claude Opus 5.5",
  "anthropic.claude-sonnet-5": "Claude Sonnet 5",
};

/** The part of the Anthropic client the engine uses, so tests can stand in for it. */
export type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
  options: { signal: AbortSignal; timeout: number; maxRetries: number },
) => Promise<Anthropic.Message>;

/** Creates the Bedrock client only when a live answer is first needed, so other routes stay fast. */
export function bedrockCreateMessage(region: string): CreateMessage {
  let client: Promise<{ messages: { create: CreateMessage } }> | undefined;
  return async (params, options) => {
    client ??= import("@anthropic-ai/bedrock-sdk").then(
      ({ AnthropicBedrockMantle }) => new AnthropicBedrockMantle({ awsRegion: region }) as unknown as { messages: { create: CreateMessage } },
    );
    return (await client).messages.create(params, options);
  };
}

export function claudeEngine(createMessage: CreateMessage, modelId = DEFAULT_MODEL_ID): AiEngine {
  async function complete(
    system: string,
    content: Anthropic.ContentBlockParam[],
    schema: Record<string, unknown>,
    maxTokens: number,
    signal: AbortSignal,
  ): Promise<unknown> {
    const message = await createMessage(
      {
        model: modelId,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content }],
        // Low effort keeps answers quick; the structured output format guarantees parseable JSON.
        output_config: { effort: "low", format: { type: "json_schema", schema } },
      },
      { signal, timeout: 20_000, maxRetries: 1 },
    );
    if (message.stop_reason !== "end_turn") throw new AiUnavailableError(message.stop_reason ?? "unknown");
    const text = message.content.find((block): block is Anthropic.TextBlock => block.type === "text")?.text;
    if (!text) throw new AiUnavailableError("no-text");
    try {
      return JSON.parse(text);
    } catch {
      throw new AiUnavailableError("invalid-json");
    }
  }

  const text = (value: string): Anthropic.ContentBlockParam => ({ type: "text", text: value });

  return {
    mode: "live",
    model: `${MODEL_NAMES[modelId] ?? modelId} on Amazon Bedrock`,
    translates: true,
    medicine(request: MedicineReadingRequest, signal) {
      const content: Anthropic.ContentBlockParam[] = [];
      // The photo comes before the instruction, as the Messages API recommends for images.
      if (request.image) content.push({ type: "image", source: { type: "base64", media_type: request.image.mediaType, data: request.image.data } });
      content.push(text(medicineContent(request.description, Boolean(request.image))));
      return complete(MEDICINE_SYSTEM, content, MEDICINE_SCHEMA, 2000, signal);
    },
    routine(description, signal) {
      return complete(ROUTINE_SYSTEM, [text(routineContent(description))], ROUTINE_SCHEMA, 2000, signal);
    },
    explain(request: ExplainRequest, signal) {
      return complete(explainSystem(request.language), [text(explainContent(request))], EXPLAIN_SCHEMA, 8000, signal);
    },
    ask(request: AskRequest, signal) {
      return complete(askSystem(request.language), [text(askContent(request))], ASK_SCHEMA, 2000, signal);
    },
  };
}
