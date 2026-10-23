import { createLocalServer } from './local-server';

const server = createLocalServer();
server.listen(3001, '127.0.0.1', () => console.log('Local API: http://127.0.0.1:3001/api/random'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
