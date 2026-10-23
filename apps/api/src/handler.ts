import { randomInt, timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import type { RandomNumberResponse } from '@hackathon/api-contract';

export const ORIGIN_HEADER = 'x-hackathon-origin';

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
}

interface HandlerOptions {
  originSecret: string | undefined;
  generateNumber?: () => number;
}

function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    body: JSON.stringify(body),
  };
}

function matchesSecret(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const actual = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function handleRequest(request: ApiRequest, options: HandlerOptions): APIGatewayProxyStructuredResultV2 {
  // Fail closed if deployment configuration is missing, too.
  if (!matchesSecret(request.headers[ORIGIN_HEADER], options.originSecret)) {
    return json(403, { message: 'Forbidden' });
  }
  if (request.path !== '/api/random') return json(404, { message: 'Not found' });
  if (request.method !== 'GET') {
    const response = json(405, { message: 'Method not allowed' });
    response.headers = { ...response.headers, allow: 'GET' };
    return response;
  }
  const response: RandomNumberResponse = { number: (options.generateNumber ?? (() => randomInt(1, 101)))() };
  return json(200, response);
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  return handleRequest({ method: event.requestContext.http.method, path: event.rawPath, headers: event.headers }, { originSecret: process.env.ORIGIN_SECRET });
}
