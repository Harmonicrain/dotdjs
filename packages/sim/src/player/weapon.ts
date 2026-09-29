import { hashFloat } from '../math/rng';
import { directionFromAngles, normalize } from '../math/vec3';
import type { Vec3 } from '../math/vec3';
import { WEAPONS } from '../weapons/defs';
import type { WeaponId } from '../weapons/defs';
import { Button, isDown, wasPressed } from './input';
import type { PlayerInput } from './input';
import { activeWeapon, eyePosition } from './state';
import type { PredictedState } from './state';

/** A fired shot: one ray per pellet from the player's eye. */
export interface Shot {
  weaponId: WeaponId;
  origin: Vec3;
  dirs: Vec3[];
  damage: number;
  headshotMultiplier: number;
  range: number;
}

const AIRBORNE_SPREAD_MULTIPLIER = 1.5;

/**
 * Handles weapon switching, reloading and firing for one tick.
 * Returns the shot fired this tick, if any. Damage is applied separately by the server.
 */
export function stepWeapon(
  state: PredictedState,
  playerId: number,
  input: PlayerInput,
  dt: number,
): Shot | null {
  const { buttons } = input;
  const prev = state.prevButtons;

  if (input.weaponSlot !== state.activeSlot && state.weapons[input.weaponSlot]) {
    state.activeSlot = input.weaponSlot;
    state.reloadTimer = 0;
    state.fireCooldown = 0;
    state.drawTimer = WEAPONS[activeWeapon(state).id].drawTime;
  }
  state.drawTimer = Math.max(0, state.drawTimer - dt);

  const weapon = activeWeapon(state);
  const def = WEAPONS[weapon.id];

  if (state.reloadTimer > 0) {
    state.reloadTimer -= dt;
    if (state.reloadTimer <= 0) {
      state.reloadTimer = 0;
      const loaded = Math.min(def.clipSize - weapon.clip, weapon.reserve);
      weapon.clip += loaded;
      weapon.reserve -= loaded;
    }
  }

  const triggerHeld = isDown(buttons, Button.Fire);
  const wantsToFire = def.automatic ? triggerHeld : wasPressed(buttons, prev, Button.Fire);
  const ready = state.reloadTimer === 0 && state.drawTimer === 0;

  const canReload = ready && weapon.clip < def.clipSize && weapon.reserve > 0;
  const reloadRequested =
    wasPressed(buttons, prev, Button.Reload) || (wantsToFire && weapon.clip === 0);
  if (canReload && reloadRequested) {
    state.reloadTimer = def.reloadTime;
    return null;
  }

  // Cooldown carries over while the trigger is held so automatic fire keeps an exact cadence.
  state.fireCooldown -= dt;
  const fires = wantsToFire && ready && !state.sprinting && weapon.clip > 0 && state.fireCooldown <= 0;
  if (!fires) {
    state.fireCooldown = Math.max(0, state.fireCooldown);
    return null;
  }

  weapon.clip -= 1;
  state.fireCooldown += 60 / def.rpm;
  state.shotCounter += 1;

  const aiming = isDown(buttons, Button.Aim);
  let spread = aiming ? def.adsSpread : def.hipSpread;
  if (!state.grounded) spread *= AIRBORNE_SPREAD_MULTIPLIER;

  return {
    weaponId: weapon.id,
    origin: eyePosition(state),
    dirs: pelletDirections(input.yaw, input.pitch, spread, def.pellets, playerId, state.shotCounter),
    damage: def.damage,
    headshotMultiplier: def.headshotMultiplier,
    range: def.range,
  };
}

/** Spread pattern derived from (player, shot number) so client and server agree on every pellet. */
export function pelletDirections(
  yaw: number,
  pitch: number,
  spread: number,
  pellets: number,
  playerId: number,
  shotNumber: number,
): Vec3[] {
  const aim = directionFromAngles(yaw, pitch);
  const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const up = {
    x: right.y * aim.z - right.z * aim.y,
    y: right.z * aim.x - right.x * aim.z,
    z: right.x * aim.y - right.y * aim.x,
  };
  const dirs: Vec3[] = [];
  for (let i = 0; i < pellets; i++) {
    const radius = spread * Math.sqrt(hashFloat(playerId, shotNumber, i, 1));
    const angle = 2 * Math.PI * hashFloat(playerId, shotNumber, i, 2);
    const a = radius * Math.cos(angle);
    const b = radius * Math.sin(angle);
    dirs.push(
      normalize({
        x: aim.x + right.x * a + up.x * b,
        y: aim.y + right.y * a + up.y * b,
        z: aim.z + right.z * a + up.z * b,
      }),
    );
  }
  return dirs;
}
