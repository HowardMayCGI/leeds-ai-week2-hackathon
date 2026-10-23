import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest, handler, ORIGIN_HEADER } from './handler';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { isRandomNumberResponse } from '@hackathon/api-contract';

const request = { method: 'GET', path: '/api/random', headers: { [ORIGIN_HEADER]: 'test-secret' } };
const options = { originSecret: 'test-secret' };

test('rejects direct access, incorrect secrets and missing deployment configuration', () => {
  for (const originSecret of [undefined, '', 'wrong', 'same-length']) {
    assert.equal(handleRequest({ ...request, headers: { [ORIGIN_HEADER]: originSecret } }, options).statusCode, 403);
  }
  assert.equal(handleRequest(request, { originSecret: undefined }).statusCode, 403);
});

test('returns a generated integer from 1 to 100 and prevents response caching', () => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const response = handleRequest(request, options);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers?.['cache-control'], 'no-store');
    assert.ok(isRandomNumberResponse(JSON.parse(response.body!)));
  }
  for (const number of [1, 100]) {
    assert.equal(JSON.parse(handleRequest(request, { ...options, generateNumber: () => number }).body!).number, number);
  }
});

test('rejects unknown paths and unsupported methods', () => {
  assert.equal(handleRequest({ ...request, path: '/api/missing' }, options).statusCode, 404);
  const response = handleRequest({ ...request, method: 'POST' }, options);
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
