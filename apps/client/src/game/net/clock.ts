import { TICK_RATE } from '@dotd/sim';

/** Beyond this many ticks of error the clock jumps instead of easing. */
const SNAP_THRESHOLD_TICKS = 30;
/** Maximum playback speed change used to drift back on target. */
const MAX_TIME_WARP = 0.1;
const WARP_PER_TICK_OF_ERROR = 0.02;

/**
 * Tracks which (fractional) server tick to render remote entities at: a fixed delay behind the
 * newest snapshot, so there is always a later snapshot to interpolate towards. Rather than
 * jumping when snapshots arrive early or late, it speeds up or slows down slightly.
 */
export class RenderClock {
  private tick = -1;

  constructor(private readonly delayTicks: number) {}

  get renderTick(): number {
    return Math.max(0, this.tick);
  }

  get started(): boolean {
    return this.tick >= 0;
  }

  update(dtSeconds: number, latestSnapshotTick: number): void {
    const target = latestSnapshotTick - this.delayTicks;
    if (this.tick < 0) {
      this.tick = target;
      return;
    }
    const error = target - this.tick;
    if (Math.abs(error) > SNAP_THRESHOLD_TICKS) {
      this.tick = target;
      return;
    }
    const warp = Math.max(-MAX_TIME_WARP, Math.min(MAX_TIME_WARP, error * WARP_PER_TICK_OF_ERROR));
    this.tick += dtSeconds * TICK_RATE * (1 + warp);
  }
}
