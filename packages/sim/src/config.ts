/**
 * Gameplay tuning. Values marked "legacy" are carried over from the original prototype's
 * config/gameplay.ts; speeds there were per-frame at 60 fps and are converted to per-second here.
 */

/** Simulation ticks per second. Every timer in the sim counts down in seconds of sim time. */
export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;

/** The server sends a snapshot every N ticks (60 / 3 = 20 Hz). */
export const SNAPSHOT_INTERVAL_TICKS = 3;

export const MAX_PLAYERS = 4;

export const PLAYER = {
  radius: 0.35,
  height: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 4.5,
  sprintSpeed: 6.8,
  aimSpeedMultiplier: 0.55,
  backpedalMultiplier: 0.85,
  groundAcceleration: 55,
  airAcceleration: 10,
  gravity: 22,
  /** Gives a jump apex of roughly 1 m. */
  jumpVelocity: 6.6,
  terminalVelocity: 50,
  stepHeight: 0.4,
  maxSlopeDegrees: 50,
  snapToGroundDistance: 0.3,
  maxPitch: Math.PI / 2 - 0.01,
  maxHealth: 100, // legacy PLAYER_BASE_HEALTH
  regenDelay: 3.0,
  regenPerSecond: 60,
  /** Brief invulnerability after taking a hit (legacy DAMAGE_IMMUNITY_MS). */
  damageImmunity: 0.5,
  startingPoints: 500, // legacy STARTING_POINTS
} as const;

export const ZOMBIE = {
  radius: 0.35,
  height: 1.8,
  baseHealth: 100, // legacy ZOMBIE_HEALTH_BASE
  healthPerRound: 50, // legacy ZOMBIE_HEALTH_INC
  /** legacy WALKER 0.035 m/frame and ZOMBIE_SPEED_INC 0.005 m/frame, at 60 fps. */
  baseSpeed: 2.1,
  speedPerRound: 0.3,
  maxSpeed: 7.5, // legacy SUPER_SPRINTER
  speedVariation: [0.9, 1.1] as const, // legacy SPEED_VARIATION_MIN / RANGE
  riseDuration: 1.4,
  attackRange: 1.3,
  /** A swing that started in range still lands if the player is within this reach. */
  attackReach: 1.9,
  attackWindup: 0.45,
  attackDuration: 1.1,
  attackDamage: 40,
  repathInterval: 0.25,
  corpseDuration: 1.6,
  /** Hitbox relative to the zombie's feet. */
  bodyRadius: 0.32,
  bodyBottom: 0.35,
  bodyTop: 1.38,
  headRadius: 0.17,
  headHeight: 1.62,
} as const;

export const ROUNDS = {
  pregameDuration: 3,
  intermissionDuration: 10, // legacy INTERMISSION_MS
  countsByRound: [6, 8, 12, 16, 22] as const, // legacy ZOMBIE_COUNTS_BY_ROUND
  countIncreasePerRound: 3, // legacy ZOMBIE_SCALING_PER_ROUND
  /** Each extra player adds this fraction of the solo count (legacy used 1.5x for 2 players). */
  extraPlayerCountFactor: 0.5,
  maxConcurrentZombies: 24,
  baseSpawnDelay: 3.8, // legacy BASE_SPAWN_DELAY_MS
  minSpawnDelay: 0.8,
  spawnDelayReductionPerRound: 0.15,
  minSpawnDistance: 6,
} as const;

export const POINTS = {
  hit: 10, // legacy POINTS_HIT
  kill: 80, // legacy POINTS_KILL
  headshotBonus: 20, // legacy POINTS_HEADSHOT
} as const;

export const LAG_COMPENSATION = {
  /** How far back (in ticks) the server will rewind zombies to check a player's shot. */
  maxRewindTicks: 18,
} as const;

export function zombiesForRound(round: number, playerCount: number): number {
  const counts = ROUNDS.countsByRound;
  const solo =
    round <= counts.length
      ? counts[round - 1]!
      : counts[counts.length - 1]! + (round - counts.length) * ROUNDS.countIncreasePerRound;
  const multiplier = 1 + ROUNDS.extraPlayerCountFactor * Math.max(0, playerCount - 1);
  return Math.round(solo * multiplier);
}

export const zombieHealthForRound = (round: number): number =>
  ZOMBIE.baseHealth + ZOMBIE.healthPerRound * (round - 1);

export const zombieBaseSpeedForRound = (round: number): number =>
  Math.min(ZOMBIE.maxSpeed, ZOMBIE.baseSpeed + ZOMBIE.speedPerRound * (round - 1));

export const spawnDelayForRound = (round: number): number =>
  Math.max(
    ROUNDS.minSpawnDelay,
    ROUNDS.baseSpawnDelay - ROUNDS.spawnDelayReductionPerRound * (round - 1),
  );

/** Legacy: min(24, 3 + round * 2). */
export const maxConcurrentZombies = (round: number): number =>
  Math.min(ROUNDS.maxConcurrentZombies, 3 + round * 2);
