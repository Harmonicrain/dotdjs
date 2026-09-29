import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { randomInt } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import { encodeServerMessage, PROTOCOL_VERSION } from '@dotd/protocol';
import { generateRoomCode, normalizeRoomCode, Room } from '@dotd/room';
import type { Connection } from '@dotd/room';
import { serveStatic } from './static';

export interface GameServerOptions {
  port: number;
  host?: string;
  /** Directory of the built client to serve over HTTP, if any. */
  staticDir?: string;
  maxRooms?: number;
}

/** Stop sending to a client that has this much unsent data; it will get caught up by later snapshots. */
const MAX_BUFFERED_BYTES = 512 * 1024;
const MAX_MESSAGE_BYTES = 4 * 1024;
const LOOP_INTERVAL_MS = 4;

function toBytes(data: RawData): Uint8Array {
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function reject(socket: WebSocket, reason: string): void {
  socket.send(encodeServerMessage({ type: 'error', reason }));
  socket.close(4000, reason);
}

/** Hosts game rooms over WebSockets at `/ws?name=…&room=…&v=…`. */
export class GameServer {
  private readonly http: Server;
  private readonly wss: WebSocketServer;
  private readonly rooms = new Map<string, Room>();
  private readonly pendingRooms = new Map<string, Promise<Room>>();
  private loop: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: GameServerOptions) {
    this.http = createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
    this.http.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => void this.handleSocket(ws, url));
    });
  }

  /** Starts listening and ticking. Resolves with the bound port. */
  async start(): Promise<number> {
    await new Promise<void>((resolve) =>
      this.http.listen(this.options.port, this.options.host ?? '0.0.0.0', resolve),
    );
    this.loop = setInterval(() => {
      const now = performance.now();
      for (const room of this.rooms.values()) room.update(now);
    }, LOOP_INTERVAL_MS);
    const address = this.http.address();
    return typeof address === 'object' && address ? address.port : this.options.port;
  }

  async stop(): Promise<void> {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
    for (const client of this.wss.clients) client.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }

  get stats(): { rooms: number; players: number } {
    let players = 0;
    for (const room of this.rooms.values()) players += room.playerCount;
    return { rooms: this.rooms.size, players };
  }

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...this.stats }));
      return;
    }
    if (this.options.staticDir && serveStatic(this.options.staticDir, url.pathname, res)) return;
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }

  private async handleSocket(socket: WebSocket, url: URL): Promise<void> {
    socket.binaryType = 'nodebuffer';
    if (Number(url.searchParams.get('v')) !== PROTOCOL_VERSION) {
      reject(socket, 'Game version mismatch. Refresh the page to update.');
      return;
    }

    const requestedCode = url.searchParams.get('room');
    let room: Room | undefined;
    if (requestedCode) {
      const code = normalizeRoomCode(requestedCode);
      room = code ? this.rooms.get(code) : undefined;
      if (!room) {
        reject(socket, `No game found with code ${requestedCode.toUpperCase()}`);
        return;
      }
    } else {
      if (this.rooms.size + this.pendingRooms.size >= (this.options.maxRooms ?? 200)) {
        reject(socket, 'Server is full. Try again later.');
        return;
      }
      room = await this.createRoom();
    }
    if (socket.readyState !== WebSocket.OPEN) {
      this.disposeIfEmpty(room);
      return;
    }

    const connection: Connection = {
      send: (bytes) => {
        if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < MAX_BUFFERED_BYTES) {
          socket.send(bytes);
        }
      },
      close: () => socket.close(),
    };
    const playerId = room.join(connection, url.searchParams.get('name') ?? '');
    if (playerId === null) return;

    const joinedRoom = room;
    socket.on('message', (data) => joinedRoom.receive(playerId, toBytes(data)));
    socket.on('close', () => {
      joinedRoom.leave(playerId);
      this.disposeIfEmpty(joinedRoom);
    });
  }

  private async createRoom(): Promise<Room> {
    const code = generateRoomCode(
      () => randomInt(0, 1 << 30) / (1 << 30),
      (c) => this.rooms.has(c) || this.pendingRooms.has(c),
    );
    const pending = Room.create({ code, seed: randomInt(0, 2 ** 31) });
    this.pendingRooms.set(code, pending);
    try {
      const room = await pending;
      this.rooms.set(code, room);
      return room;
    } finally {
      this.pendingRooms.delete(code);
    }
  }

  private disposeIfEmpty(room: Room): void {
    if (room.playerCount > 0) return;
    room.dispose();
    this.rooms.delete(room.code);
  }
}
