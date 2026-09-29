import { PLAYER } from '../config';
import { clone, vec3 } from '../math/vec3';
import type { Vec3 } from '../math/vec3';
import { STARTING_WEAPON, WEAPONS } from '../weapons/defs';
import type { WeaponId } from '../weapons/defs';

export interface WeaponState {
  id: WeaponId;
  clip: number;
  reserve: number;
}

/**
 * Everything the owning client predicts locally. The server sends these fields back for the
 * local player so the client can rewind to them and replay its unacknowledged inputs.
 */
export interface PredictedState {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  sprinting: boolean;
  prevButtons: number;
  weapons: WeaponState[];
  activeSlot: number;
  /** Seconds until the next shot may fire (may dip below zero while the trigger is held). */
  fireCooldown: number;
  /** Seconds left on the current reload; 0 when not reloading. */
  reloadTimer: number;
  /** Seconds left raising the active weapon after a switch; 0 when ready. */
  drawTimer: number;
  /** Shots fired so far; seeds deterministic bullet spread. */
  shotCounter: number;
}

export type LifeState = 'alive' | 'dead';

export interface PlayerState extends PredictedState {
  id: number;
  name: string;
  yaw: number;
  pitch: number;
  life: LifeState;
  health: number;
  maxHealth: number;
  /** Seconds until health starts regenerating. */
  regenTimer: number;
  /** Seconds of remaining post-hit invulnerability. */
  immunityTimer: number;
  points: number;
  kills: number;
  headshots: number;
  /** Last input sequence number the server applied for this player. */
  lastInputSeq: number;
}

export function createWeaponState(id: WeaponId): WeaponState {
  const def = WEAPONS[id];
  return { id, clip: def.clipSize, reserve: def.maxReserve };
}

export function createPlayerState(id: number, name: string, spawn: Vec3): PlayerState {
  return {
    id,
    name,
    pos: clone(spawn),
    vel: vec3(),
    grounded: false,
    sprinting: false,
    prevButtons: 0,
    weapons: [createWeaponState(STARTING_WEAPON)],
    activeSlot: 0,
    fireCooldown: 0,
    reloadTimer: 0,
    drawTimer: 0,
    shotCounter: 0,
    yaw: 0,
    pitch: 0,
    life: 'alive',
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    regenTimer: 0,
    immunityTimer: 0,
    points: PLAYER.startingPoints,
    kills: 0,
    headshots: 0,
    lastInputSeq: 0,
  };
}

/** Deep copy of the predicted fields. */
export function copyPredicted(from: PredictedState, to: PredictedState): void {
  to.pos = clone(from.pos);
  to.vel = clone(from.vel);
  to.grounded = from.grounded;
  to.sprinting = from.sprinting;
  to.prevButtons = from.prevButtons;
  to.weapons = from.weapons.map((w) => ({ ...w }));
  to.activeSlot = from.activeSlot;
  to.fireCooldown = from.fireCooldown;
  to.reloadTimer = from.reloadTimer;
  to.drawTimer = from.drawTimer;
  to.shotCounter = from.shotCounter;
}

export const eyePosition = (p: { pos: Vec3 }): Vec3 => ({
  x: p.pos.x,
  y: p.pos.y + PLAYER.eyeHeight,
  z: p.pos.z,
});

export const activeWeapon = (p: PredictedState): WeaponState => {
  const weapon = p.weapons[p.activeSlot] ?? p.weapons[0];
  if (!weapon) throw new Error('Player has no weapons');
  return weapon;
};
