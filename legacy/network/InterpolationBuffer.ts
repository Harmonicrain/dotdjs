
import { SYNC_CONFIG } from '../config';

export interface PoseSnapshot {
    /** Wall-clock ms timestamp when this pose was received. */
    timestamp: number;
    x: number;
    y: number;
    z: number;
    /** Y-axis rotation (yaw) in radians. */
    rotY: number;
    /** X-axis rotation (pitch) in radians. */
    pitch: number;
}

/**
 * Stores a rolling window of received remote-player poses and provides
 * interpolated values at (now − INTERPOLATION_BUFFER_MS), giving the renderer
 * two or more anchoring snapshots to blend between for smooth movement.
 *
 * Usage:
 *   // On every network receive:
 *   buffer.push({ timestamp: Date.now(), x, y, z, rotY, pitch });
 *
 *   // On every render frame:
 *   const pose = buffer.sample(Date.now());
 *   if (pose) remoteRoot.position.set(pose.x, pose.y - 1.65, pose.z);
 */
export class InterpolationBuffer {
    private readonly buf: PoseSnapshot[] = [];
    /** Keep at most ~6 seconds of history at 20 Hz (120 entries). */
    private readonly MAX = 120;

    /** Add a freshly-received pose snapshot. */
    public push(snap: PoseSnapshot): void {
        // Discard snapshots older than twice the interpolation window to prevent stale holding
        // if the peer resumes after a long pause.
        const maxAge = SYNC_CONFIG.INTERPOLATION_BUFFER_MS * 2;
        const now = Date.now();
        while (this.buf.length > 0 && now - this.buf[0].timestamp > maxAge) {
            this.buf.shift();
        }

        this.buf.push(snap);
        if (this.buf.length > this.MAX) this.buf.shift();
    }

    /**
     * Returns the interpolated pose for the render timestamp
     * `(now − INTERPOLATION_BUFFER_MS)`.
     *
     * Returns `null` if there is no data yet.
     * Returns the single stored pose if only one exists.
     * Clamps to the oldest snapshot if the target time is before all history.
     * Holds the newest snapshot if the target time is after all history
     * (this is expected when the buffer is draining after a pause / packet loss).
     */
    public sample(now: number): PoseSnapshot | null {
        if (this.buf.length === 0) return null;
        if (this.buf.length === 1) return this.buf[0];

        const target = now - SYNC_CONFIG.INTERPOLATION_BUFFER_MS;

        // Target is before our entire history – return oldest
        if (target <= this.buf[0].timestamp) return this.buf[0];

        // Target is after our entire history – hold the newest pose
        if (target >= this.buf[this.buf.length - 1].timestamp) {
            return this.buf[this.buf.length - 1];
        }

        // Binary-search for the pair that brackets `target`
        let lo = 0;
        let hi = this.buf.length - 1;
        while (lo + 1 < hi) {
            const mid = (lo + hi) >>> 1;
            if (this.buf[mid].timestamp <= target) lo = mid;
            else hi = mid;
        }

        const before = this.buf[lo];
        const after  = this.buf[hi];
        const span   = after.timestamp - before.timestamp;
        const t      = span === 0 ? 0 : (target - before.timestamp) / span;

        return {
            timestamp: target,
            x:     lerp(before.x,     after.x,     t),
            y:     lerp(before.y,     after.y,     t),
            z:     lerp(before.z,     after.z,     t),
            rotY:  lerpAngle(before.rotY,  after.rotY,  t),
            pitch: lerp(before.pitch, after.pitch, t),
        };
    }

    /** Discard all buffered poses (call on game start / session reset). */
    public clear(): void {
        this.buf.length = 0;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Lerp angles in radians, handling the wrap-around discontinuity at ±π
 * so a rotation from 3.1 to −3.1 goes the short way (≈ 0.08 rad) instead
 * of the long way (≈ 6.2 rad).
 */
function lerpAngle(a: number, b: number, t: number): number {
    let delta = b - a;
    while (delta >  Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return a + delta * t;
}
