import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest, handler, ORIGIN_HEADER } from './handler';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { fileURLToPath } from 'node:url';
import { createFilePatientRepository } from './patient-data';
import { isRandomNumberResponse } from '@hackathon/api-contract';

const request = { method: 'GET', path: '/api/random', headers: { [ORIGIN_HEADER]: 'test-secret' } };
const options = { originSecret: 'test-secret' };

test('rejects direct access, incorrect secrets and missing deployment configuration', async () => {
  for (const originSecret of [undefined, '', 'wrong', 'same-length']) {
    assert.equal((await handleRequest({ ...request, headers: { [ORIGIN_HEADER]: originSecret } }, options)).statusCode, 403);
  }
  assert.equal((await handleRequest(request, { originSecret: undefined })).statusCode, 403);
});

test('returns a generated integer from 1 to 100 and prevents response caching', async () => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const response = await handleRequest(request, options);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers?.['cache-control'], 'no-store');
    assert.ok(isRandomNumberResponse(JSON.parse(response.body!)));
  }
  for (const number of [1, 100]) {
    assert.equal(JSON.parse((await handleRequest(request, { ...options, generateNumber: () => number })).body!).number, number);
  }
});

test('rejects unknown paths and unsupported methods', async () => {
  assert.equal((await handleRequest({ ...request, path: '/api/missing' }, options)).statusCode, 404);
  const response = await handleRequest({ ...request, method: 'POST' }, options);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers?.allow, 'GET');
});

test('the Lambda entry point enforces the origin check', async () => {
  const previous = process.env.ORIGIN_SECRET;
  process.env.ORIGIN_SECRET = 'test-secret';
  try {
    const event = { rawPath: '/api/random', headers: request.headers, requestContext: { http: { method: 'GET' } } } as unknown as APIGatewayProxyEventV2;
    assert.equal((await handler(event)).statusCode, 200);
    assert.equal((await handler({ ...event, headers: {} })).statusCode, 403);
  } finally {
    if (previous === undefined) delete process.env.ORIGIN_SECRET;
    else process.env.ORIGIN_SECRET = previous;
  }
});

const patients = createFilePatientRepository(fileURLToPath(new URL('../../../test_data', import.meta.url)));
const get = async (path: string) => {
  const response = await handleRequest({ ...request, path }, { ...options, patients });
  return { status: response.statusCode, body: JSON.parse(response.body!) };
};
const MITCH = '9993679666';

test('lists the available patients', async () => {
  const { status, body } = await get('/api/patients');
  assert.equal(status, 200);
  assert.equal(body.patients.length, 7);
  assert.ok(body.patients.some((p: { nhsNumber: string; name: string }) => p.nhsNumber === MITCH && p.name === 'Mitch XXTESTPATIENT-Trantow'));
});

test('returns patient demographics', async () => {
  const { status, body } = await get(`/api/patients/${MITCH}/demographics`);
  assert.equal(status, 200);
  assert.equal(body.nhsNumber, MITCH);
  assert.equal(body.birthDate, '1945-06-28');
  assert.equal(body.address.postalCode, 'BD3 7CL');
});

test('returns only current, de-duplicated medications', async () => {
  const { status, body } = await get(`/api/patients/${MITCH}/medications`);
  assert.equal(status, 200);
  assert.ok(body.medications.length > 0 && body.medications.length <= 13);
  const codes = body.medications.map((m: { code: string }) => m.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(body.medications.every((m: { name: string }) => m.name));
});

test('rejects malformed and unknown NHS numbers', async () => {
  assert.equal((await get('/api/patients/abc/medications')).status, 400);
  assert.equal((await get('/api/patients/..%2F..%2Fetc/medications')).status, 400);
  assert.equal((await get('/api/patients/1234567890/medications')).status, 404);
  assert.equal((await get('/api/patients/1234567890/other')).status, 404);
});

test('lists every distinct current medicine across all patients', async () => {
  const { status, body } = await get('/api/medicines');
  assert.equal(status, 200);
  const keys = body.medicines.map((m: { code?: string; name: string }) => m.code ?? m.name);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(body.medicines.length, 36);
  assert.ok(body.medicines.some((m: { name: string }) => m.name === 'Naproxen 250mg tablets'));
  assert.ok(body.medicines.every((m: Record<string, unknown>) => Object.keys(m).every(key => ['name', 'code', 'system'].includes(key))));
});

test('interactions endpoint returns demo guidance for the current patient medicines', async () => {
  const nhsNumber = '9991789243';
  const { status, body } = await get(`/api/patients/${nhsNumber}/interactions`);
  assert.equal(status, 200);
  assert.equal(body.nhsNumber, nhsNumber);
  assert.equal(body.demoOnly, true);
  assert.equal(body.clinicallyValidated, false);
  assert.ok(body.interactions.length > 0);
  const record = (await patients.getMedications(nhsNumber))!;
  for (const interaction of body.interactions) {
    assert.ok(interaction.medications.every((m: { id: string }) => record.medications.some(current => current.id === m.id)));
    assert.ok(interaction.patientGuidance);
  }
});

test('interactions endpoint preserves validation, origin protection and GET-only access', async () => {
  assert.equal((await get('/api/patients/abc/interactions')).status, 400);
  assert.equal((await get('/api/patients/1234567890/interactions')).status, 404);
  const path = `/api/patients/${MITCH}/interactions`;
  assert.equal((await handleRequest({ ...request, path, headers: {} }, options)).statusCode, 403);
  const post = await handleRequest({ ...request, path, method: 'POST' }, options);
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers?.allow, 'GET');
  assert.equal((await handleRequest({ ...request, path }, { ...options, patients })).headers?.['cache-control'], 'no-store');
});

test('schedule-inputs endpoint combines original prescriptions, administration and interactions', async () => {
  const nhsNumber = '9991789243';
  const { status, body } = await get(`/api/patients/${nhsNumber}/schedule-inputs`);
  assert.equal(status, 200);
  assert.equal(body.nhsNumber, nhsNumber);
  assert.equal(body.demoOnly, true);
  assert.equal(body.clinicallyValidated, false);
  assert.equal(body.readiness.status, 'review_required');
  assert.equal(body.interactions.interactions.length, 3);
  assert.equal(body.medicines.length, (await patients.getMedications(nhsNumber))!.medications.length);
  assert.ok(body.medicines.every((m: { medication: { dosageInstructions: unknown[] } }) => m.medication.dosageInstructions));
});

test('schedule-inputs endpoint retains validation, origin protection, GET-only and no-store behaviour', async () => {
  assert.equal((await get('/api/patients/abc/schedule-inputs')).status, 400);
  assert.equal((await get('/api/patients/1234567890/schedule-inputs')).status, 404);
  const path = `/api/patients/${MITCH}/schedule-inputs`;
  assert.equal((await handleRequest({ ...request, path, headers: {} }, options)).statusCode, 403);
  assert.equal((await handleRequest({ ...request, path, method: 'POST' }, options)).statusCode, 405);
  assert.equal((await handleRequest({ ...request, path }, { ...options, patients })).headers?.['cache-control'], 'no-store');
});
