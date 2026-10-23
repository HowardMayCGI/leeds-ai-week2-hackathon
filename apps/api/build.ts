import { build } from 'esbuild';

build({
  entryPoints: ['apps/api/src/handler.ts'],
  outfile: 'dist/apps/api/index.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  sourcemap: true,
}).catch(() => process.exit(1));
