import { quatFromEuler, rotateVec3, IDENTITY_QUAT } from '../math/quat';
import type { Quat } from '../math/quat';
import type { LevelBox, LevelDef } from './types';
import { PROVING_GROUNDS } from './levels/provingGrounds';

export type * from './types';

const LEVELS: Readonly<Record<string, LevelDef>> = {
  [PROVING_GROUNDS.id]: PROVING_GROUNDS,
};

export const DEFAULT_LEVEL_ID = PROVING_GROUNDS.id;

export function getLevel(id: string): LevelDef {
  const level = LEVELS[id];
  if (!level) throw new Error(`Unknown level "${id}"`);
  return level;
}

export const boxRotation = (box: LevelBox): Quat =>
  box.rotation ? quatFromEuler(box.rotation) : { ...IDENTITY_QUAT };

// Corner order: bit 0 = +x, bit 1 = +y, bit 2 = +z. Quads wind so normals face outward,
// which Recast relies on to tell walkable floors (+y normals) from walls and ceilings.
const BOX_FACES: readonly (readonly [number, number, number, number])[] = [
  [4, 6, 2, 0], // -x
  [3, 7, 5, 1], // +x
  [1, 5, 4, 0], // -y
  [6, 7, 3, 2], // +y
  [2, 3, 1, 0], // -z
  [5, 7, 6, 4], // +z
];

/** Triangle soup of every level box (counter-clockwise, outward facing), for navmesh generation. */
export function levelTriangles(level: LevelDef): { positions: Float32Array; indices: Uint32Array } {
  const positions = new Float32Array(level.boxes.length * 8 * 3);
  const indices = new Uint32Array(level.boxes.length * 6 * 6);
  let p = 0;
  let i = 0;
  level.boxes.forEach((box, boxIndex) => {
    const q = boxRotation(box);
    const [hx, hy, hz] = [box.size[0] / 2, box.size[1] / 2, box.size[2] / 2];
    for (let corner = 0; corner < 8; corner++) {
      const local = {
        x: corner & 1 ? hx : -hx,
        y: corner & 2 ? hy : -hy,
        z: corner & 4 ? hz : -hz,
      };
      const world = rotateVec3(local, q);
      positions[p++] = world.x + box.center[0];
      positions[p++] = world.y + box.center[1];
      positions[p++] = world.z + box.center[2];
    }
    const base = boxIndex * 8;
    for (const [a, b, c, d] of BOX_FACES) {
      indices.set([base + a, base + b, base + c, base + a, base + c, base + d], i);
      i += 6;
    }
  });
  return { positions, indices };
}
