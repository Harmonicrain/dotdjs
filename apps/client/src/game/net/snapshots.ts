import { lerp } from '@dotd/sim';
import type { PlayerSnapshot, Snapshot, ZombieSnapshot } from '@dotd/protocol';

/** How many ticks of history to keep (~1 s). */
const HISTORY_TICKS = 60;

function lerpAngle(a: number, b: number, t: number): number {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * t;
}

export interface Bracket {
  from: Snapshot;
  to: Snapshot;
  /** 0..1 between `from` and `to`. */
  alpha: number;
}

/**
 * Recent snapshots, used to draw other players and zombies smoothly a little in the past,
 * between two known server states.
 */
export class SnapshotBuffer {
  private readonly snapshots: Snapshot[] = [];

  push(snapshot: Snapshot): void {
    const latest = this.latest;
    if (latest && snapshot.tick <= latest.tick) return; // stale or duplicate
    this.snapshots.push(snapshot);
    while (this.snapshots.length > 2 && this.snapshots[0]!.tick < snapshot.tick - HISTORY_TICKS) {
      this.snapshots.shift();
    }
  }

  get latest(): Snapshot | undefined {
    return this.snapshots.at(-1);
  }

  clear(): void {
    this.snapshots.length = 0;
  }

  /** The two snapshots around `tick` (clamped to the oldest/newest available). */
  bracket(tick: number): Bracket | null {
    const list = this.snapshots;
    const first = list[0];
    const last = list.at(-1);
    if (!first || !last) return null;
    if (tick >= last.tick) return { from: last, to: last, alpha: 0 };
    if (tick <= first.tick) return { from: first, to: first, alpha: 0 };
    for (let i = list.length - 1; i > 0; i--) {
      const from = list[i - 1]!;
      const to = list[i]!;
      if (tick >= from.tick) return { from, to, alpha: (tick - from.tick) / (to.tick - from.tick) };
    }
    return { from: first, to: first, alpha: 0 };
  }

  zombiesAt(tick: number): ZombieSnapshot[] {
    const b = this.bracket(tick);
    if (!b) return [];
    const next = new Map(b.to.zombies.map((z) => [z.id, z]));
    return b.from.zombies.map((z) => {
      const n = next.get(z.id);
      if (!n) return z;
      return {
        ...n,
        pos: lerp(z.pos, n.pos, b.alpha),
        yaw: lerpAngle(z.yaw, n.yaw, b.alpha),
        mode: b.alpha < 0.5 ? z.mode : n.mode,
      };
    });
  }

  playersAt(tick: number): PlayerSnapshot[] {
    const b = this.bracket(tick);
    if (!b) return [];
    const next = new Map(b.to.players.map((p) => [p.id, p]));
    return b.from.players.map((p) => {
      const n = next.get(p.id);
      if (!n) return p;
      return {
        ...(b.alpha < 0.5 ? p : n),
        pos: lerp(p.pos, n.pos, b.alpha),
        yaw: lerpAngle(p.yaw, n.yaw, b.alpha),
        pitch: p.pitch + (n.pitch - p.pitch) * b.alpha,
      };
    });
  }
}
