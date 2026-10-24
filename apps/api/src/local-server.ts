import { createServer } from "node:http";
import { handleRequest, ORIGIN_HEADER } from "./handler";
import { MAX_SCHEDULE_BODY_BYTES } from "./schedule-validation";

export function createLocalServer() {
  return createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size <= MAX_SCHEDULE_BODY_BYTES) chunks.push(buffer);
      }
    } catch {
      response.writeHead(400, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({ message: "Unable to read request body" }));
      return;
    }
    // This loopback-only adapter stands in for CloudFront during local development.
    const result = await handleRequest(
      {
        method: request.method ?? "GET",
        path: new URL(request.url ?? "/", "http://localhost").pathname,
        headers: {
          [ORIGIN_HEADER]: "local-development",
          "content-type": request.headers["content-type"],
        },
        body:
          size > MAX_SCHEDULE_BODY_BYTES
            ? " ".repeat(MAX_SCHEDULE_BODY_BYTES + 1)
            : Buffer.concat(chunks).toString("utf8"),
      },
      { originSecret: "local-development" },
    );
    response.writeHead(result.statusCode ?? 500, result.headers as Record<string, string>);
    response.end(result.body);
  });
}
