import { LAG_COMPENSATION } from '../config';
import type { Vec3 } from '../math/vec3';

const CAPACITY = LAG_COMPENSATION.maxRewindTicks + 2;

/**
 * Ring buffer of an entity's recent positions, one per tick. Lets the server check a shot against
 * where a target was on the shooter's screen rather than where it is now.
 */
export class PositionHistory {
  private readonly ticks = new Int32Array(CAPACITY).fill(-1);
  private readonly xyz = new Float64Array(CAPACITY * 3);

  record(tick: number, pos: Vec3): void {
    const i = tick % CAPACITY;
    this.ticks[i] = tick;
    this.xyz[i * 3] = pos.x;
    this.xyz[i * 3 + 1] = pos.y;
    this.xyz[i * 3 + 2] = pos.z;
  }

  /** Position at a fractional tick, interpolated between recorded ticks. Null if not recorded. */
  sample(tick: number): Vec3 | null {
    const t0 = Math.floor(tick);
    const a = this.at(t0);
    const b = this.at(t0 + 1);
    if (a && b) {
      const f = tick - t0;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
    }
    return a ?? b;
  }

  private at(tick: number): Vec3 | null {
    if (tick < 0) return null;
    const i = tick % CAPACITY;
    if (this.ticks[i] !== tick) return null;
    return { x: this.xyz[i * 3]!, y: this.xyz[i * 3 + 1]!, z: this.xyz[i * 3 + 2]! };
  }
}
