import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handleRequest, handler, ORIGIN_HEADER } from "./handler";
import { createLocalServer } from "./local-server";
import { MAX_SCHEDULE_BODY_BYTES } from "./schedule-validation";

const payload = {
  routine: {
    wake: "07:00",
    sleep: "22:30",
    meals: { breakfast: "08:00", lunch: "13:00", dinner: "18:30" },
  },
  medicines: [
    {
      id: "metformin",
      source: "user",
      productId: "metformin-500mg-tablet",
      name: "Metformin",
      dose: { quantity: 1, unit: "tablet" },
      regimen: { kind: "daily", dosesPerDay: 2 },
    },
  ],
};
const request = {
  method: "POST",
  path: "/api/schedules",
  headers: { [ORIGIN_HEADER]: "test", "content-type": "application/json" },
  body: JSON.stringify(payload),
};
const options = { originSecret: "test" };

test("POST schedules returns a JSON proposal without consulting the patient repository", async () => {
  const fail = async () => {
    throw new Error("Patient repository must not be called");
  };
  const result = await handleRequest(request, {
    ...options,
    patients: {
      listPatients: fail,
      getDemographics: fail,
      getMedications: fail,
      listMedicines: fail,
    },
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers?.["content-type"], "application/json");
  assert.equal(result.headers?.["cache-control"], "no-store");
  const body = JSON.parse(result.body!);
  assert.equal(body.status, "proposed");
  assert.equal(body.schedule.doses.length, 2);
  assert.ok(Array.isArray(body.warnings));
});

test("schedule transport enforces origin, method, media type, JSON shape and byte limits", async () => {
  assert.equal((await handleRequest({ ...request, headers: {} }, options)).statusCode, 403);
  const get = await handleRequest({ ...request, method: "GET" }, options);
  assert.equal(get.statusCode, 405);
  assert.equal(get.headers?.allow, "POST");
  assert.equal((await handleRequest({ ...request, method: "DELETE" }, options)).statusCode, 405);
  assert.equal(
    (
      await handleRequest(
        { ...request, headers: { ...request.headers, "content-type": "text/plain" } },
        options,
      )
    ).statusCode,
    415,
  );
  assert.equal(
    (
      await handleRequest(
        {
          ...request,
          headers: { ...request.headers, "content-type": "application/json; charset=utf-8" },
        },
        options,
      )
    ).statusCode,
    200,
  );
  for (const body of [undefined, "", "{", "null", "[]", "{}"])
    assert.equal((await handleRequest({ ...request, body }, options)).statusCode, 400);
  const malformed = await handleRequest(
    {
      ...request,
      body: JSON.stringify({
        ...payload,
        medicines: [{ ...payload.medicines[0], dose: { quantity: -1, unit: "tablet" } }],
      }),
    },
    options,
  );
  assert.equal(malformed.statusCode, 400);
  assert.ok(
    JSON.parse(malformed.body!).errors.some(
      (error: { path: string }) => error.path === "$.medicines[0].dose.quantity",
    ),
  );
  assert.equal(
    (
      await handleRequest(
        { ...request, body: "é".repeat(MAX_SCHEDULE_BODY_BYTES / 2 + 1) },
        options,
      )
    ).statusCode,
    413,
  );
  assert.equal((await handleRequest({ ...request, path: "/api/random" }, options)).statusCode, 405);
});

test("an evaluated but blocked plan is HTTP 200 with warnings and no schedule", async () => {
  const result = await handleRequest(
    {
      ...request,
      body: JSON.stringify({
        ...payload,
        routine: { ...payload.routine, meals: { breakfast: null, lunch: null, dinner: null } },
      }),
    },
    options,
  );
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body!);
  assert.equal(body.status, "blocked");
  assert.equal(body.schedule, null);
  assert.ok(body.warnings.some((warning: { blocking: boolean }) => warning.blocking));
});

test("Lambda forwards plain and base64-encoded request bodies", async () => {
  const previous = process.env.ORIGIN_SECRET;
  process.env.ORIGIN_SECRET = options.originSecret;
  try {
    for (const encoded of [false, true]) {
      const event = {
        rawPath: request.path,
        headers: request.headers,
        requestContext: { http: { method: "POST" } },
        body: encoded ? Buffer.from(request.body).toString("base64") : request.body,
        isBase64Encoded: encoded,
      } as unknown as APIGatewayProxyEventV2;
      const response = await handler(event);
      assert.equal(response.statusCode, 200);
      assert.equal(JSON.parse(response.body!).schedule.doses.length, 2);
    }
  } finally {
    if (previous === undefined) delete process.env.ORIGIN_SECRET;
    else process.env.ORIGIN_SECRET = previous;
  }
});

test(
  "the real local HTTP adapter reads JSON POST bodies and limits their size",
  { timeout: 10_000 },
  async (t) => {
    const server = createLocalServer();
    t.after(
      () =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    );
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/schedules`;
    const result = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: request.body,
    });
    assert.equal(result.status, 200);
    assert.equal(((await result.json()) as { status: string }).status, "proposed");
    const invalid = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(invalid.status, 400);
    await invalid.text();
    const oversized = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: " ".repeat(MAX_SCHEDULE_BODY_BYTES + 1),
    });
    assert.equal(oversized.status, 413);
    await oversized.text();
  },
);
