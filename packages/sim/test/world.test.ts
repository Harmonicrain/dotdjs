import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { killZombie } from '../src/combat/damage';
import { PLAYER, POINTS, TICK_RATE, ZOMBIE } from '../src/config';
import type { SimEvent } from '../src/events';
import { DEFAULT_LEVEL_ID } from '../src/level';
import { distanceXZ } from '../src/math/vec3';
import type { Vec3 } from '../src/math/vec3';
import { Button } from '../src/player/input';
import { spawnZombie } from '../src/zombies/ai';
import { addPlayer } from '../src/world/players';
import type { World } from '../src/world/types';
import {
  applyPlayerInput,
  createWorld,
  disposeWorld,
  drainEvents,
  initSim,
  stepWorld,
} from '../src/world/world';
import { input } from './helpers';

let world: World;

beforeAll(initSim);
afterEach(() => disposeWorld(world));

function newWorld(): World {
  world = createWorld({ levelId: DEFAULT_LEVEL_ID, seed: 1234 });
  return world;
}

/** Steps the world, feeding every player an idle input each tick. Returns all events. */
function simulate(w: World, seconds: number, stopWhen?: (events: SimEvent[]) => boolean): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) {
    for (const id of w.players.keys()) applyPlayerInput(w, id, input({ viewTick: w.tick }));
    stepWorld(w);
    const events = drainEvents(w);
    all.push(...events);
    if (stopWhen?.(all)) break;
  }
  return all;
}

function aimAt(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

describe('world', () => {
  it('builds a navmesh and adds up to four players', () => {
    const w = newWorld();
    const ids = ['a', 'b', 'c', 'd'].map((n) => addPlayer(w, n)?.id);
    expect(ids).toEqual([1, 2, 3, 4]);
    expect(addPlayer(w, 'e')).toBeNull();
  });

  it('starts round 1 after the pregame countdown and spawns zombies', () => {
    const w = newWorld();
    addPlayer(w, 'solo');
    const events = simulate(w, 5);
    expect(events).toContainEqual({ type: 'roundStarted', round: 1 });
    expect(w.game.phase).toBe('active');
    expect(w.zombies.size).toBeGreaterThan(0);
  });

  it('zombies climb out, path to the player and attack', () => {
    const w = newWorld();
    const player = addPlayer(w, 'bait')!;
    const events = simulate(w, 40, (all) => all.some((e) => e.type === 'playerHurt'));
    const hurt = events.find((e) => e.type === 'playerHurt');
    expect(hurt).toBeDefined();
    expect(player.health).toBe(PLAYER.maxHealth - ZOMBIE.attackDamage);
  });

  it('ends the game when the only player dies', () => {
    const w = newWorld();
    const player = addPlayer(w, 'doomed')!;
    const events = simulate(w, 90, (all) => all.some((e) => e.type === 'gameOver'));
    expect(events.some((e) => e.type === 'playerDied')).toBe(true);
    expect(events.some((e) => e.type === 'gameOver')).toBe(true);
    expect(player.life).toBe('dead');
    expect(w.game.phase).toBe('over');
  });

  it('advances to round 2 once every zombie in round 1 is dead', () => {
    const w = newWorld();
    addPlayer(w, 'slayer');
    const events: SimEvent[] = [];
    for (let i = 0; i < 120 * TICK_RATE && w.game.round < 2; i++) {
      for (const z of w.zombies.values()) if (z.mode !== 'dead') killZombie(w, z);
      stepWorld(w);
      events.push(...drainEvents(w));
    }
    expect(events).toContainEqual({ type: 'roundEnded', round: 1 });
    expect(events).toContainEqual({ type: 'roundStarted', round: 2 });
  });

  it('shots damage zombies and award points; headshots kill faster', () => {
    const w = newWorld();
    const player = addPlayer(w, 'marksman')!;
    player.pos = { x: 0, y: 0.05, z: -12 };
    w.game.phase = 'over'; // freeze round flow so only our zombie exists
    w.game.round = 1;
    simulate(w, 0.2); // settle onto the ground

    const zombie = spawnZombie(w);
    zombie.mode = 'chasing'; // no crowd agent, so it stands still
    zombie.pos = { x: 0, y: 0, z: -20 };
    simulate(w, 0.1);

    const eye = { x: player.pos.x, y: player.pos.y + PLAYER.eyeHeight, z: player.pos.z };
    const aim = aimAt(eye, { x: 0, y: ZOMBIE.headHeight, z: -20 });
    const pointsBefore = player.points;
    const shoot = () => {
      applyPlayerInput(w, player.id, input({ ...aim, buttons: Button.Fire | Button.Aim, viewTick: w.tick }));
      stepWorld(w);
      const events = drainEvents(w);
      for (let i = 0; i < 20; i++) {
        applyPlayerInput(w, player.id, input({ ...aim, viewTick: w.tick }));
        stepWorld(w);
      }
      return events;
    };

    const first = shoot();
    expect(first.find((e) => e.type === 'zombieHit')).toMatchObject({ headshot: true, killed: false });
    expect(player.points).toBe(pointsBefore + POINTS.hit);

    const second = shoot();
    expect(second.find((e) => e.type === 'zombieHit')).toMatchObject({ headshot: true, killed: true });
    expect(player.points).toBe(pointsBefore + POINTS.hit + POINTS.kill + POINTS.headshotBonus);
    expect(player.kills).toBe(1);
  });

  it('bullets do not pass through walls', () => {
    const w = newWorld();
    const player = addPlayer(w, 'blocked')!;
    player.pos = { x: -3, y: 0.05, z: -2 }; // inside the bunker
    w.game.phase = 'over';
    w.game.round = 1;
    simulate(w, 0.2);
    const zombie = spawnZombie(w);
    zombie.mode = 'chasing';
    zombie.pos = { x: -3, y: 0, z: -12 }; // outside, behind the north wall
    simulate(w, 0.1);
    const eye = { x: player.pos.x, y: player.pos.y + PLAYER.eyeHeight, z: player.pos.z };
    applyPlayerInput(
      w,
      player.id,
      input({ ...aimAt(eye, { x: -3, y: 1.2, z: -12 }), buttons: Button.Fire | Button.Aim, viewTick: w.tick }),
    );
    const events = drainEvents(w);
    expect(events.some((e) => e.type === 'shot')).toBe(true);
    expect(events.some((e) => e.type === 'zombieHit')).toBe(false);
  });

  it('is deterministic for a given seed and inputs', () => {
    const run = () => {
      const w = createWorld({ levelId: DEFAULT_LEVEL_ID, seed: 99 });
      addPlayer(w, 'p');
      simulate(w, 12);
      const snapshot = [...w.zombies.values()].map((z) => [z.id, z.pos.x, z.pos.z, z.health]);
      disposeWorld(w);
      return snapshot;
    };
    world = createWorld({ levelId: DEFAULT_LEVEL_ID, seed: 1 }); // for afterEach
    expect(run()).toEqual(run());
  });

  it('keeps zombies on the ground and near the player over time', () => {
    const w = newWorld();
    const player = addPlayer(w, 'p')!;
    simulate(w, 20);
    const chasers = [...w.zombies.values()].filter((z) => z.mode === 'chasing' || z.mode === 'attacking');
    expect(chasers.length).toBeGreaterThan(0);
    for (const z of chasers) {
      expect(z.pos.y).toBeGreaterThan(-0.2);
      expect(z.pos.y).toBeLessThan(1.6);
      expect(distanceXZ(z.pos, player.pos)).toBeLessThan(30);
    }
  });
});
