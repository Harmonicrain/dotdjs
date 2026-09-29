import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { ServerResponse } from 'node:http';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.ktx2': 'image/ktx2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
};

/**
 * Serves a file from `root`, falling back to index.html for client-side routes.
 * Returns false if nothing was served.
 */
export function serveStatic(root: string, pathname: string, res: ServerResponse): boolean {
  const base = resolve(root);
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false; // malformed escape sequence
  }
  const requested = resolve(join(base, normalize(decoded)));
  if (requested !== base && !requested.startsWith(base + sep)) return false; // path traversal

  let file = requested;
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(base, 'index.html');
  if (!existsSync(file)) return false;

  const hashedAsset = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': hashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(readFileSync(file));
  return true;
}
