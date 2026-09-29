import type { LevelBox, LevelDef } from '../types';

/**
 * Greybox test arena: a walled yard at night with a small roofed bunker in the middle,
 * a stepped platform (north-west) and a ramped deck (south-east) to exercise movement.
 */

const RAMP_ANGLE = Math.atan2(1.5, 4.5);
const RAMP_LENGTH = Math.hypot(1.5, 4.5);
const RAMP_THICKNESS = 0.3;

const perimeter: LevelBox[] = [
  { center: [0, -0.5, 0], size: [48, 1, 48], surface: 'ground' },
  { center: [0, 2.5, -22.5], size: [46, 5, 1], surface: 'wall' },
  { center: [0, 2.5, 22.5], size: [46, 5, 1], surface: 'wall' },
  { center: [-22.5, 2.5, 0], size: [1, 5, 46], surface: 'wall' },
  { center: [22.5, 2.5, 0], size: [1, 5, 46], surface: 'wall' },
];

const bunker: LevelBox[] = [
  // North and south walls, each with a central doorway and lintel.
  { center: [-3.6, 1.6, -5], size: [4.8, 3.2, 0.5], surface: 'concrete' },
  { center: [3.6, 1.6, -5], size: [4.8, 3.2, 0.5], surface: 'concrete' },
  { center: [0, 2.8, -5], size: [2.4, 0.8, 0.5], surface: 'trim' },
  { center: [-3.6, 1.6, 5], size: [4.8, 3.2, 0.5], surface: 'concrete' },
  { center: [3.6, 1.6, 5], size: [4.8, 3.2, 0.5], surface: 'concrete' },
  { center: [0, 2.8, 5], size: [2.4, 0.8, 0.5], surface: 'trim' },
  // West wall is solid; east wall has a window opening.
  { center: [-6, 1.6, 0], size: [0.5, 3.2, 10.5], surface: 'concrete' },
  { center: [6, 1.6, -3.25], size: [0.5, 3.2, 3.5], surface: 'concrete' },
  { center: [6, 1.6, 3.25], size: [0.5, 3.2, 3.5], surface: 'concrete' },
  { center: [6, 0.5, 0], size: [0.5, 1, 3], surface: 'trim' },
  { center: [6, 2.8, 0], size: [0.5, 0.8, 3], surface: 'trim' },
  { center: [0, 3.35, 0], size: [12.5, 0.3, 10.5], surface: 'concrete' },
  { center: [-4.5, 0.5, -3.5], size: [1, 1, 1], surface: 'crate' },
];

const cover: LevelBox[] = [
  { center: [-11, 2, -11], size: [0.9, 4, 0.9], surface: 'concrete' },
  { center: [11, 2, -11], size: [0.9, 4, 0.9], surface: 'concrete' },
  { center: [-11, 2, 11], size: [0.9, 4, 0.9], surface: 'concrete' },
  { center: [11, 2, 11], size: [0.9, 4, 0.9], surface: 'concrete' },
  { center: [-9, 0.6, 6], size: [1.2, 1.2, 1.2], surface: 'crate' },
  { center: [-9.1, 1.8, 6.1], size: [1.2, 1.2, 1.2], rotation: [0, 0.3, 0], surface: 'crate' },
  { center: [8.5, 0.6, -9], size: [1.2, 1.2, 1.2], surface: 'crate' },
  { center: [9.8, 0.6, -9.3], size: [1.2, 1.2, 1.2], rotation: [0, 0.5, 0], surface: 'crate' },
  { center: [14, 0.6, 3], size: [1.2, 1.2, 1.2], surface: 'crate' },
  { center: [-15, 0.6, 4], size: [2.4, 1.2, 1.2], surface: 'crate' },
];

const platform: LevelBox[] = [
  { center: [-15.5, 0.6, -15.5], size: [9, 1.2, 9], surface: 'concrete' },
  { center: [-15.5, 0.45, -10.775], size: [3, 0.9, 0.45], surface: 'trim' },
  { center: [-15.5, 0.3, -10.325], size: [3, 0.6, 0.45], surface: 'trim' },
  { center: [-15.5, 0.15, -9.875], size: [3, 0.3, 0.45], surface: 'trim' },
];

const deck: LevelBox[] = [
  { center: [16, 0.75, 16], size: [8, 1.5, 8], surface: 'metal' },
  {
    center: [
      9.75 + (RAMP_THICKNESS / 2) * Math.sin(RAMP_ANGLE),
      0.75 - (RAMP_THICKNESS / 2) * Math.cos(RAMP_ANGLE),
      16,
    ],
    size: [RAMP_LENGTH, RAMP_THICKNESS, 3],
    rotation: [0, 0, RAMP_ANGLE],
    surface: 'metal',
  },
];

export const PROVING_GROUNDS: LevelDef = {
  id: 'proving-grounds',
  name: 'Proving Grounds',
  boxes: [...perimeter, ...bunker, ...cover, ...platform, ...deck],
  playerSpawns: [
    [0, 0.05, -1],
    [2, 0.05, 1],
    [-2, 0.05, 1],
    [0, 0.05, 2.5],
  ],
  zombieSpawns: [
    [-18, 0, 0],
    [-18, 0, 16],
    [-6, 0, -18],
    [8, 0, -18],
    [18, 0, -6],
    [18, 0, 4],
    [4, 0, 18],
    [-8, 0, 18],
  ],
  lights: [
    { position: [0, 2.9, 0], color: 0xffb46b, intensity: 14, range: 11, castShadow: true },
    { position: [-11, 4.4, -11], color: 0xff9a4a, intensity: 30, range: 18, flicker: true },
    { position: [11, 4.4, -11], color: 0xff9a4a, intensity: 30, range: 18 },
    { position: [-11, 4.4, 11], color: 0xff9a4a, intensity: 30, range: 18 },
    { position: [11, 4.4, 11], color: 0xff9a4a, intensity: 30, range: 18, flicker: true },
    { position: [16, 3.2, 16], color: 0x9ad0ff, intensity: 18, range: 12 },
  ],
  atmosphere: {
    fogColor: 0x0b0f16,
    fogDensity: 0.032,
    skyColor: 0x22304d,
    groundColor: 0x0a0a0c,
    hemisphereIntensity: 0.55,
    moonColor: 0x9fb4ff,
    moonIntensity: 0.9,
    moonDirection: [0.45, -1, 0.3],
  },
};
