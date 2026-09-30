import { WEAPON_IDS } from '@dotd/sim';
import type {
  GamePhase,
  LifeState,
  PlayerInput,
  PredictedState,
  SimEvent,
  SimEventType,
  Vec3,
  WeaponId,
  ZombieMode,
} from '@dotd/sim';
import { ProtocolError, Reader, Writer } from './bytes';
import type {
  ClientMessage,
  GameSnapshot,
  PlayerSnapshot,
  ServerMessage,
  Snapshot,
  TickedEvent,
  ZombieSnapshot,
} from './messages';
import {
  angleFromWire,
  angleToWire,
  axisFromWire,
  axisToWire,
  posFromWire,
  posToWire,
  quantizeInput,
} from './quantize';

const ClientType = { Input: 1, Ping: 2 } as const;

const ServerType = { Welcome: 1, Roster: 2, Snapshot: 3, Pong: 4, Error: 5 } as const;

export const MAX_INPUTS_PER_MESSAGE = 32;

// Enumerations are sent as their index in these lists. Append only.
const PHASES: readonly GamePhase[] = ['waiting', 'pregame', 'active', 'intermission', 'over'];
const LIFE_STATES: readonly LifeState[] = ['alive', 'dead'];
const ZOMBIE_MODES: readonly ZombieMode[] = ['rising', 'chasing', 'attacking', 'dead'];
const EVENT_TYPES: readonly SimEventType[] = [
  'shot',
  'zombieHit',
  'zombieAttack',
  'playerHurt',
  'playerDied',
  'playerRespawned',
  'points',
  'roundStarted',
  'roundEnded',
  'gameOver',
];

function toIndex<T>(list: readonly T[], value: T): number {
  const index = list.indexOf(value);
  if (index < 0) throw new ProtocolError(`Cannot encode ${String(value)}`);
  return index;
}

function fromIndex<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new ProtocolError(`Unknown enum index ${index}`);
  return value;
}

const writeWeapon = (w: Writer, id: WeaponId) => w.u8(toIndex(WEAPON_IDS, id));
const readWeapon = (r: Reader): WeaponId => fromIndex(WEAPON_IDS, r.u8());

/** Full float precision; used where client prediction needs exact values. */
const writeVec3f = (w: Writer, v: Vec3) => w.f32(v.x).f32(v.y).f32(v.z);
const readVec3f = (r: Reader): Vec3 => ({ x: r.f32(), y: r.f32(), z: r.f32() });

/** Centimetre precision; used for things that are only displayed. */
const writeVec3q = (w: Writer, v: Vec3) =>
  w.i16(posToWire(v.x)).i16(posToWire(v.y)).i16(posToWire(v.z));
const readVec3q = (r: Reader): Vec3 => ({
  x: posFromWire(r.i16()),
  y: posFromWire(r.i16()),
  z: posFromWire(r.i16()),
});

// ── Client messages ────────────────────────────────────────────────────────

function writeInput(w: Writer, raw: PlayerInput): void {
  const input = quantizeInput(raw);
  w.u32(input.seq)
    .i8(axisToWire(input.moveX))
    .i8(axisToWire(input.moveY))
    .f32(input.yaw)
    .f32(input.pitch)
    .u16(input.buttons)
    .u8(input.weaponSlot)
    .f64(input.viewTick);
}

function readInput(r: Reader): PlayerInput {
  return quantizeInput({
    seq: r.u32(),
    moveX: axisFromWire(r.i8()),
    moveY: axisFromWire(r.i8()),
    yaw: r.f32(),
    pitch: r.f32(),
    buttons: r.u16(),
    weaponSlot: r.u8(),
    viewTick: r.f64(),
  });
}

export function encodeClientMessage(msg: ClientMessage): Uint8Array<ArrayBuffer> {
  const w = new Writer();
  switch (msg.type) {
    case 'input': {
      const inputs = msg.inputs.slice(-MAX_INPUTS_PER_MESSAGE);
      w.u8(ClientType.Input).u8(inputs.length);
      for (const input of inputs) writeInput(w, input);
      break;
    }
    case 'ping':
      w.u8(ClientType.Ping).f64(msg.clientTime);
      break;
  }
  return w.finish();
}

export function decodeClientMessage(bytes: Uint8Array): ClientMessage {
  const r = new Reader(bytes);
  const type = r.u8();
  switch (type) {
    case ClientType.Input: {
      const count = r.u8();
      if (count > MAX_INPUTS_PER_MESSAGE) throw new ProtocolError('Too many inputs');
      const inputs: PlayerInput[] = [];
      for (let i = 0; i < count; i++) inputs.push(readInput(r));
      return { type: 'input', inputs };
    }
    case ClientType.Ping:
      return { type: 'ping', clientTime: r.f64() };
    default:
      throw new ProtocolError(`Unknown client message ${type}`);
  }
}

// ── Snapshot pieces ────────────────────────────────────────────────────────

function writePredicted(w: Writer, s: PredictedState): void {
  writeVec3f(w, s.pos);
  writeVec3f(w, s.vel);
  w.u8((s.grounded ? 1 : 0) | (s.sprinting ? 2 : 0))
    .u16(s.prevButtons)
    .u8(s.activeSlot)
    .u8(s.weapons.length);
  for (const weapon of s.weapons) {
    writeWeapon(w, weapon.id);
    w.u16(weapon.clip).u16(weapon.reserve);
  }
  w.f64(s.fireCooldown).f64(s.reloadTimer).f64(s.drawTimer).u32(s.shotCounter);
}

function readPredicted(r: Reader): PredictedState {
  const pos = readVec3f(r);
  const vel = readVec3f(r);
  const flags = r.u8();
  const prevButtons = r.u16();
  const activeSlot = r.u8();
  const weaponCount = r.u8();
  const weapons = [];
  for (let i = 0; i < weaponCount; i++) {
    weapons.push({ id: readWeapon(r), clip: r.u16(), reserve: r.u16() });
  }
  return {
    pos,
    vel,
    grounded: (flags & 1) !== 0,
    sprinting: (flags & 2) !== 0,
    prevButtons,
    activeSlot,
    weapons,
    fireCooldown: r.f64(),
    reloadTimer: r.f64(),
    drawTimer: r.f64(),
    shotCounter: r.u32(),
  };
}

function writePlayer(w: Writer, p: PlayerSnapshot): void {
  w.u8(p.id);
  writeVec3f(w, p.pos);
  w.u16(angleToWire(p.yaw))
    .u16(angleToWire(p.pitch))
    .u8(toIndex(LIFE_STATES, p.life))
    .u16(Math.round(p.health))
    .u16(Math.round(p.maxHealth))
    .i32(p.points)
    .u16(p.kills)
    .u16(p.headshots);
  writeWeapon(w, p.weaponId);
  w.u16(p.buttons).u8((p.grounded ? 1 : 0) | (p.sprinting ? 2 : 0) | (p.reloading ? 4 : 0));
}

function readPlayer(r: Reader): PlayerSnapshot {
  const id = r.u8();
  const pos = readVec3f(r);
  const yaw = angleFromWire(r.u16());
  const pitch = angleFromWire(r.u16());
  const life = fromIndex(LIFE_STATES, r.u8());
  const health = r.u16();
  const maxHealth = r.u16();
  const points = r.i32();
  const kills = r.u16();
  const headshots = r.u16();
  const weaponId = readWeapon(r);
  const buttons = r.u16();
  const flags = r.u8();
  return {
    id,
    pos,
    yaw,
    pitch,
    life,
    health,
    maxHealth,
    points,
    kills,
    headshots,
    weaponId,
    buttons,
    grounded: (flags & 1) !== 0,
    sprinting: (flags & 2) !== 0,
    reloading: (flags & 4) !== 0,
  };
}

const SPEED_SCALE = 20;

function writeZombie(w: Writer, z: ZombieSnapshot): void {
  w.u16(z.id);
  writeVec3q(w, z.pos);
  w.u16(angleToWire(z.yaw))
    .u8(toIndex(ZOMBIE_MODES, z.mode))
    .u8(Math.round(Math.max(0, Math.min(1, z.healthFraction)) * 255))
    .u8(Math.min(255, Math.round(z.speed * SPEED_SCALE)));
}

function readZombie(r: Reader): ZombieSnapshot {
  return {
    id: r.u16(),
    pos: readVec3q(r),
    yaw: angleFromWire(r.u16()),
    mode: fromIndex(ZOMBIE_MODES, r.u8()),
    healthFraction: r.u8() / 255,
    speed: r.u8() / SPEED_SCALE,
  };
}

function writeGame(w: Writer, g: GameSnapshot): void {
  w.u8(toIndex(PHASES, g.phase)).u16(g.round).f32(g.phaseTimer).u16(g.zombiesRemaining);
}

function readGame(r: Reader): GameSnapshot {
  return {
    phase: fromIndex(PHASES, r.u8()),
    round: r.u16(),
    phaseTimer: r.f32(),
    zombiesRemaining: r.u16(),
  };
}

function writeEvent(w: Writer, e: TickedEvent, snapshotTick: number): void {
  w.u8(toIndex(EVENT_TYPES, e.type)).u16(Math.max(0, Math.min(0xffff, snapshotTick - e.tick)));
  switch (e.type) {
    case 'shot':
      w.u8(e.playerId);
      writeWeapon(w, e.weaponId);
      writeVec3f(w, e.origin);
      w.u8(e.ends.length);
      for (const end of e.ends) writeVec3q(w, end);
      return;
    case 'zombieHit':
      w.u16(e.zombieId).u8(e.playerId);
      writeVec3q(w, e.point);
      w.u8((e.headshot ? 1 : 0) | (e.killed ? 2 : 0));
      return;
    case 'zombieAttack':
      w.u16(e.zombieId)
        .u8(e.targetId)
        .u8(e.hit ? 1 : 0);
      return;
    case 'playerHurt':
      w.u8(e.playerId).u16(Math.round(e.amount));
      writeVec3q(w, e.from);
      return;
    case 'playerDied':
    case 'playerRespawned':
      w.u8(e.playerId);
      return;
    case 'points':
      w.u8(e.playerId).i32(e.amount);
      return;
    case 'roundStarted':
    case 'roundEnded':
    case 'gameOver':
      w.u16(e.round);
      return;
  }
}

function readEvent(r: Reader, snapshotTick: number): TickedEvent {
  const type = fromIndex(EVENT_TYPES, r.u8());
  const tick = snapshotTick - r.u16();
  const event = ((): SimEvent => {
    switch (type) {
      case 'shot': {
        const playerId = r.u8();
        const weaponId = readWeapon(r);
        const origin = readVec3f(r);
        const count = r.u8();
        const ends: Vec3[] = [];
        for (let i = 0; i < count; i++) ends.push(readVec3q(r));
        return { type, playerId, weaponId, origin, ends };
      }
      case 'zombieHit': {
        const zombieId = r.u16();
        const playerId = r.u8();
        const point = readVec3q(r);
        const flags = r.u8();
        return {
          type,
          zombieId,
          playerId,
          point,
          headshot: (flags & 1) !== 0,
          killed: (flags & 2) !== 0,
        };
      }
      case 'zombieAttack':
        return { type, zombieId: r.u16(), targetId: r.u8(), hit: r.u8() !== 0 };
      case 'playerHurt':
        return { type, playerId: r.u8(), amount: r.u16(), from: readVec3q(r) };
      case 'playerDied':
      case 'playerRespawned':
        return { type, playerId: r.u8() };
      case 'points':
        return { type, playerId: r.u8(), amount: r.i32() };
      case 'roundStarted':
      case 'roundEnded':
      case 'gameOver':
        return { type, round: r.u16() };
    }
  })();
  return { ...event, tick };
}

function writeSnapshot(w: Writer, s: Snapshot): void {
  w.u32(s.tick)
    .u32(s.ackSeq)
    .u8(s.self ? 1 : 0);
  if (s.self) writePredicted(w, s.self);
  writeGame(w, s.game);
  w.u8(s.players.length);
  for (const p of s.players) writePlayer(w, p);
  w.u16(s.zombies.length);
  for (const z of s.zombies) writeZombie(w, z);
  w.u16(s.events.length);
  for (const e of s.events) writeEvent(w, e, s.tick);
}

function readSnapshot(r: Reader): Snapshot {
  const tick = r.u32();
  const ackSeq = r.u32();
  const self = r.u8() ? readPredicted(r) : null;
  const game = readGame(r);
  const players: PlayerSnapshot[] = [];
  for (let i = r.u8(); i > 0; i--) players.push(readPlayer(r));
  const zombies: ZombieSnapshot[] = [];
  for (let i = r.u16(); i > 0; i--) zombies.push(readZombie(r));
  const events: TickedEvent[] = [];
  for (let i = r.u16(); i > 0; i--) events.push(readEvent(r, tick));
  return { tick, ackSeq, self, game, players, zombies, events };
}

// ── Server messages ────────────────────────────────────────────────────────

export function encodeServerMessage(msg: ServerMessage): Uint8Array<ArrayBuffer> {
  const w = new Writer();
  switch (msg.type) {
    case 'welcome':
      w.u8(ServerType.Welcome)
        .u8(msg.playerId)
        .string(msg.roomCode)
        .string(msg.levelId)
        .u32(msg.tick);
      break;
    case 'roster':
      w.u8(ServerType.Roster).u8(msg.players.length);
      for (const p of msg.players) w.u8(p.id).string(p.name);
      break;
    case 'snapshot':
      w.u8(ServerType.Snapshot);
      writeSnapshot(w, msg.snapshot);
      break;
    case 'pong':
      w.u8(ServerType.Pong).f64(msg.clientTime).u32(msg.serverTick);
      break;
    case 'error':
      w.u8(ServerType.Error).string(msg.reason);
      break;
  }
  return w.finish();
}

export function decodeServerMessage(bytes: Uint8Array): ServerMessage {
  const r = new Reader(bytes);
  const type = r.u8();
  switch (type) {
    case ServerType.Welcome:
      return {
        type: 'welcome',
        playerId: r.u8(),
        roomCode: r.string(),
        levelId: r.string(),
        tick: r.u32(),
      };
    case ServerType.Roster: {
      const players = [];
      for (let i = r.u8(); i > 0; i--) players.push({ id: r.u8(), name: r.string() });
      return { type: 'roster', players };
    }
    case ServerType.Snapshot:
      return { type: 'snapshot', snapshot: readSnapshot(r) };
    case ServerType.Pong:
      return { type: 'pong', clientTime: r.f64(), serverTick: r.u32() };
    case ServerType.Error:
      return { type: 'error', reason: r.string() };
    default:
      throw new ProtocolError(`Unknown server message ${type}`);
  }
}
