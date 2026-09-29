import {
  addPlayer,
  applyPlayerInput,
  createWorld,
  DEFAULT_LEVEL_ID,
  disposeWorld,
  drainEvents,
  initSim,
  MAX_PLAYERS,
  removePlayer,
  SNAPSHOT_INTERVAL_TICKS,
  stepWorld,
  TICK_DT,
} from '@dotd/sim';
import type { PlayerInput, World } from '@dotd/sim';
import { decodeClientMessage, encodeServerMessage } from '@dotd/protocol';
import type { ServerMessage, TickedEvent } from '@dotd/protocol';
import { buildSharedSnapshot, snapshotFor } from './snapshot';

/** A client's link to the room. Hosts adapt WebSockets, MessagePorts or test doubles to this. */
export interface Connection {
  send(bytes: Uint8Array): void;
  close(): void;
}

export interface RoomOptions {
  code: string;
  seed: number;
  levelId?: string;
}

interface Member {
  playerId: number;
  connection: Connection;
  inputs: PlayerInput[];
  /** Inputs this member may still apply; refills by one per tick (anti speed-hack). */
  inputBudget: number;
  lastQueuedSeq: number;
}

/** Inputs a member can bank to catch up after a network hiccup. */
const MAX_INPUT_BUDGET = 8;
/** Inputs queued beyond this are dropped (about a second's worth). */
const MAX_QUEUED_INPUTS = 60;
/** After a long stall the room skips ahead rather than fast-forwarding. */
const MAX_TICKS_PER_UPDATE = 10;

/**
 * An authoritative game session: owns the world, applies player inputs in order, steps the
 * simulation at a fixed rate and sends every member a snapshot 20 times a second.
 */
export class Room {
  readonly code: string;
  readonly world: World;
  /** Solo games pause the whole simulation; multiplayer games never pause. */
  paused = false;

  private readonly members = new Map<number, Member>();
  private pendingEvents: TickedEvent[] = [];
  private accumulator = 0;
  private lastUpdateMs: number | null = null;
  private disposed = false;

  /** Loads the physics/navigation WASM (once) and creates a room. */
  static async create(options: RoomOptions): Promise<Room> {
    await initSim();
    return new Room(options);
  }

  private constructor(options: RoomOptions) {
    this.code = options.code;
    this.world = createWorld({ levelId: options.levelId ?? DEFAULT_LEVEL_ID, seed: options.seed });
  }

  get playerCount(): number {
    return this.members.size;
  }

  get isFull(): boolean {
    return this.members.size >= MAX_PLAYERS;
  }

  /** Adds a player. Returns their id, or null (after telling the client why) if the room is full. */
  join(connection: Connection, name: string): number | null {
    const player = this.isFull ? null : addPlayer(this.world, name);
    if (!player) {
      this.sendTo(connection, { type: 'error', reason: 'Room is full' });
      connection.close();
      return null;
    }
    this.members.set(player.id, {
      playerId: player.id,
      connection,
      inputs: [],
      inputBudget: MAX_INPUT_BUDGET,
      lastQueuedSeq: 0,
    });
    this.sendTo(connection, {
      type: 'welcome',
      playerId: player.id,
      roomCode: this.code,
      levelId: this.world.level.id,
      tick: this.world.tick,
    });
    this.broadcastRoster();
    return player.id;
  }

  leave(playerId: number): void {
    if (!this.members.delete(playerId)) return;
    removePlayer(this.world, playerId);
    this.broadcastRoster();
  }

  /** Handles raw bytes from a member. Malformed data gets the sender disconnected. */
  receive(playerId: number, bytes: Uint8Array): void {
    const member = this.members.get(playerId);
    if (!member) return;

    let message;
    try {
      message = decodeClientMessage(bytes);
    } catch {
      this.kick(member, 'Malformed message');
      return;
    }

    switch (message.type) {
      case 'input':
        for (const input of message.inputs) {
          if (input.seq <= member.lastQueuedSeq) continue; // duplicate or stale
          member.lastQueuedSeq = input.seq;
          member.inputs.push(input);
        }
        if (member.inputs.length > MAX_QUEUED_INPUTS) {
          member.inputs.splice(0, member.inputs.length - MAX_QUEUED_INPUTS);
        }
        return;
      case 'ping':
        this.sendTo(member.connection, {
          type: 'pong',
          clientTime: message.clientTime,
          serverTick: this.world.tick,
        });
        return;
    }
  }

  /** Advances the simulation to wall-clock time `nowMs`, running as many fixed ticks as are due. */
  update(nowMs: number): void {
    if (this.paused || this.lastUpdateMs === null) {
      this.lastUpdateMs = nowMs;
      return;
    }
    this.accumulator += (nowMs - this.lastUpdateMs) / 1000;
    this.lastUpdateMs = nowMs;

    let ticks = 0;
    while (this.accumulator >= TICK_DT && ticks < MAX_TICKS_PER_UPDATE) {
      this.accumulator -= TICK_DT;
      this.step();
      ticks++;
    }
    if (ticks === MAX_TICKS_PER_UPDATE) this.accumulator = 0;
  }

  /** Runs exactly one simulation tick. */
  step(): void {
    for (const member of this.members.values()) {
      member.inputBudget = Math.min(MAX_INPUT_BUDGET, member.inputBudget + 1);
      while (member.inputBudget >= 1 && member.inputs.length > 0) {
        member.inputBudget -= 1;
        applyPlayerInput(this.world, member.playerId, member.inputs.shift()!);
      }
    }

    stepWorld(this.world);

    const tick = this.world.tick;
    for (const event of drainEvents(this.world)) this.pendingEvents.push({ ...event, tick });

    if (tick % SNAPSHOT_INTERVAL_TICKS === 0) this.broadcastSnapshots();
  }

  /** Disconnects everyone and frees the WASM-backed world. Safe to call more than once. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const member of this.members.values()) member.connection.close();
    this.members.clear();
    disposeWorld(this.world);
  }

  private broadcastSnapshots(): void {
    const shared = buildSharedSnapshot(this.world, this.pendingEvents);
    this.pendingEvents = [];
    for (const member of this.members.values()) {
      const snapshot = snapshotFor(shared, this.world.players.get(member.playerId));
      this.sendTo(member.connection, { type: 'snapshot', snapshot });
    }
  }

  private broadcastRoster(): void {
    const players = [...this.world.players.values()].map((p) => ({ id: p.id, name: p.name }));
    for (const member of this.members.values()) {
      this.sendTo(member.connection, { type: 'roster', players });
    }
  }

  private kick(member: Member, reason: string): void {
    this.sendTo(member.connection, { type: 'error', reason });
    member.connection.close();
    this.leave(member.playerId);
  }

  private sendTo(connection: Connection, message: ServerMessage): void {
    connection.send(encodeServerMessage(message));
  }
}
