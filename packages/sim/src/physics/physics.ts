import RAPIER from '@dimforge/rapier3d-compat';
import type { Collider, KinematicCharacterController, World } from '@dimforge/rapier3d-compat';
import { PLAYER } from '../config';
import { boxRotation } from '../level';
import type { LevelDef } from '../level';
import type { Vec3 } from '../math/vec3';

let rapierReady: Promise<void> | undefined;

/** Loads the Rapier WASM module. Safe to call repeatedly. */
export function initPhysics(): Promise<void> {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

const GROUP_STATIC = 1 << 0;
const GROUP_PLAYER = 1 << 1;
const interactionGroups = (memberships: number, filter: number): number =>
  ((memberships & 0xffff) << 16) | (filter & 0xffff);

/** Players collide with level geometry only, never with each other. */
const STATIC_GROUPS = interactionGroups(GROUP_STATIC, 0xffff);
const PLAYER_GROUPS = interactionGroups(GROUP_PLAYER, GROUP_STATIC);
/** Scene queries that should only see level geometry. */
const STATIC_QUERY = interactionGroups(0xffff, GROUP_STATIC);

/** A player's capsule collider (opaque outside the physics module). */
export type CharacterCollider = Collider;

export interface LevelPhysics {
  readonly world: World;
  readonly controller: KinematicCharacterController;
}

/** Builds static colliders for a level. `initPhysics()` must have resolved first. */
export function createLevelPhysics(level: LevelDef): LevelPhysics {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  for (const box of level.boxes) {
    const desc = RAPIER.ColliderDesc.cuboid(box.size[0] / 2, box.size[1] / 2, box.size[2] / 2)
      .setTranslation(box.center[0], box.center[1], box.center[2])
      .setRotation(boxRotation(box))
      .setCollisionGroups(STATIC_GROUPS);
    world.createCollider(desc);
  }
  // Scene queries only see colliders after the first step builds the acceleration structure.
  world.step();

  const controller = world.createCharacterController(0.02);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.enableAutostep(PLAYER.stepHeight, 0.15, false);
  controller.enableSnapToGround(PLAYER.snapToGroundDistance);
  controller.setMaxSlopeClimbAngle((PLAYER.maxSlopeDegrees * Math.PI) / 180);
  controller.setMinSlopeSlideAngle(((PLAYER.maxSlopeDegrees + 5) * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(false);

  return { world, controller };
}

export function disposeLevelPhysics(physics: LevelPhysics): void {
  physics.world.removeCharacterController(physics.controller);
  physics.world.free();
}

/** A player's capsule. Its position is set explicitly before every movement query. */
export function createCharacterCollider(physics: LevelPhysics): Collider {
  const halfHeight = PLAYER.height / 2 - PLAYER.radius;
  const desc = RAPIER.ColliderDesc.capsule(halfHeight, PLAYER.radius).setCollisionGroups(
    PLAYER_GROUPS,
  );
  return physics.world.createCollider(desc);
}

export function removeCharacterCollider(physics: LevelPhysics, collider: Collider): void {
  physics.world.removeCollider(collider, false);
}

export interface CharacterMove {
  /** Translation actually applied after collisions. */
  moved: Vec3;
  grounded: boolean;
  /** Horizontal unit normals of walls (not floors or ceilings) touched during the move. */
  obstacleNormals: Vec3[];
}

/** Surfaces steeper than this (|normal.y| below it) count as walls. */
const WALL_NORMAL_Y = 0.7;

/**
 * Moves a character capsule whose feet are at `feet` by `desired`, sliding along and stepping
 * over level geometry.
 */
export function moveCharacter(
  physics: LevelPhysics,
  collider: Collider,
  feet: Vec3,
  desired: Vec3,
): CharacterMove {
  const { controller } = physics;
  collider.setTranslation({ x: feet.x, y: feet.y + PLAYER.height / 2, z: feet.z });
  controller.computeColliderMovement(
    collider,
    desired,
    RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    STATIC_QUERY,
  );
  const m = controller.computedMovement();

  const obstacleNormals: Vec3[] = [];
  for (let i = 0; i < controller.numComputedCollisions(); i++) {
    const n = controller.computedCollision(i)?.normal1;
    if (!n || Math.abs(n.y) >= WALL_NORMAL_Y) continue;
    const len = Math.hypot(n.x, n.z);
    obstacleNormals.push({ x: n.x / len, y: 0, z: n.z / len });
  }

  return {
    moved: { x: m.x, y: m.y, z: m.z },
    grounded: controller.computedGrounded(),
    obstacleNormals,
  };
}

export interface RayHit {
  distance: number;
  normal: Vec3;
}

/** Casts a ray against level geometry only. `dir` must be normalised. */
export function raycastLevel(
  physics: LevelPhysics,
  origin: Vec3,
  dir: Vec3,
  maxDistance: number,
): RayHit | null {
  const hit = physics.world.castRayAndGetNormal(
    new RAPIER.Ray(origin, dir),
    maxDistance,
    true,
    undefined,
    STATIC_QUERY,
  );
  if (!hit) return null;
  return {
    distance: hit.timeOfImpact,
    normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
  };
}
