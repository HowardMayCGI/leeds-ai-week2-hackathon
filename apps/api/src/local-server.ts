import { createServer } from 'node:http';
import { handleRequest, ORIGIN_HEADER } from './handler';

export function createLocalServer() {
  return createServer(async (request, response) => {
    // This loopback-only adapter stands in for CloudFront during local development.
    const result = await handleRequest({
      method: request.method ?? 'GET',
      path: new URL(request.url ?? '/', 'http://localhost').pathname,
      headers: { [ORIGIN_HEADER]: 'local-development' },
    }, { originSecret: 'local-development' });
    response.writeHead(result.statusCode ?? 500, result.headers as Record<string, string>);
    response.end(result.body);
  });
}
