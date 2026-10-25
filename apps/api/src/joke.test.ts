import assert from "node:assert/strict";
import { test } from "node:test";
import { ChatGptConfigurationError } from "@hackathon/chatgpt";
import { isJokeResponse } from "@hackathon/api-contract";
import { handleRequest, ORIGIN_HEADER } from "./handler";

const request = { method: "POST", path: "/api/joke", headers: { [ORIGIN_HEADER]: "test-secret" } };
const options = { originSecret: "test-secret" };

test("returns a generated joke without caching it", async () => {
  let calls = 0;
  const response = await handleRequest(request, {
    ...options,
    generateJoke: async () => {
      calls++;
      return "A family-friendly joke.";
    },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body!), { joke: "A family-friendly joke." });
  assert.ok(isJokeResponse(JSON.parse(response.body!)));
  assert.equal(response.headers?.["cache-control"], "no-store");
  assert.equal(calls, 1);
});

test("checks the origin and POST method before calling OpenAI", async () => {
  const guarded = {
    ...options,
    generateJoke: async () => {
      throw new Error("Must not be called");
    },
  };
  assert.equal((await handleRequest({ ...request, headers: {} }, guarded)).statusCode, 403);
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]) {
    const response = await handleRequest({ ...request, method }, guarded);
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers?.allow, "POST");
  }
});

test("returns a useful unavailable response when the key is missing", async () => {
  const response = await handleRequest(request, {
    ...options,
    generateJoke: async () => {
      throw new ChatGptConfigurationError();
    },
  });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(JSON.parse(response.body!), { message: "The joke demo is not configured yet." });
});

test("does not expose upstream details or keys to the browser", async () => {
  const response = await handleRequest(request, {
    ...options,
    generateJoke: async () => {
      throw new Error("Bearer secret-key upstream details");
    },
  });
  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body!, /secret-key|Bearer|upstream details/);
});

test("the default route calls the SDK with only the fixed joke prompt", async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only-key";
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    calls++;
    const body = JSON.parse(String(init.body));
    assert.equal(body.input, "Tell me one short, family-friendly joke.");
    assert.match(body.instructions, /suitable for children/);
    assert.doesNotMatch(String(init.body), /patient-body-content/);
    return new Response(
      JSON.stringify({
        id: "resp_test",
        object: "response",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "A kind joke.", annotations: [] }],
          },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  const response = await handleRequest({ ...request, body: "patient-body-content" }, options);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body!), { joke: "A kind joke." });
  assert.equal(calls, 1);
});
