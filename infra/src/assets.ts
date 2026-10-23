import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

export function listFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(join(directory, entry.name), relative) : [relative];
  }).sort();
}

export function contentType(file: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.webp': 'image/webp',
  };
  return types[extname(file)] ?? 'application/octet-stream';
}

export function cacheControl(file: string): string {
  return file.startsWith('_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache, max-age=0, must-revalidate';
}
