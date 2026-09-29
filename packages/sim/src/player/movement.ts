import type { Collider } from '@dimforge/rapier3d-compat';
import { PLAYER } from '../config';
import { fround } from '../math/vec3';
import { moveCharacter } from '../physics/physics';
import type { LevelPhysics } from '../physics/physics';
import { Button, isDown, wasPressed } from './input';
import type { PlayerInput } from './input';
import type { PredictedState } from './state';

/**
 * Advances a player's position and velocity by one tick. Deterministic given the same state,
 * input and level, which is what lets the client predict its own movement.
 */
export function stepMovement(
  state: PredictedState,
  input: PlayerInput,
  dt: number,
  physics: LevelPhysics,
  collider: Collider,
): void {
  let moveX = input.moveX;
  let moveY = input.moveY;
  const inputLength = Math.hypot(moveX, moveY);
  if (inputLength > 1) {
    moveX /= inputLength;
    moveY /= inputLength;
  }

  const aiming = isDown(input.buttons, Button.Aim);
  state.sprinting =
    isDown(input.buttons, Button.Sprint) &&
    moveY > 0.5 &&
    !aiming &&
    !isDown(input.buttons, Button.Fire);

  let speed = state.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (aiming) speed *= PLAYER.aimSpeedMultiplier;
  if (moveY < 0) speed *= PLAYER.backpedalMultiplier;

  // Wish direction on the ground plane: forward is -Z at yaw 0.
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  const targetX = (moveX * cos - moveY * sin) * speed;
  const targetZ = (-moveX * sin - moveY * cos) * speed;

  const acceleration = state.grounded ? PLAYER.groundAcceleration : PLAYER.airAcceleration;
  const dx = targetX - state.vel.x;
  const dz = targetZ - state.vel.z;
  const delta = Math.hypot(dx, dz);
  const maxDelta = acceleration * dt;
  if (delta <= maxDelta) {
    state.vel.x = targetX;
    state.vel.z = targetZ;
  } else {
    state.vel.x += (dx / delta) * maxDelta;
    state.vel.z += (dz / delta) * maxDelta;
  }

  if (state.grounded && wasPressed(input.buttons, state.prevButtons, Button.Jump)) {
    state.vel.y = PLAYER.jumpVelocity;
    state.grounded = false;
  } else if (state.grounded) {
    // Pushing into the floor makes the controller drop the rest of the move; snap-to-ground
    // already keeps a grounded player glued to slopes and steps.
    state.vel.y = 0;
  } else {
    state.vel.y = Math.max(state.vel.y - PLAYER.gravity * dt, -PLAYER.terminalVelocity);
  }

  const desired = { x: state.vel.x * dt, y: state.vel.y * dt, z: state.vel.z * dt };
  const { moved, grounded, obstacleNormals } = moveCharacter(
    physics,
    collider,
    state.pos,
    desired,
  );

  state.pos.x += moved.x;
  state.pos.y += moved.y;
  state.pos.z += moved.z;

  // Walls absorb the part of the velocity driven into them; sliding along them is kept.
  for (const n of obstacleNormals) {
    const into = state.vel.x * n.x + state.vel.z * n.z;
    if (into < 0) {
      state.vel.x -= into * n.x;
      state.vel.z -= into * n.z;
    }
  }
  if (grounded && state.vel.y < 0) state.vel.y = 0;
  if (state.vel.y > 0 && moved.y < desired.y - 1e-4) state.vel.y = 0; // head hit a ceiling
  state.grounded = grounded;

  // Keep state exactly representable as float32 so snapshots round-trip losslessly.
  fround(state.pos);
  fround(state.vel);
}
