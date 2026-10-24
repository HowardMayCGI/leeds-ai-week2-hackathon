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
