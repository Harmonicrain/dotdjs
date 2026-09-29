import { describe, expect, it } from 'vitest';
import { PositionHistory } from '../src/combat/history';
import { rayHitsZombie, raySphere, rayVerticalCapsule } from '../src/combat/hitscan';
import { ZOMBIE } from '../src/config';
import { createRng, hashFloat, nextFloat } from '../src/math/rng';
import { directionFromAngles, yawFromDirection } from '../src/math/vec3';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, () => nextFloat(a));
    const seqB = Array.from({ length: 5 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBe(5);
    for (const v of seqA) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of seqA) expect(v).toBeLessThan(1);
  });

  it('hashFloat is stable and varies with each input', () => {
    expect(hashFloat(1, 2, 3)).toBe(hashFloat(1, 2, 3));
    expect(hashFloat(1, 2, 3)).not.toBe(hashFloat(1, 2, 4));
    expect(hashFloat(1, 2, 3)).not.toBe(hashFloat(2, 2, 3));
  });
});

describe('angles', () => {
  it('yaw 0 looks down -Z and yawFromDirection inverts directionFromAngles', () => {
    const forward = directionFromAngles(0, 0);
    expect(forward.z).toBeCloseTo(-1);
    const d = directionFromAngles(1.1, 0);
    expect(yawFromDirection(d.x, d.z)).toBeCloseTo(1.1);
  });
});

describe('hitscan primitives', () => {
  const origin = { x: 0, y: 1, z: 0 };
  const forward = { x: 0, y: 0, z: -1 };

  it('raySphere hits in front and misses to the side', () => {
    expect(raySphere(origin, forward, { x: 0, y: 1, z: -10 }, 0.5)).toBeCloseTo(9.5);
    expect(raySphere(origin, forward, { x: 2, y: 1, z: -10 }, 0.5)).toBeNull();
    expect(raySphere(origin, forward, { x: 0, y: 1, z: 10 }, 0.5)).toBeNull();
  });

  it('rayVerticalCapsule hits the body and respects max distance', () => {
    const bottom = { x: 0, y: 0.5, z: -8 };
    expect(rayVerticalCapsule(origin, forward, 100, bottom, 1, 0.3)).toBeCloseTo(7.7, 1);
    expect(rayVerticalCapsule(origin, forward, 5, bottom, 1, 0.3)).toBeNull();
    expect(rayVerticalCapsule(origin, forward, 100, { ...bottom, x: 1 }, 1, 0.3)).toBeNull();
  });

  it('rayHitsZombie distinguishes head from body', () => {
    const feet = { x: 0, y: 0, z: -10 };
    const headRay = { x: 0, y: ZOMBIE.headHeight, z: 0 };
    const bodyRay = { x: 0, y: 1.0, z: 0 };
    expect(rayHitsZombie(headRay, forward, 100, feet)?.headshot).toBe(true);
    expect(rayHitsZombie(bodyRay, forward, 100, feet)?.headshot).toBe(false);
    expect(rayHitsZombie({ x: 0, y: 2.5, z: 0 }, forward, 100, feet)).toBeNull();
  });
});

describe('PositionHistory', () => {
  it('interpolates between recorded ticks and forgets old ones', () => {
    const h = new PositionHistory();
    h.record(10, { x: 0, y: 0, z: 0 });
    h.record(11, { x: 2, y: 0, z: 0 });
    expect(h.sample(10.5)?.x).toBeCloseTo(1);
    expect(h.sample(11)?.x).toBe(2);
    expect(h.sample(12)?.x).toBe(2); // only the earlier tick exists
    for (let t = 12; t < 100; t++) h.record(t, { x: t, y: 0, z: 0 });
    expect(h.sample(10)).toBeNull();
  });
});
