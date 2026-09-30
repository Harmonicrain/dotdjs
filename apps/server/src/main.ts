import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GameServer } from './gameServer';

const port = Number(process.env.PORT ?? 8787);
const defaultStaticDir = fileURLToPath(new URL('../../client/dist', import.meta.url));
const staticDir =
  process.env.STATIC_DIR ?? (existsSync(defaultStaticDir) ? defaultStaticDir : undefined);

const server = new GameServer({ port, ...(staticDir ? { staticDir } : {}) });
const boundPort = await server.start();
console.info(
  `DOM OF THE DEAD server listening on :${boundPort}${staticDir ? ` (serving ${staticDir})` : ''}`,
);

const shutdown = () => {
  void server.stop().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
