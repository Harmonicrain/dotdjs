import { beforeAll, describe, expect, it } from 'vitest';
import type { Collider } from '@dimforge/rapier3d-compat';
import { TICK_DT, TICK_RATE } from '../src/config';
import { getLevel, DEFAULT_LEVEL_ID } from '../src/level';
import { createCharacterCollider, createLevelPhysics, initPhysics } from '../src/physics/physics';
import type { LevelPhysics } from '../src/physics/physics';
import { Button } from '../src/player/input';
import type { PlayerInput } from '../src/player/input';
import { createPlayerState, createWeaponState } from '../src/player/state';
import type { PlayerState } from '../src/player/state';
import { stepPlayer } from '../src/player/step';
import { pelletDirections, stepWeapon } from '../src/player/weapon';
import { WEAPONS } from '../src/weapons/defs';
import { input } from './helpers';

let physics: LevelPhysics;
let collider: Collider;

beforeAll(async () => {
  await initPhysics();
  physics = createLevelPhysics(getLevel(DEFAULT_LEVEL_ID));
  collider = createCharacterCollider(physics);
});

function playerAt(x: number, y: number, z: number): PlayerState {
  return createPlayerState(1, 'Test', { x, y, z });
}

function run(player: PlayerState, seconds: number, overrides: Partial<PlayerInput>): void {
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) {
    stepPlayer(player, input(overrides), TICK_DT, physics, collider);
  }
}

describe('player movement', () => {
  it('falls onto the ground and becomes grounded', () => {
    const p = playerAt(0, 2, -12);
    run(p, 1, {});
    expect(p.grounded).toBe(true);
    expect(p.pos.y).toBeGreaterThanOrEqual(-0.01);
    expect(p.pos.y).toBeLessThan(0.1);
  });

  it('walks forward (towards -Z at yaw 0) at walking speed', () => {
    const p = playerAt(0, 0.05, -12);
    run(p, 0.2, {});
    const startZ = p.pos.z;
    run(p, 1, { moveY: 1 });
    const travelled = startZ - p.pos.z;
    expect(travelled).toBeGreaterThan(4.0);
    expect(travelled).toBeLessThan(4.6);
  });

  it('is stopped by walls', () => {
    // Inside the bunker, walking north into the solid part of its north wall (inner face z = -4.75).
    const p = playerAt(-3, 0.05, -1);
    run(p, 3, { moveY: 1 });
    expect(p.pos.z).toBeGreaterThan(-4.75);
    expect(p.pos.z).toBeLessThan(-4.2);
    // Momentum into the wall is absorbed rather than stored up.
    expect(Math.abs(p.vel.z)).toBeLessThan(0.5);
  });

  it('slides along a wall when running into it at an angle', () => {
    const p = playerAt(-3, 0.05, -3);
    run(p, 1.5, { moveY: 1, yaw: Math.PI / 4 }); // north-west into the north wall
    expect(p.pos.z).toBeGreaterThan(-4.75);
    expect(p.pos.x).toBeLessThan(-4);
  });

  it('jumps about a metre and lands again', () => {
    const p = playerAt(0, 0.05, -12);
    run(p, 0.3, {});
    let peak = p.pos.y;
    stepPlayer(p, input({ buttons: Button.Jump }), TICK_DT, physics, collider);
    for (let i = 0; i < TICK_RATE; i++) {
      stepPlayer(p, input(), TICK_DT, physics, collider);
      peak = Math.max(peak, p.pos.y);
    }
    expect(peak).toBeGreaterThan(0.85);
    expect(peak).toBeLessThan(1.2);
    expect(p.grounded).toBe(true);
  });

  it('climbs the stairs onto the north-west platform', () => {
    const p = playerAt(-15.5, 0.05, -7);
    run(p, 3, { moveY: 1 });
    expect(p.pos.y).toBeGreaterThan(1.1);
    expect(p.pos.z).toBeLessThan(-11);
  });

  it('walks up the ramp onto the south-east deck', () => {
    const p = playerAt(5, 0.05, 16);
    run(p, 3, { moveY: 1, yaw: -Math.PI / 2 });
    expect(p.pos.x).toBeGreaterThan(12);
    expect(p.pos.y).toBeGreaterThan(1.4);
  });

  it('does not move while dead', () => {
    const p = playerAt(0, 0.05, -12);
    p.life = 'dead';
    run(p, 1, { moveY: 1 });
    expect(p.pos.z).toBe(-12);
  });
});

describe('weapons', () => {
  const fire = (p: PlayerState, buttons: number, slot = 0) =>
    stepWeapon(p, p.id, input({ buttons, weaponSlot: slot }), TICK_DT);

  function holdFor(p: PlayerState, ticks: number, buttons: number): number {
    let shots = 0;
    for (let i = 0; i < ticks; i++) {
      if (fire(p, buttons)) shots++;
      p.prevButtons = buttons;
    }
    return shots;
  }

  it('semi-automatic weapons need a fresh trigger pull per shot', () => {
    const p = playerAt(0, 0, 0);
    p.grounded = true;
    expect(holdFor(p, 60, Button.Fire)).toBe(1);
    holdFor(p, 1, 0);
    expect(holdFor(p, 1, Button.Fire)).toBe(1);
  });

  it('automatic weapons fire at their rated cadence', () => {
    const p = playerAt(0, 0, 0);
    p.grounded = true;
    p.weapons = [createWeaponState('stg44')];
    expect(holdFor(p, TICK_RATE, Button.Fire)).toBe(WEAPONS.stg44.rpm / 60);
  });

  it('reloads automatically when firing an empty weapon, taking reload time', () => {
    const p = playerAt(0, 0, 0);
    p.grounded = true;
    p.weapons[0]!.clip = 0;
    fire(p, Button.Fire);
    expect(p.reloadTimer).toBeCloseTo(WEAPONS.m1911.reloadTime);
    holdFor(p, Math.ceil(WEAPONS.m1911.reloadTime * TICK_RATE) + 1, 0);
    expect(p.weapons[0]!.clip).toBe(WEAPONS.m1911.clipSize);
    expect(p.weapons[0]!.reserve).toBe(WEAPONS.m1911.maxReserve - WEAPONS.m1911.clipSize);
  });

  it('cannot fire while sprinting', () => {
    const p = playerAt(0, 0, 0);
    p.sprinting = true;
    expect(fire(p, Button.Fire)).toBeNull();
  });

  it('pellet spread is deterministic per player and shot', () => {
    const a = pelletDirections(0.3, 0.1, 0.05, 8, 1, 7);
    const b = pelletDirections(0.3, 0.1, 0.05, 8, 1, 7);
    const c = pelletDirections(0.3, 0.1, 0.05, 8, 1, 8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    for (const d of a) expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
  });
});
