import { afterEach, describe, expect, it } from 'vitest';
import {
  Button,
  copyPredicted,
  createCharacterCollider,
  createLevelPhysics,
  createPlayerState,
  disposeLevelPhysics,
  getLevel,
  MAX_PLAYERS,
  PLAYER,
  SNAPSHOT_INTERVAL_TICKS,
  stepPlayer,
  TICK_DT,
  TICK_RATE,
  ZOMBIE,
} from '@dotd/sim';
import type { PlayerInput, PredictedState } from '@dotd/sim';
import { encodeClientMessage, quantizeInput } from '@dotd/protocol';
import { generateRoomCode, normalizeRoomCode } from '../src/codes';
import { Room } from '../src/room';
import { TestClient } from './helpers';

let room: Room | undefined;
afterEach(() => {
  room?.dispose();
  room = undefined;
});

async function newRoom(seed = 7): Promise<Room> {
  room = await Room.create({ code: 'TEST', seed });
  return room;
}

const sendInputs = (r: Room, playerId: number, inputs: PlayerInput[]) =>
  r.receive(playerId, encodeClientMessage({ type: 'input', inputs }));

describe('Room membership', () => {
  it('welcomes players, shares the roster and turns away a fifth', async () => {
    const r = await newRoom();
    const clients = Array.from({ length: MAX_PLAYERS + 1 }, () => new TestClient());
    const ids = clients.map((c, i) => r.join(c, `P${i}`));
    expect(ids).toEqual([1, 2, 3, 4, null]);

    expect(clients[0]!.ofType('welcome')[0]).toMatchObject({ playerId: 1, roomCode: 'TEST' });
    expect(
      clients[0]!
        .ofType('roster')
        .at(-1)
        ?.players.map((p) => p.name),
    ).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(clients[4]!.ofType('error')[0]?.reason).toBe('Room is full');
    expect(clients[4]!.closed).toBe(true);

    r.leave(2);
    expect(
      clients[0]!
        .ofType('roster')
        .at(-1)
        ?.players.map((p) => p.id),
    ).toEqual([1, 3, 4]);
    expect(r.join(new TestClient(), 'late')).toBe(2);
  });

  it('kicks clients that send malformed data', async () => {
    const r = await newRoom();
    const client = new TestClient();
    const id = r.join(client, 'bad')!;
    r.receive(id, Uint8Array.of(250, 1, 2));
    expect(client.closed).toBe(true);
    expect(r.playerCount).toBe(0);
  });

  it('answers pings with the server tick', async () => {
    const r = await newRoom();
    const client = new TestClient();
    const id = r.join(client, 'p')!;
    r.step();
    r.receive(id, encodeClientMessage({ type: 'ping', clientTime: 5.5 }));
    expect(client.ofType('pong')[0]).toEqual({ type: 'pong', clientTime: 5.5, serverTick: 1 });
  });
});

describe('Room ticking', () => {
  it('runs 60 ticks and sends 20 snapshots per second of wall-clock time', async () => {
    const r = await newRoom();
    const client = new TestClient();
    r.join(client, 'p');
    r.update(0);
    for (let ms = 0; ms <= 1000; ms += 16) r.update(ms);
    r.update(1000);
    expect(r.world.tick).toBeGreaterThanOrEqual(TICK_RATE - 1);
    expect(r.world.tick).toBeLessThanOrEqual(TICK_RATE);
    expect(client.snapshots.length).toBe(Math.floor(r.world.tick / SNAPSHOT_INTERVAL_TICKS));
  });

  it('does not advance while paused', async () => {
    const r = await newRoom();
    r.update(0);
    r.paused = true;
    r.update(5000);
    r.paused = false;
    r.update(5000);
    expect(r.world.tick).toBe(0);
  });

  it('applies at most one input per tick beyond a small catch-up budget', async () => {
    const r = await newRoom();
    const id = r.join(new TestClient(), 'speedy')!;
    const burst = Array.from({ length: 30 }, (_, i) =>
      quantizeInput({
        seq: i + 1,
        moveX: 0,
        moveY: 1,
        yaw: 0,
        pitch: 0,
        buttons: 0,
        weaponSlot: 0,
        viewTick: 0,
      }),
    );
    sendInputs(r, id, burst);
    r.step();
    expect(r.world.players.get(id)!.lastInputSeq).toBeLessThanOrEqual(9);
  });
});

describe('client prediction', () => {
  it('a client replaying its own inputs matches every server snapshot exactly', async () => {
    const r = await newRoom();
    const client = new TestClient();
    const id = r.join(client, 'predictor')!;
    for (let i = 0; i < SNAPSHOT_INTERVAL_TICKS; i++) r.step();
    const first = client.latestSnapshot!.self!;

    const physics = createLevelPhysics(getLevel(r.world.level.id));
    const collider = createCharacterCollider(physics);
    const local = createPlayerState(id, 'predictor', first.pos);
    copyPredicted(first, local);
    const predictedAt = new Map<number, PredictedState>();

    let checked = 0;
    for (let seq = 1; seq <= 150; seq++) {
      const input = quantizeInput({
        seq,
        moveX: Math.sin(seq / 9),
        moveY: seq < 100 ? 1 : -0.5,
        yaw: 0.8 + seq * 0.01,
        pitch: 0.1,
        buttons: (seq % 45 === 0 ? Button.Jump : 0) | (seq % 20 < 2 ? Button.Fire : 0),
        weaponSlot: 0,
        viewTick: r.world.tick,
      });
      stepPlayer(local, input, TICK_DT, physics, collider);
      const snapshotOfLocal = {} as PredictedState;
      copyPredicted(local, snapshotOfLocal);
      predictedAt.set(seq, snapshotOfLocal);

      const before = client.snapshots.length;
      sendInputs(r, id, [input]);
      r.step();
      for (const snapshot of client.snapshots.slice(before)) {
        expect(snapshot.self).toEqual(predictedAt.get(snapshot.ackSeq));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
    disposeLevelPhysics(physics);
  });
});

describe('four bots over the protocol', () => {
  it('survive and clear round 1 by shooting what they see', async () => {
    const r = await newRoom(2024);
    const bots = Array.from({ length: 4 }, (_, i) => {
      const client = new TestClient();
      return { client, id: r.join(client, `Bot ${i + 1}`)!, seq: 0 };
    });

    for (let tick = 0; tick < 150 * TICK_RATE && r.world.game.round < 2; tick++) {
      for (const bot of bots) {
        const snapshot = bot.client.latestSnapshot;
        const self = snapshot?.self;
        if (!snapshot || !self) continue;
        const eye = { x: self.pos.x, y: self.pos.y + PLAYER.eyeHeight, z: self.pos.z };
        const target = snapshot.zombies
          .filter((z) => z.mode === 'chasing' || z.mode === 'attacking')
          .map((z) => ({ z, d: Math.hypot(z.pos.x - eye.x, z.pos.z - eye.z) }))
          .sort((a, b) => a.d - b.d)[0];

        let yaw = 0;
        let pitch = 0;
        let buttons = 0;
        if (target && target.d < 7) {
          const dx = target.z.pos.x - eye.x;
          const dy = target.z.pos.y + ZOMBIE.headHeight - eye.y;
          const dz = target.z.pos.z - eye.z;
          yaw = Math.atan2(-dx, -dz);
          pitch = Math.atan2(dy, Math.hypot(dx, dz));
          buttons = Button.Aim | (tick % 4 < 2 ? Button.Fire : 0);
        }
        bot.seq++;
        sendInputs(r, bot.id, [
          quantizeInput({
            seq: bot.seq,
            moveX: 0,
            moveY: 0,
            yaw,
            pitch,
            buttons,
            weaponSlot: 0,
            viewTick: snapshot.tick,
          }),
        ]);
      }
      r.step();
    }

    const events = bots[0]!.client.snapshots.flatMap((s) => s.events);
    expect(events.some((e) => e.type === 'roundEnded' && e.round === 1)).toBe(true);
    expect(r.world.game.round).toBe(2);
    const kills = [...r.world.players.values()].reduce((sum, p) => sum + p.kills, 0);
    expect(kills).toBeGreaterThanOrEqual(15);
  });
});

describe('room codes', () => {
  it('generates unambiguous four-letter codes and normalises user input', () => {
    let n = 0;
    const code = generateRoomCode(
      () => (n++ * 0.37) % 1,
      () => false,
    );
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(code).not.toMatch(/[ILO]/);
    expect(normalizeRoomCode(' kx-qt ')).toBe('KXQT');
    expect(normalizeRoomCode('KXQ')).toBeNull();
    expect(normalizeRoomCode('KXQI')).toBeNull();
  });
});
