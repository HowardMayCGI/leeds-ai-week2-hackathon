import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const destination = path.resolve('apps/web/public/assets');
mkdirSync(destination, { recursive: true });
cpSync(path.resolve('apps/web/node_modules/nhsuk-frontend/dist/nhsuk/assets'), destination, { recursive: true });
