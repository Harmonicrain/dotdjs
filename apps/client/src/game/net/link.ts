import {
  decodeServerMessage,
  encodeClientMessage,
  PROTOCOL_VERSION,
} from '@dotd/protocol';
import type { ClientMessage, ServerMessage } from '@dotd/protocol';

/** A connection to an authoritative room, wherever it runs. */
export interface ServerLink {
  send(message: ClientMessage): void;
  close(): void;
  /** Solo games can pause the simulation; multiplayer links ignore this. */
  setPaused(paused: boolean): void;
  onMessage: (message: ServerMessage) => void;
  /** Called once when the link drops; `reason` is null for a normal close. */
  onClose: (reason: string | null) => void;
}

abstract class BaseLink implements ServerLink {
  onMessage: (message: ServerMessage) => void = () => {};
  onClose: (reason: string | null) => void = () => {};
  protected closed = false;
  private lastError: string | null = null;

  abstract send(message: ClientMessage): void;
  abstract close(): void;
  setPaused(_paused: boolean): void {}

  protected deliver(bytes: Uint8Array): void {
    let message: ServerMessage;
    try {
      message = decodeServerMessage(bytes);
    } catch (error) {
      console.error('Bad message from server', error);
      return;
    }
    if (message.type === 'error') this.lastError = message.reason;
    this.onMessage(message);
  }

  protected finish(fallbackReason: string | null): void {
    if (this.closed) return;
    this.closed = true;
    this.onClose(this.lastError ?? fallbackReason);
  }
}

export function serverUrl(params: { name: string; room?: string }): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
  const base =
    configured ??
    `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
  const query = new URLSearchParams({ v: String(PROTOCOL_VERSION), name: params.name });
  if (params.room) query.set('room', params.room);
  return `${base}?${query}`;
}

/** Multiplayer: a WebSocket to the game server. */
export class WebSocketLink extends BaseLink {
  private readonly socket: WebSocket;

  constructor(url: string) {
    super();
    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer';
    this.socket.onmessage = (event) => this.deliver(new Uint8Array(event.data as ArrayBuffer));
    this.socket.onclose = (event) =>
      this.finish(event.wasClean ? null : 'Lost connection to the server');
    this.socket.onerror = () => this.finish('Could not reach the game server');
  }

  send(message: ClientMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(encodeClientMessage(message));
  }

  close(): void {
    this.closed = true;
    this.socket.close();
  }
}

/** Messages between the page and the solo worker. */
export type ToWorker =
  | { kind: 'start'; name: string }
  | { kind: 'data'; bytes: Uint8Array }
  | { kind: 'pause'; paused: boolean };

export type FromWorker = { kind: 'data'; bytes: Uint8Array } | { kind: 'error'; message: string };

/** Solo: the same authoritative room, running in a Web Worker on this machine. */
export class WorkerLink extends BaseLink {
  private readonly worker: Worker;

  constructor(name: string) {
    super();
    this.worker = new Worker(new URL('../../worker/solo.worker.ts', import.meta.url), {
      type: 'module',
      name: 'solo-room',
    });
    this.worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const data = event.data;
      if (data.kind === 'data') this.deliver(data.bytes);
      else this.finish(data.message);
    };
    this.worker.onerror = (event) => this.finish(event.message || 'Solo game crashed');
    this.post({ kind: 'start', name });
  }

  send(message: ClientMessage): void {
    const bytes = encodeClientMessage(message);
    this.post({ kind: 'data', bytes }, [bytes.buffer]);
  }

  setPaused(paused: boolean): void {
    this.post({ kind: 'pause', paused });
  }

  close(): void {
    this.closed = true;
    this.worker.terminate();
  }

  private post(message: ToWorker, transfer: Transferable[] = []): void {
    if (!this.closed) this.worker.postMessage(message, transfer);
  }
}
