import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { decodeServerMessage, encodeClientMessage, PROTOCOL_VERSION } from '@dotd/protocol';
import type { ServerMessage } from '@dotd/protocol';
import { GameServer } from '../src/gameServer';

let server: GameServer;
let port: number;
let staticDir: string;

beforeEach(async () => {
  staticDir = mkdtempSync(join(tmpdir(), 'dotd-static-'));
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>DOTD</title>');
  server = new GameServer({ port: 0, host: '127.0.0.1', staticDir });
  port = await server.start();
});

afterEach(() => server.stop());

/** Connects a client and collects decoded messages. */
function connect(query: Record<string, string>) {
  const params = new URLSearchParams({ v: String(PROTOCOL_VERSION), ...query });
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?${params}`);
  socket.binaryType = 'arraybuffer';
  const messages: ServerMessage[] = [];
  const waiters: (() => void)[] = [];
  socket.on('message', (data) => {
    messages.push(decodeServerMessage(new Uint8Array(data as ArrayBuffer)));
    waiters.splice(0).forEach((w) => w());
  });
  const closed = new Promise<void>((resolve) => socket.on('close', () => resolve()));

  async function waitFor<T extends ServerMessage['type']>(
    type: T,
    predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const found = messages.find(
        (m): m is Extract<ServerMessage, { type: T }> => m.type === type && predicate(m as never),
      );
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${type}`);
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 200);
      });
    }
  }

  return { socket, messages, waitFor, closed };
}

describe('GameServer', () => {
  it('creates a room for a host and lets a friend join with the code', async () => {
    const host = connect({ name: 'Host' });
    const welcome = await host.waitFor('welcome');
    expect(welcome.playerId).toBe(1);
    expect(welcome.roomCode).toMatch(/^[A-Z]{4}$/);

    const friend = connect({ name: 'Friend', room: welcome.roomCode.toLowerCase() });
    expect((await friend.waitFor('welcome')).playerId).toBe(2);
    const roster = await host.waitFor('roster', (m) => m.players.length === 2);
    expect(roster.players.map((p) => p.name)).toEqual(['Host', 'Friend']);

    const snapshot = await friend.waitFor('snapshot');
    expect(snapshot.snapshot.players).toHaveLength(2);
    expect(server.stats).toEqual({ rooms: 1, players: 2 });

    friend.socket.send(encodeClientMessage({ type: 'ping', clientTime: 1 }));
    expect((await friend.waitFor('pong')).clientTime).toBe(1);

    host.socket.close();
    friend.socket.close();
    await Promise.all([host.closed, friend.closed]);
    await new Promise((r) => setTimeout(r, 50));
    expect(server.stats).toEqual({ rooms: 0, players: 0 });
  });

  it('rejects unknown room codes', async () => {
    const client = connect({ name: 'Lost', room: 'ZZZZ' });
    expect((await client.waitFor('error')).reason).toMatch(/No game found/);
    await client.closed;
  });

  it('rejects clients on a different protocol version', async () => {
    const client = connect({ name: 'Old', v: '0' });
    expect((await client.waitFor('error')).reason).toMatch(/version/);
    await client.closed;
  });

  it('serves health and static files', async () => {
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
    expect(health).toMatchObject({ ok: true, rooms: 0 });
    const page = await fetch(`http://127.0.0.1:${port}/some/route`).then((r) => r.text());
    expect(page).toContain('DOTD');
    const traversal = await fetch(`http://127.0.0.1:${port}/%2e%2e/%2e%2e/etc/passwd`);
    expect(await traversal.text()).not.toContain('root:');
    const malformed = await fetch(`http://127.0.0.1:${port}/%E0%A4%A`);
    expect(malformed.status).toBe(404);
  });
});
