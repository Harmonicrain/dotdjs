/**
 * Seeded pseudo-random numbers. The simulation never uses Math.random so that a world
 * created with the same seed and fed the same inputs always plays out the same way.
 */
export interface Rng {
  /** Current internal state; persist this to resume the sequence. */
  state: number;
}

export const createRng = (seed: number): Rng => ({ state: seed >>> 0 });

/** mulberry32: returns a float in [0, 1). */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const nextRange = (rng: Rng, min: number, max: number): number =>
  min + (max - min) * nextFloat(rng);

export const nextInt = (rng: Rng, maxExclusive: number): number =>
  Math.floor(nextFloat(rng) * maxExclusive);

/**
 * Stateless hash of a few integers to a float in [0, 1).
 * Used where the client and server must derive the same "random" value independently,
 * e.g. bullet spread for a given player and shot number.
 */
export function hashFloat(a: number, b: number, c: number, d = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (b + 0x632be5ab), 0xc2b2ae35);
  h = Math.imul(h ^ (c + 0x27d4eb2f), 0x165667b1);
  h = Math.imul(h ^ (d + 0x61c88647), 0x85ebca6b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
