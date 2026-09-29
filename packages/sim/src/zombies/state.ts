import type { Vec3 } from '../math/vec3';

export type ZombieMode = 'rising' | 'chasing' | 'attacking' | 'dead';

export interface ZombieState {
  id: number;
  /** Feet position. While rising the zombie starts below ground and climbs out. */
  pos: Vec3;
  yaw: number;
  health: number;
  maxHealth: number;
  /** Top movement speed in m/s. */
  speed: number;
  mode: ZombieMode;
  /** Seconds spent in the current mode. */
  modeTime: number;
  /** Player being chased, or 0 for none. */
  targetId: number;
  repathTimer: number;
  /** Whether the current swing has already resolved. */
  attackResolved: boolean;
  /** Where the zombie surfaced. */
  spawnPos: Vec3;
}
