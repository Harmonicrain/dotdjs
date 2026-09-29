import type { Vec3 } from './math/vec3';
import type { WeaponId } from './weapons/defs';

/**
 * One-off things that happened during a tick. The server forwards them to clients, which use
 * them for effects, sounds and HUD feedback. They never carry state the client must keep.
 */
export type SimEvent =
  | { type: 'shot'; playerId: number; weaponId: WeaponId; origin: Vec3; ends: Vec3[] }
  | {
      type: 'zombieHit';
      zombieId: number;
      playerId: number;
      point: Vec3;
      headshot: boolean;
      killed: boolean;
    }
  | { type: 'zombieAttack'; zombieId: number; targetId: number; hit: boolean }
  | { type: 'playerHurt'; playerId: number; amount: number; from: Vec3 }
  | { type: 'playerDied'; playerId: number }
  | { type: 'playerRespawned'; playerId: number }
  | { type: 'points'; playerId: number; amount: number }
  | { type: 'roundStarted'; round: number }
  | { type: 'roundEnded'; round: number }
  | { type: 'gameOver'; round: number };

export type SimEventType = SimEvent['type'];
