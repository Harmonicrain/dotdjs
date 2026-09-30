import { describe, expect, it } from 'vitest';
import { getLevel, levelTriangles, DEFAULT_LEVEL_ID } from '../src/level';
import { quatFromEuler, rotateVec3 } from '../src/math/quat';
import type { LevelDef } from '../src/level';

const singleBox: LevelDef = {
  ...getLevel(DEFAULT_LEVEL_ID),
  boxes: [{ center: [0, 0, 0], size: [2, 2, 2], surface: 'ground' }],
};

describe('levelTriangles', () => {
  it('emits 12 outward-facing triangles per box', () => {
    const { positions, indices } = levelTriangles(singleBox);
    expect(indices.length).toBe(36);

    let upward = 0;
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!].map((i) => [
        positions[i * 3]!,
        positions[i * 3 + 1]!,
        positions[i * 3 + 2]!,
      ]) as [number[], number[], number[]];
      const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
      const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
      const normal = [
        e1[1]! * e2[2]! - e1[2]! * e2[1]!,
        e1[2]! * e2[0]! - e1[0]! * e2[2]!,
        e1[0]! * e2[1]! - e1[1]! * e2[0]!,
      ];
      const centroid = [0, 1, 2].map((k) => (a[k]! + b[k]! + c[k]!) / 3);
      // Outward: the normal points away from the box centre (the origin).
      expect(
        normal[0]! * centroid[0]! + normal[1]! * centroid[1]! + normal[2]! * centroid[2]!,
      ).toBeGreaterThan(0);
      if (normal[1]! > 0 && Math.abs(normal[0]!) < 1e-6 && Math.abs(normal[2]!) < 1e-6) upward++;
    }
    expect(upward).toBe(2);
  });

  it('every level has spawns for players and zombies', () => {
    const level = getLevel(DEFAULT_LEVEL_ID);
    expect(level.playerSpawns.length).toBeGreaterThanOrEqual(4);
    expect(level.zombieSpawns.length).toBeGreaterThan(0);
  });
});

describe('quatFromEuler', () => {
  it('rotates +X towards +Y for a positive Z rotation', () => {
    const v = rotateVec3({ x: 1, y: 0, z: 0 }, quatFromEuler([0, 0, Math.PI / 2]));
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });
});
