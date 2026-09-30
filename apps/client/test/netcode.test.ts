import { beforeAll, describe, expect, it } from 'vitest';
import {
  copyPredicted,
  createCharacterCollider,
  createLevelPhysics,
  createPlayerState,
  DEFAULT_LEVEL_ID,
  getLevel,
  initPhysics,
  TICK_RATE,
} from '@dotd/sim';
import type { CharacterCollider, LevelPhysics, PredictedState } from '@dotd/sim';
import { quantizeInput } from '@dotd/protocol';
import type { Snapshot, ZombieSnapshot } from '@dotd/protocol';
import { RenderClock } from '../src/game/net/clock';
import { Predictor } from '../src/game/net/predictor';
import { SnapshotBuffer } from '../src/game/net/snapshots';

function snapshot(tick: number, zombies: ZombieSnapshot[] = []): Snapshot {
  return {
    tick,
    ackSeq: 0,
    self: null,
    game: { phase: 'active', round: 1, phaseTimer: 0, zombiesRemaining: zombies.length },
    players: [],
    zombies,
    events: [],
  };
}

const zombie = (id: number, x: number, yaw = 0): ZombieSnapshot => ({
  id,
  pos: { x, y: 0, z: 0 },
  yaw,
  mode: 'chasing',
  healthFraction: 1,
  speed: 2,
});

describe('SnapshotBuffer', () => {
  it('interpolates zombies between the snapshots around a tick', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshot(30, [zombie(1, 0, 3)]));
    buffer.push(snapshot(33, [zombie(1, 3, -3)]));
    const [z] = buffer.zombiesAt(32);
    expect(z!.pos.x).toBeCloseTo(2);
    // Yaw takes the short way round through ±π.
    expect(Math.abs(z!.yaw)).toBeGreaterThan(3);
  });

  it('keeps zombies that vanish until the next snapshot and ignores stale snapshots', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshot(30, [zombie(1, 0), zombie(2, 5)]));
    buffer.push(snapshot(33, [zombie(1, 1)]));
    buffer.push(snapshot(31, [])); // out of order: ignored
    expect(buffer.zombiesAt(31).map((z) => z.id)).toEqual([1, 2]);
    expect(buffer.zombiesAt(33).map((z) => z.id)).toEqual([1]);
    expect(buffer.latest?.tick).toBe(33);
  });

  it('clamps to the oldest and newest snapshots', () => {
    const buffer = new SnapshotBuffer();
    buffer.push(snapshot(30, [zombie(1, 0)]));
    buffer.push(snapshot(33, [zombie(1, 3)]));
    expect(buffer.zombiesAt(10)[0]!.pos.x).toBe(0);
    expect(buffer.zombiesAt(99)[0]!.pos.x).toBe(3);
  });
});

describe('RenderClock', () => {
  it('settles at the configured delay behind the newest snapshot', () => {
    const clock = new RenderClock(6);
    let latest = 100;
    clock.update(0, latest);
    expect(clock.renderTick).toBe(94);
    // Snapshots arrive every 3 ticks while frames run at ~144 Hz.
    for (let frame = 0; frame < 2000; frame++) {
      if (frame % 7 === 0) latest += 3;
      clock.update(1 / 144, latest);
    }
    expect(latest - clock.renderTick).toBeGreaterThan(3);
    expect(latest - clock.renderTick).toBeLessThan(10);
  });

  it('jumps rather than crawling after a long stall', () => {
    const clock = new RenderClock(6);
    clock.update(0, 100);
    clock.update(1 / 60, 500);
    expect(clock.renderTick).toBe(494);
  });
});

describe('Predictor', () => {
  let physics: LevelPhysics;
  let collider: CharacterCollider;

  beforeAll(async () => {
    await initPhysics();
    physics = createLevelPhysics(getLevel(DEFAULT_LEVEL_ID));
    collider = createCharacterCollider(physics);
  });

  const start = (): PredictedState => {
    const state = {} as PredictedState;
    copyPredicted(createPlayerState(1, 'p', { x: 0, y: 0.02, z: -12 }), state);
    state.grounded = true;
    return state;
  };

  const walk = (seq: number) =>
    quantizeInput({
      seq,
      moveX: 0,
      moveY: 1,
      yaw: 0,
      pitch: 0,
      buttons: 0,
      weaponSlot: 0,
      viewTick: 0,
    });

  it('moves instantly and replays unacknowledged inputs on reconcile', () => {
    const predictor = new Predictor(physics, collider, 1, start());
    for (let seq = 1; seq <= 30; seq++) predictor.predict(walk(seq));
    const predictedZ = predictor.player.pos.z;
    expect(predictedZ).toBeLessThan(-13);

    // Server acknowledges up to 10 with exactly the state we predicted at 10.
    const replay = new Predictor(physics, collider, 1, start());
    for (let seq = 1; seq <= 10; seq++) replay.predict(walk(seq));
    const at10 = {} as PredictedState;
    copyPredicted(replay.player, at10);

    predictor.reconcile(10, at10, undefined);
    expect(predictor.pendingCount).toBe(20);
    expect(predictor.player.pos.z).toBe(predictedZ);
    expect(predictor.renderPosition(1, 0).z).toBe(predictedZ);
  });

  it('smooths small corrections and snaps on teleports', () => {
    const predictor = new Predictor(physics, collider, 1, start());
    for (let seq = 1; seq <= 5; seq++) predictor.predict(walk(seq));
    const truth = {} as PredictedState;
    copyPredicted(predictor.player, truth);
    truth.pos = { ...truth.pos, x: truth.pos.x + 0.3 }; // server disagrees slightly

    predictor.reconcile(5, truth, undefined);
    const drawn = predictor.renderPosition(1, 0);
    expect(drawn.x).toBeCloseTo(truth.pos.x - 0.3, 5); // still drawn where it was
    for (let i = 0; i < TICK_RATE; i++) predictor.renderPosition(1, 1 / TICK_RATE);
    expect(predictor.renderPosition(1, 0).x).toBeCloseTo(truth.pos.x, 3); // eased onto the truth

    const teleport = { ...truth, pos: { x: 0, y: 0.02, z: -1 } };
    predictor.reconcile(5, teleport, undefined);
    expect(predictor.renderPosition(1, 0)).toEqual(teleport.pos);
  });
});
