import type { Collider } from '@dimforge/rapier3d-compat';
import { PLAYER } from '../config';
import type { LevelPhysics } from '../physics/physics';
import type { PlayerInput } from './input';
import { stepMovement } from './movement';
import type { PlayerState } from './state';
import { stepWeapon } from './weapon';
import type { Shot } from './weapon';

/**
 * Applies one input to a player: look direction, movement and weapon handling.
 * This is the function client-side prediction replays, so it must stay free of anything the
 * client cannot know (other entities, damage, points).
 */
export function stepPlayer(
  player: PlayerState,
  input: PlayerInput,
  dt: number,
  physics: LevelPhysics,
  collider: Collider,
): Shot | null {
  player.yaw = input.yaw;
  player.pitch = Math.max(-PLAYER.maxPitch, Math.min(PLAYER.maxPitch, input.pitch));

  if (player.life !== 'alive') {
    player.prevButtons = input.buttons;
    return null;
  }

  stepMovement(player, input, dt, physics, collider);
  const shot = stepWeapon(player, player.id, { ...input, pitch: player.pitch }, dt);
  player.prevButtons = input.buttons;
  return shot;
}
