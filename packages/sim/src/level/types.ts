import type { Vec3Tuple } from '../math/vec3';

/** Visual surface category; the renderer picks a material per kind. */
export type SurfaceKind = 'ground' | 'wall' | 'concrete' | 'trim' | 'crate' | 'metal';

/** An oriented box of static level geometry. It collides, blocks bullets and shapes the navmesh. */
export interface LevelBox {
  center: Vec3Tuple;
  size: Vec3Tuple;
  /** XYZ Euler rotation in radians. */
  rotation?: Vec3Tuple;
  surface: SurfaceKind;
}

/** Render-only lighting hint. The simulation ignores lights. */
export interface LevelLight {
  position: Vec3Tuple;
  color: number;
  intensity: number;
  range: number;
  flicker?: boolean;
  castShadow?: boolean;
}

export interface LevelAtmosphere {
  fogColor: number;
  fogDensity: number;
  skyColor: number;
  groundColor: number;
  hemisphereIntensity: number;
  moonColor: number;
  moonIntensity: number;
  /** Direction the moonlight travels (towards the ground). */
  moonDirection: Vec3Tuple;
}

export interface LevelDef {
  id: string;
  name: string;
  boxes: readonly LevelBox[];
  playerSpawns: readonly Vec3Tuple[];
  /** Ground spawn points where zombies climb out of the earth. */
  zombieSpawns: readonly Vec3Tuple[];
  lights: readonly LevelLight[];
  atmosphere: LevelAtmosphere;
}
