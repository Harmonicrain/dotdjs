import {
  clone,
  copyPredicted,
  createPlayerState,
  length,
  lerp,
  stepPlayer,
  sub,
  TICK_DT,
  vec3,
} from '@dotd/sim';
import type {
  CharacterCollider,
  LevelPhysics,
  PlayerInput,
  PlayerState,
  PredictedState,
  Shot,
  Vec3,
} from '@dotd/sim';
import type { PlayerSnapshot } from '@dotd/protocol';

/** Corrections larger than this are teleports (respawns), not errors to smooth over. */
const SNAP_DISTANCE = 1.5;
/** How quickly visual correction offsets fade, per second. */
const CORRECTION_DECAY = 12;
const MAX_PENDING_INPUTS = 240;

/**
 * Client-side prediction for the local player. Inputs are applied immediately so movement and
 * shooting feel instant; when the server acknowledges inputs, the predictor rewinds to the
 * authoritative state and replays the ones it has not seen yet.
 */
export class Predictor {
  readonly player: PlayerState;
  private pending: PlayerInput[] = [];
  private previousPos: Vec3;
  private correction: Vec3 = vec3();

  constructor(
    private readonly physics: LevelPhysics,
    private readonly collider: CharacterCollider,
    playerId: number,
    initial: PredictedState,
  ) {
    this.player = createPlayerState(playerId, '', initial.pos);
    copyPredicted(initial, this.player);
    this.previousPos = clone(this.player.pos);
  }

  /** Simulates one input locally. Returns the shot it fired, for immediate effects. */
  predict(input: PlayerInput): Shot | null {
    this.previousPos = clone(this.player.pos);
    const shot = stepPlayer(this.player, input, TICK_DT, this.physics, this.collider);
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING_INPUTS) this.pending.shift();
    return shot;
  }

  /** Applies an authoritative snapshot of the local player and replays unacknowledged inputs. */
  reconcile(ackSeq: number, authoritative: PredictedState, vitals: PlayerSnapshot | undefined): void {
    this.pending = this.pending.filter((input) => input.seq > ackSeq);
    const before = clone(this.player.pos);

    if (vitals) {
      this.player.life = vitals.life;
      this.player.health = vitals.health;
      this.player.maxHealth = vitals.maxHealth;
      this.player.points = vitals.points;
    }
    copyPredicted(authoritative, this.player);
    let previous = clone(this.player.pos);
    for (const input of this.pending) {
      previous = clone(this.player.pos);
      stepPlayer(this.player, input, TICK_DT, this.physics, this.collider);
    }

    const error = sub(before, this.player.pos);
    if (length(error) > SNAP_DISTANCE) {
      this.correction = vec3();
      this.previousPos = clone(this.player.pos);
    } else {
      this.correction = {
        x: this.correction.x + error.x,
        y: this.correction.y + error.y,
        z: this.correction.z + error.z,
      };
      this.previousPos = previous;
    }
  }

  /** Where to draw the local player: between the last two predicted ticks, plus fading correction. */
  renderPosition(alpha: number, dtSeconds: number): Vec3 {
    const decay = Math.exp(-CORRECTION_DECAY * dtSeconds);
    this.correction = {
      x: this.correction.x * decay,
      y: this.correction.y * decay,
      z: this.correction.z * decay,
    };
    const p = lerp(this.previousPos, this.player.pos, alpha);
    return { x: p.x + this.correction.x, y: p.y + this.correction.y, z: p.z + this.correction.z };
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}
