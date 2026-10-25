import OpenAI from "openai";

export const DEFAULT_CHATGPT_MODEL = "gpt-6-luna";
export const CHATGPT_TIMEOUT_MS = 20_000;

export class ChatGptConfigurationError extends Error {
  constructor() {
    super("Set OPENAI_API_KEY in the backend environment.");
    this.name = "ChatGptConfigurationError";
  }
}

/** Backend only. Never import this package into the static web application. */
export function createChatGptClient(
  options: {
    apiKey?: string;
    model?: string;
    fetch?: typeof globalThis.fetch;
  } = {},
) {
  const apiKey = (options.apiKey ?? process.env.OPENAI_API_KEY)?.trim();
  if (!apiKey) throw new ChatGptConfigurationError();
  const model = options.model?.trim() || process.env.OPENAI_MODEL?.trim() || DEFAULT_CHATGPT_MODEL;
  const client = new OpenAI({
    apiKey,
    timeout: CHATGPT_TIMEOUT_MS,
    maxRetries: 0,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

  return {
    async generateText(input: string, instructions: string): Promise<string> {
      const response = await client.responses.create({
        model,
        input,
        instructions,
        reasoning: { effort: "none" },
        max_output_tokens: 256,
        store: false,
      });
      const text = response.output_text?.trim();
      if (response.status !== "completed" || !text) {
        throw new Error("OpenAI did not return a complete text response.");
      }
      return text;
    },
  };
}
