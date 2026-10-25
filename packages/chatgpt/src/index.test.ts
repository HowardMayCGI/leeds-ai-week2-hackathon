import assert from "node:assert/strict";
import { test } from "node:test";
import { ChatGptConfigurationError, createChatGptClient, DEFAULT_CHATGPT_MODEL } from "./index";

const joke = "Why did the bicycle fall over? It was two tired.";

function modelResponse(status = "completed", text = joke) {
  return new Response(
    JSON.stringify({
      id: "resp_test",
      object: "response",
      status,
      output: [
        {
          id: "msg_test",
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      ],
    }),
    { headers: { "content-type": "application/json" } },
  );
}

test("requires a backend key before making a request", () => {
  assert.throws(() => createChatGptClient({ apiKey: " " }), ChatGptConfigurationError);
});

test("uses the real SDK to send a bounded, stateless Responses API request", async () => {
  const previous = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_MODEL;
  try {
    const client = createChatGptClient({
      apiKey: "test-only-key",
      fetch: async (url, init) => {
        assert.equal(String(url), "https://api.openai.com/v1/responses");
        assert.equal(init?.method, "POST");
        assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-only-key");
        assert.deepEqual(JSON.parse(String(init?.body)), {
          model: DEFAULT_CHATGPT_MODEL,
          input: "Tell me a joke",
          instructions: "Keep it family-friendly",
          reasoning: { effort: "none" },
          max_output_tokens: 256,
          store: false,
        });
        return modelResponse();
      },
    });
    assert.equal(await client.generateText("Tell me a joke", "Keep it family-friendly"), joke);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previous;
  }
});

test("reads the key and model from the backend environment", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "environment-test-key";
  process.env.OPENAI_MODEL = "configured-model";
  try {
    const client = createChatGptClient({
      fetch: async (_url, init) => {
        assert.equal(
          new Headers(init?.headers).get("authorization"),
          "Bearer environment-test-key",
        );
        assert.equal(JSON.parse(String(init?.body)).model, "configured-model");
        return modelResponse();
      },
    });
    await client.generateText("Hello", "Reply briefly");
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  }
});

test("rejects incomplete and empty output instead of returning a successful result", async () => {
  for (const [status, text] of [
    ["incomplete", joke],
    ["completed", "  "],
  ]) {
    const client = createChatGptClient({
      apiKey: "test-key",
      fetch: async () => modelResponse(status, text),
    });
    await assert.rejects(client.generateText("Joke", "Be kind"), /complete text response/);
  }
});

test("propagates upstream failures without automatic retries", async () => {
  let calls = 0;
  const client = createChatGptClient({
    apiKey: "test-key",
    fetch: async () => {
      calls++;
      return new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    },
  });
  await assert.rejects(client.generateText("Joke", "Be kind"));
  assert.equal(calls, 1);
});
