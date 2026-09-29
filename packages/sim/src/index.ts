// Tuning and timing
export * from './config';

// Maths
export * from './math/vec3';
export * from './math/quat';
export * from './math/rng';

// Levels
export { getLevel, levelTriangles, boxRotation, DEFAULT_LEVEL_ID } from './level';
export type * from './level/types';

// Physics (shared by the server and client-side prediction)
export {
  initPhysics,
  createLevelPhysics,
  disposeLevelPhysics,
  createCharacterCollider,
  removeCharacterCollider,
  raycastLevel,
} from './physics/physics';
export type { LevelPhysics, RayHit } from './physics/physics';

// Players
export * from './player/input';
export * from './player/state';
export { stepPlayer } from './player/step';
export { pelletDirections } from './player/weapon';
export type { Shot } from './player/weapon';

// Weapons
export * from './weapons/defs';

// Combat
export { rayHitsZombie } from './combat/hitscan';

// Zombies
export type { ZombieState, ZombieMode } from './zombies/state';
export { liveZombieCount } from './zombies/ai';

// World
export type { World, GameState, GamePhase } from './world/types';
export type { SimEvent, SimEventType } from './events';
export {
  initSim,
  createWorld,
  disposeWorld,
  applyPlayerInput,
  stepWorld,
  drainEvents,
} from './world/world';
export { addPlayer, removePlayer, sanitizeName } from './world/players';
