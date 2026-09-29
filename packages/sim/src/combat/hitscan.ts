import { ZOMBIE } from '../config';
import type { Vec3 } from '../math/vec3';

export interface HitboxHit {
  distance: number;
  headshot: boolean;
}

/** Distance along a ray to a sphere, or null if missed. `dir` must be normalised. */
export function raySphere(origin: Vec3, dir: Vec3, center: Vec3, radius: number): number | null {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const near = -b - sqrt;
  if (near >= 0) return near;
  const far = -b + sqrt;
  return far >= 0 ? 0 : null; // origin inside the sphere
}

/**
 * Distance along a ray to a vertical capsule (segment from `bottom` to `bottom + height` on Y),
 * or null if missed. Uses the closest-approach point, which is accurate enough to order hits.
 */
export function rayVerticalCapsule(
  origin: Vec3,
  dir: Vec3,
  maxDistance: number,
  bottom: Vec3,
  height: number,
  radius: number,
): number | null {
  // Closest points between the ray and the capsule's core segment.
  const wx = origin.x - bottom.x;
  const wy = origin.y - bottom.y;
  const wz = origin.z - bottom.z;
  const b = dir.y; // dot(dir, segment axis)
  const d = wx * dir.x + wy * dir.y + wz * dir.z;
  const e = wy; // dot(w, axis)
  const denom = 1 - b * b;
  let t = denom > 1e-8 ? (b * e - d) / denom : 0;
  t = Math.max(0, Math.min(maxDistance, t));
  let s = Math.max(0, Math.min(height, e + b * t));
  // Re-project the ray onto the clamped segment point for the true closest approach.
  t = Math.max(0, Math.min(maxDistance, -(wx * dir.x + (wy - s) * dir.y + wz * dir.z)));
  s = Math.max(0, Math.min(height, e + b * t));

  const px = origin.x + dir.x * t - bottom.x;
  const py = origin.y + dir.y * t - (bottom.y + s);
  const pz = origin.z + dir.z * t - bottom.z;
  const distSq = px * px + py * py + pz * pz;
  if (distSq > radius * radius) return null;
  return Math.max(0, t - Math.sqrt(radius * radius - distSq));
}

/** Tests a ray against a zombie standing at `feet`. Head is checked first so it wins ties. */
export function rayHitsZombie(
  origin: Vec3,
  dir: Vec3,
  maxDistance: number,
  feet: Vec3,
): HitboxHit | null {
  const head = raySphere(
    origin,
    dir,
    { x: feet.x, y: feet.y + ZOMBIE.headHeight, z: feet.z },
    ZOMBIE.headRadius,
  );
  const body = rayVerticalCapsule(
    origin,
    dir,
    maxDistance,
    { x: feet.x, y: feet.y + ZOMBIE.bodyBottom, z: feet.z },
    ZOMBIE.bodyTop - ZOMBIE.bodyBottom,
    ZOMBIE.bodyRadius,
  );
  const headHit = head !== null && head <= maxDistance ? head : null;
  if (headHit !== null && (body === null || headHit <= body + ZOMBIE.headRadius)) {
    return { distance: headHit, headshot: true };
  }
  return body !== null ? { distance: body, headshot: false } : null;
}
