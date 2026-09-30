import { describe, expect, it } from 'vitest';
import { Button, copyPredicted, createPlayerState } from '@dotd/sim';
import type { PlayerInput, PredictedState } from '@dotd/sim';
import { decodeUtf8, encodeUtf8, ProtocolError } from '../src/bytes';
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
} from '../src/codec';
import type { ServerMessage, Snapshot } from '../src/messages';
import { quantizeInput } from '../src/quantize';

const input = (overrides: Partial<PlayerInput> = {}): PlayerInput =>
  quantizeInput({
    seq: 42,
    moveX: 0.5,
    moveY: -1,
    yaw: 1.2345,
    pitch: -0.3,
    buttons: Button.Fire | Button.Aim,
    weaponSlot: 1,
    viewTick: 1234.625,
    ...overrides,
  });

function sampleSnapshot(): Snapshot {
  const player = createPlayerState(2, 'Me', { x: 1.5, y: 0.25, z: -3 });
  player.fireCooldown = 0.15;
  const self = {} as PredictedState;
  copyPredicted(player, self);
  return {
    tick: 5000,
    ackSeq: 812,
    self,
    game: { phase: 'active', round: 7, phaseTimer: 0, zombiesRemaining: 19 },
    players: [
      {
        id: 2,
        pos: { x: Math.fround(1.5), y: Math.fround(0.25), z: Math.fround(-3.1) },
        yaw: 1.25,
        pitch: -0.5,
        life: 'alive',
        health: 60,
        maxHealth: 100,
        points: 12345,
        kills: 31,
        headshots: 9,
        weaponId: 'stg44',
        buttons: Button.Aim,
        grounded: true,
        sprinting: false,
        reloading: true,
      },
    ],
    zombies: [
      {
        id: 900,
        pos: { x: 10.25, y: 0, z: -20.5 },
        yaw: -2,
        mode: 'attacking',
        healthFraction: 1,
        speed: 3.45,
      },
    ],
    events: [
      {
        type: 'shot',
        tick: 4999,
        playerId: 2,
        weaponId: 'olympia',
        origin: { x: Math.fround(1.5), y: Math.fround(1.87), z: -3 },
        ends: [
          { x: 5, y: 1, z: -9.5 },
          { x: 5.01, y: 1.2, z: -9.4 },
        ],
      },
      {
        type: 'zombieHit',
        tick: 4999,
        zombieId: 900,
        playerId: 2,
        point: { x: 5, y: 1, z: -9.5 },
        headshot: true,
        killed: false,
      },
      { type: 'points', tick: 4999, playerId: 2, amount: 10 },
      { type: 'roundStarted', tick: 4998, round: 7 },
      { type: 'playerHurt', tick: 5000, playerId: 2, amount: 40, from: { x: 1, y: 0, z: 2 } },
    ],
  };
}

describe('client messages', () => {
  it('round-trips inputs exactly after quantization', () => {
    const inputs = [input(), input({ seq: 43, moveX: -0.2, buttons: 0 })];
    const decoded = decodeClientMessage(encodeClientMessage({ type: 'input', inputs }));
    expect(decoded).toEqual({ type: 'input', inputs });
  });

  it('quantization is idempotent', () => {
    const q = input();
    expect(quantizeInput(q)).toEqual(q);
  });

  it('sanitises non-finite values from untrusted clients', () => {
    const decoded = decodeClientMessage(
      encodeClientMessage({
        type: 'input',
        inputs: [input({ yaw: NaN, pitch: Infinity, viewTick: NaN })],
      }),
    );
    if (decoded.type !== 'input') throw new Error('wrong type');
    const [first] = decoded.inputs;
    expect(first?.yaw).toBe(0);
    expect(first?.pitch).toBe(0);
    expect(first?.viewTick).toBe(0);
  });

  it('rejects truncated and unknown messages', () => {
    const bytes = encodeClientMessage({ type: 'input', inputs: [input()] });
    expect(() => decodeClientMessage(bytes.subarray(0, bytes.length - 3))).toThrow(ProtocolError);
    expect(() => decodeClientMessage(Uint8Array.of(99))).toThrow(ProtocolError);
    expect(() => decodeClientMessage(new Uint8Array())).toThrow(ProtocolError);
  });

  it('round-trips pings', () => {
    expect(decodeClientMessage(encodeClientMessage({ type: 'ping', clientTime: 123.456 }))).toEqual(
      {
        type: 'ping',
        clientTime: 123.456,
      },
    );
  });
});

describe('server messages', () => {
  it('round-trips simple messages', () => {
    const messages: ServerMessage[] = [
      { type: 'welcome', playerId: 3, roomCode: 'KXQT', levelId: 'proving-grounds', tick: 77 },
      {
        type: 'roster',
        players: [
          { id: 1, name: 'Dempsey' },
          { id: 2, name: 'Takeo 🧟' },
        ],
      },
      { type: 'pong', clientTime: 99.5, serverTick: 1000 },
      { type: 'error', reason: 'Room is full' },
    ];
    for (const msg of messages) expect(decodeServerMessage(encodeServerMessage(msg))).toEqual(msg);
  });

  it('round-trips snapshots, quantizing only display data', () => {
    const snapshot = sampleSnapshot();
    const decoded = decodeServerMessage(encodeServerMessage({ type: 'snapshot', snapshot }));
    if (decoded.type !== 'snapshot') throw new Error('wrong type');
    const out = decoded.snapshot;

    // Prediction-critical state is exact.
    expect(out.self).toEqual(snapshot.self);
    expect(out.tick).toBe(snapshot.tick);
    expect(out.ackSeq).toBe(snapshot.ackSeq);
    expect(out.game).toEqual(snapshot.game);
    expect(out.events).toEqual(snapshot.events);

    const player = out.players[0]!;
    expect(player.pos).toEqual(snapshot.players[0]!.pos);
    expect(player.yaw).toBeCloseTo(1.25, 3);
    expect(player.pitch).toBeCloseTo(-0.5, 3);
    expect(player).toMatchObject({
      weaponId: 'stg44',
      reloading: true,
      grounded: true,
      points: 12345,
    });

    const zombie = out.zombies[0]!;
    expect(zombie.pos).toEqual({ x: 10.25, y: 0, z: -20.5 });
    expect(zombie.yaw).toBeCloseTo(-2, 3);
    expect(zombie.mode).toBe('attacking');
    expect(zombie.speed).toBeCloseTo(3.45, 1);
  });

  it('keeps a busy four-player snapshot small', () => {
    const base = sampleSnapshot();
    const snapshot: Snapshot = {
      ...base,
      players: [1, 2, 3, 4].map((id) => ({ ...base.players[0]!, id })),
      zombies: Array.from({ length: 24 }, (_, i) => ({ ...base.zombies[0]!, id: i + 1 })),
      events: [],
    };
    const bytes = encodeServerMessage({ type: 'snapshot', snapshot });
    expect(bytes.length).toBeLessThan(700);
  });
});

describe('utf8', () => {
  it('round-trips multi-byte text', () => {
    for (const s of ['plain', 'Richtofen ß', '日本語', '🧟‍♂️ brains']) {
      expect(decodeUtf8(encodeUtf8(s))).toBe(s);
    }
  });
});
