/** Plain 3D vector. Y is up; yaw 0 faces -Z (matches three.js camera conventions). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Vec3Tuple = readonly [number, number, number];

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const fromTuple = (t: Vec3Tuple): Vec3 => ({ x: t[0], y: t[1], z: t[2] });

export const clone = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copy(out: Vec3, v: Vec3): Vec3 {
  out.x = v.x;
  out.y = v.y;
  out.z = v.z;
  return out;
}

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });

/** a + b * s */
export const addScaled = (a: Vec3, b: Vec3, s: number): Vec3 => ({
  x: a.x + b.x * s,
  y: a.y + b.y * s,
  z: a.z + b.z * s,
});

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const length = (v: Vec3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b));

export function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  return len > 1e-9 ? scale(v, 1 / len) : vec3();
}

export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Rounds every component to float32 so the value survives a Float32 round-trip unchanged. */
export function fround(v: Vec3): Vec3 {
  v.x = Math.fround(v.x);
  v.y = Math.fround(v.y);
  v.z = Math.fround(v.z);
  return v;
}

/** Unit forward vector for a yaw/pitch pair. */
export function directionFromAngles(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

/** Yaw that faces along the given XZ direction. */
export const yawFromDirection = (dx: number, dz: number): number => Math.atan2(-dx, -dz);
