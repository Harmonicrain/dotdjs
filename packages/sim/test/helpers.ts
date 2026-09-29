import { EMPTY_INPUT } from '../src/player/input';
import type { PlayerInput } from '../src/player/input';

let seq = 0;

/** Builds an input with sensible defaults; `seq` auto-increments. */
export function input(overrides: Partial<PlayerInput> = {}): PlayerInput {
  seq += 1;
  return { ...EMPTY_INPUT, seq, ...overrides };
}
