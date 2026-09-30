import type {
  GamePhase,
  LifeState,
  PlayerInput,
  PredictedState,
  SimEvent,
  Vec3,
  WeaponId,
  ZombieMode,
} from '@dotd/sim';

/** Bumped whenever the wire format changes; clients and servers must match. */
export const PROTOCOL_VERSION = 1;

// ── Client → server ────────────────────────────────────────────────────────

export type ClientMessage =
  /** Inputs not yet sent, oldest first. Usually one per tick. */
  { type: 'input'; inputs: PlayerInput[] } | { type: 'ping'; clientTime: number };

// ── Server → client ────────────────────────────────────────────────────────

export interface RosterEntry {
  id: number;
  name: string;
}

export interface PlayerSnapshot {
  id: number;
  pos: Vec3;
  yaw: number;
  pitch: number;
  life: LifeState;
  health: number;
  maxHealth: number;
  points: number;
  kills: number;
  headshots: number;
  weaponId: WeaponId;
  /** Buttons from the player's latest input, for remote animation (aiming, firing...). */
  buttons: number;
  grounded: boolean;
  sprinting: boolean;
  reloading: boolean;
}

export interface ZombieSnapshot {
  id: number;
  pos: Vec3;
  yaw: number;
  mode: ZombieMode;
  /** 0..1 */
  healthFraction: number;
  /** Top speed in m/s, used to pick walk/run/sprint animations. */
  speed: number;
}

export interface GameSnapshot {
  phase: GamePhase;
  round: number;
  phaseTimer: number;
  /** Zombies still to spawn plus those alive. */
  zombiesRemaining: number;
}

export type TickedEvent = SimEvent & { tick: number };

export interface Snapshot {
  tick: number;
  /** Last input sequence number the server applied for the recipient. */
  ackSeq: number;
  /** The recipient's own predicted state after `ackSeq`, for reconciliation. */
  self: PredictedState | null;
  game: GameSnapshot;
  players: PlayerSnapshot[];
  zombies: ZombieSnapshot[];
  /** Everything that happened since the previous snapshot. */
  events: TickedEvent[];
}

export type ServerMessage =
  | { type: 'welcome'; playerId: number; roomCode: string; levelId: string; tick: number }
  | { type: 'roster'; players: RosterEntry[] }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'pong'; clientTime: number; serverTick: number }
  | { type: 'error'; reason: string };
