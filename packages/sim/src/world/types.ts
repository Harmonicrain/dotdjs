import type { Collider } from '@dimforge/rapier3d-compat';
import type { CrowdAgent } from 'recast-navigation';
import type { PositionHistory } from '../combat/history';
import type { SimEvent } from '../events';
import type { LevelDef } from '../level';
import type { Rng } from '../math/rng';
import type { LevelPhysics } from '../physics/physics';
import type { PlayerState } from '../player/state';
import type { Navigation } from '../zombies/navigation';
import type { ZombieState } from '../zombies/state';

export type GamePhase = 'waiting' | 'pregame' | 'active' | 'intermission' | 'over';

export interface GameState {
  phase: GamePhase;
  round: number;
  /** Countdown for pregame / intermission, in seconds. */
  phaseTimer: number;
  zombiesToSpawn: number;
  spawnTimer: number;
}

/** Engine handles that belong to the world but are not part of its replicated state. */
export interface WorldInternals {
  readonly colliders: Map<number, Collider>;
  readonly agents: Map<number, CrowdAgent>;
  readonly history: Map<number, PositionHistory>;
  nextZombieId: number;
}

/** The whole authoritative game: everything the server simulates and clients render. */
export interface World {
  /** Number of completed simulation steps. */
  tick: number;
  readonly level: LevelDef;
  readonly physics: LevelPhysics;
  readonly nav: Navigation;
  readonly rng: Rng;
  readonly players: Map<number, PlayerState>;
  readonly zombies: Map<number, ZombieState>;
  readonly game: GameState;
  /** Events raised since the last `drainEvents` call. */
  events: SimEvent[];
  readonly internals: WorldInternals;
}
