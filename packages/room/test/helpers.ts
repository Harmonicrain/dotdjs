import { decodeServerMessage } from '@dotd/protocol';
import type { ServerMessage, Snapshot } from '@dotd/protocol';
import type { Connection } from '../src/room';

/** In-memory client connection that decodes everything the room sends it. */
export class TestClient implements Connection {
  readonly messages: ServerMessage[] = [];
  closed = false;

  send(bytes: Uint8Array): void {
    this.messages.push(decodeServerMessage(bytes));
  }

  close(): void {
    this.closed = true;
  }

  ofType<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }

  get snapshots(): Snapshot[] {
    return this.ofType('snapshot').map((m) => m.snapshot);
  }

  get latestSnapshot(): Snapshot | undefined {
    return this.snapshots.at(-1);
  }
}
