import { cpSync } from 'node:fs';
import { build } from 'esbuild';

build({
  entryPoints: ['apps/api/src/handler.ts'],
  outfile: 'dist/apps/api/index.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  sourcemap: true,
}).then(() => cpSync('test_data', 'dist/apps/api/test_data', { recursive: true })).catch(() => process.exit(1));
