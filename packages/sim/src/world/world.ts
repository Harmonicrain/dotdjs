import { TICK_DT } from '../config';
import { resolveShot } from '../combat/shots';
import type { SimEvent } from '../events';
import { stepRounds } from '../game/rounds';
import { getLevel } from '../level';
import { createRng } from '../math/rng';
import {
  createLevelPhysics,
  disposeLevelPhysics,
  initPhysics,
} from '../physics/physics';
import type { PlayerInput } from '../player/input';
import { stepPlayer } from '../player/step';
import { stepZombies } from '../zombies/ai';
import { createNavigation, disposeNavigation, initNavigation } from '../zombies/navigation';
import { stepPlayerVitals } from './players';
import type { World } from './types';

/** Loads the physics and navigation WASM modules. Must resolve before `createWorld`. */
export async function initSim(): Promise<void> {
  await Promise.all([initPhysics(), initNavigation()]);
}

export function createWorld(options: { levelId: string; seed: number }): World {
  const level = getLevel(options.levelId);
  return {
    tick: 0,
    level,
    physics: createLevelPhysics(level),
    nav: createNavigation(level),
    rng: createRng(options.seed),
    players: new Map(),
    zombies: new Map(),
    game: { phase: 'waiting', round: 0, phaseTimer: 0, zombiesToSpawn: 0, spawnTimer: 0 },
    events: [],
    internals: {
      colliders: new Map(),
      agents: new Map(),
      history: new Map(),
      nextZombieId: 0,
    },
  };
}

export function disposeWorld(world: World): void {
  disposeNavigation(world.nav);
  disposeLevelPhysics(world.physics);
}

/**
 * Applies one of a player's inputs: movement, weapon handling, and (server side) hit resolution.
 * The room calls this for each queued input before stepping the world.
 */
export function applyPlayerInput(world: World, playerId: number, input: PlayerInput): void {
  const player = world.players.get(playerId);
  const collider = world.internals.colliders.get(playerId);
  if (!player || !collider) return;

  player.lastInputSeq = input.seq;
  const shot = stepPlayer(player, input, TICK_DT, world.physics, collider);
  if (shot) resolveShot(world, player, shot, input.viewTick);
}

/** Advances everything that is not driven directly by player input by one tick. */
export function stepWorld(world: World): void {
  stepPlayerVitals(world, TICK_DT);
  stepZombies(world, TICK_DT);
  stepRounds(world, TICK_DT);
  world.tick += 1;
  for (const [id, history] of world.internals.history) {
    const zombie = world.zombies.get(id);
    if (zombie) history.record(world.tick, zombie.pos);
  }
}

export function drainEvents(world: World): SimEvent[] {
  const events = world.events;
  world.events = [];
  return events;
}
