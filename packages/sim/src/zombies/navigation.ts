import { Crowd, init as initRecast, NavMeshQuery } from 'recast-navigation';
import type { CrowdAgent, NavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';
import { PLAYER, ZOMBIE } from '../config';
import { levelTriangles } from '../level';
import type { LevelDef } from '../level';
import type { Vec3 } from '../math/vec3';

let recastReady: Promise<void> | undefined;

/** Loads the Recast WASM module. Safe to call repeatedly. */
export function initNavigation(): Promise<void> {
  recastReady ??= initRecast();
  return recastReady;
}

const CELL_SIZE = 0.2;
const CELL_HEIGHT = 0.1;
const MAX_AGENTS = 64;
const NEAREST_POLY_EXTENTS = { x: 2, y: 4, z: 2 };

export interface Navigation {
  readonly navMesh: NavMesh;
  readonly query: NavMeshQuery;
  readonly crowd: Crowd;
}

export function createNavigation(level: LevelDef): Navigation {
  const { positions, indices } = levelTriangles(level);
  const result = generateSoloNavMesh(positions, indices, {
    cs: CELL_SIZE,
    ch: CELL_HEIGHT,
    walkableSlopeAngle: PLAYER.maxSlopeDegrees - 5,
    walkableHeight: Math.ceil(ZOMBIE.height / CELL_HEIGHT),
    walkableClimb: Math.floor(PLAYER.stepHeight / CELL_HEIGHT),
    walkableRadius: Math.ceil(ZOMBIE.radius / CELL_SIZE),
    maxEdgeLen: Math.round(12 / CELL_SIZE),
    maxSimplificationError: 1.3,
    minRegionArea: 8,
    mergeRegionArea: 20,
    maxVertsPerPoly: 6,
    detailSampleDist: CELL_SIZE * 6,
    detailSampleMaxError: CELL_HEIGHT,
  });
  if (!result.success)
    throw new Error(`Navmesh generation failed for ${level.id}: ${result.error}`);

  const navMesh = result.navMesh;
  const query = new NavMeshQuery(navMesh);
  const crowd = new Crowd(navMesh, { maxAgents: MAX_AGENTS, maxAgentRadius: ZOMBIE.radius * 1.5 });
  return { navMesh, query, crowd };
}

export function disposeNavigation(nav: Navigation): void {
  nav.crowd.destroy();
  nav.query.destroy();
  nav.navMesh.destroy();
}

/** Nearest point on the navmesh, or null if nothing walkable is close by. */
export function closestNavPoint(nav: Navigation, pos: Vec3): Vec3 | null {
  const result = nav.query.findClosestPoint(pos, { halfExtents: NEAREST_POLY_EXTENTS });
  return result.success ? result.point : null;
}

export function addZombieAgent(nav: Navigation, pos: Vec3, speed: number): CrowdAgent {
  return nav.crowd.addAgent(pos, {
    radius: ZOMBIE.radius,
    height: ZOMBIE.height,
    maxAcceleration: 30,
    maxSpeed: speed,
    collisionQueryRange: ZOMBIE.radius * 8,
    pathOptimizationRange: 15,
    separationWeight: 2,
  });
}
