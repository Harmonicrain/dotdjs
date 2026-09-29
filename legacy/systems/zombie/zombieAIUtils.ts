import * as BABYLON from '@babylonjs/core';
import { Zombie } from '../../types/entities';
import { ZombieManager } from '../../managers/ZombieManager';
import { HellhoundManager } from '../../managers/HellhoundManager';
import { MapConfigManager } from '../../managers/MapConfigManager';

/**
 * Pre-allocated scratch vectors shared across all zombie AI systems.
 *
 * Safety: These are module-level singletons. They are safe to share because
 * SystemManager executes all systems sequentially in the same frame — no
 * concurrency, no interleaving between zombie loops.
 */
export const _tempNavEndVec = new BABYLON.Vector3();
export const _tempDirectDir = new BABYLON.Vector3();
export const _tempMoveResult = new BABYLON.Vector3();
export const _tempLookAt = new BABYLON.Vector3();
export const _tempLungeDir = new BABYLON.Vector3();
export const _tempRetreatDir = new BABYLON.Vector3();
// Avoids two Quaternion allocations per rotating zombie per frame
export const _tempTargetQuat = new BABYLON.Quaternion();

// Shared constants
export const PATH_UPDATE_INTERVAL = 0.5;   // Hellhounds / non-crowd fallback path recompute interval
export const PATH_REACH_THRESHOLD = 0.8;
export const ROTATION_SPEED = 0.15;

// ── Minimal context interfaces ────────────────────────────────────────────────

export interface IBurnDamageCtx {
    configManager: MapConfigManager;
    hellhoundManager: HellhoundManager;
    zombieManager: ZombieManager;
}

export interface INavPathCtx {
    navPlugin?: BABYLON.RecastJSPlugin;
    getIsPathfindingActive: () => boolean;
}

export interface ITargetCtx {
    camera: BABYLON.UniversalCamera;
    gameState: { isDowned: boolean; isGameOver: boolean };
    gameModeRef: { current: string };
    connectionStatusRef: { current: string };
    remote: { pos: BABYLON.Vector3; gameState: { isDowned: boolean } };
}

// ── Utility functions ─────────────────────────────────────────────────────────

/**
 * Ticks burning damage on a zombie.
 * Returns true if the zombie died from burn damage this tick.
 */
export const updateBurningDamage = (
    z: Zombie,
    now: number,
    ctx: IBurnDamageCtx
): boolean => {
    if (!z.isBurning) return false;

    const zc = ctx.configManager.zombieAI;
    if (!z.lastBurnTime || now - z.lastBurnTime > zc.BURN_INTERVAL) {
        z.health -= zc.BURN_DAMAGE;
        z.lastBurnTime = now;
        if (z.health <= 0) {
            if (z.type === 'HELLHOUND') {
                ctx.hellhoundManager.onHellhoundDeath(z, z.mesh.position, 'HOST');
            } else {
                ctx.zombieManager.onZombieDeath(z, z.mesh.position, 'HOST');
            }
            return true;
        }
    }
    return false;
};

/**
 * Computes navmesh path direction for a zombie toward targetPos.
 * Uses a pathCursor index (O(1) advance) instead of Array.shift() (O(n)).
 * Returns a normalised direction vector, or null if no movement needed.
 * NOTE: return value aliases _tempDirectDir — consume before the next call.
 */
export const computeNavPath = (
    z: Zombie,
    targetPos: BABYLON.Vector3,
    dt: number,
    ctx: INavPathCtx
): BABYLON.Vector3 | null => {
    if (!ctx.navPlugin) {
        _tempDirectDir.set(targetPos.x - z.mesh.position.x, 0, targetPos.z - z.mesh.position.z);
        if (_tempDirectDir.lengthSquared() > 0.001) {
            _tempDirectDir.normalize();
            return _tempDirectDir;
        }
        return null;
    }

    if (z.pathUpdateTimer === undefined) z.pathUpdateTimer = Math.random() * PATH_UPDATE_INTERVAL;
    z.pathUpdateTimer -= dt;

    const cursor = z.pathCursor ?? 0;
    const pathExhausted = !z.path || cursor >= z.path.length;

    if (pathExhausted || z.pathUpdateTimer <= 0) {
        const navStart = ctx.navPlugin.getClosestPoint(z.mesh.position);
        _tempNavEndVec.set(targetPos.x, 0, targetPos.z);
        const navEnd = ctx.navPlugin.getClosestPoint(_tempNavEndVec);

        const distToNavStart = BABYLON.Vector3.Distance(z.mesh.position, navStart);
        const distToNavEnd = BABYLON.Vector3.Distance(targetPos, navEnd);

        if (distToNavStart > 5 && !z.warnedNavStart) {
            if (ctx.getIsPathfindingActive()) {
                console.warn(`[ZombieAI] ${z.type} ${z.id}: Start far from navmesh (${distToNavStart.toFixed(2)}m)`);
            }
            z.warnedNavStart = true;
        }
        if (distToNavEnd > 5 && !z.warnedNavEnd) {
            if (ctx.getIsPathfindingActive()) {
                console.warn(`[ZombieAI] ${z.type} ${z.id}: Target far from navmesh (${distToNavEnd.toFixed(2)}m)`);
            }
            z.warnedNavEnd = true;
        }

        const newPath = ctx.navPlugin.computePath(navStart, navEnd);
        z.pathUpdateTimer = PATH_UPDATE_INTERVAL + (Math.random() * 0.1);

        if (newPath && newPath.length > 0) {
            z.path = newPath;
            z.pathfindingFailed = false;
            z.pathCursor = (BABYLON.Vector3.DistanceSquared(z.mesh.position, newPath[0]) < 0.25) ? 1 : 0;
        } else {
            if (!z.pathfindingFailed) {
                if (ctx.getIsPathfindingActive()) {
                    console.warn(`[ZombieAI] ${z.type} ${z.id}: Navmesh pathfinding failed, using direct movement`);
                }
                z.pathfindingFailed = true;
            }
        }
    }

    if (z.path && z.pathCursor !== undefined && z.pathCursor < z.path.length) {
        const distToNodeSq = BABYLON.Vector3.DistanceSquared(z.mesh.position, z.path[z.pathCursor]);
        if (distToNodeSq < PATH_REACH_THRESHOLD * PATH_REACH_THRESHOLD) {
            z.pathCursor++;
        }

        if (z.pathCursor < z.path.length) {
            z.path[z.pathCursor].subtractToRef(z.mesh.position, _tempDirectDir);
            _tempDirectDir.normalize();
            return _tempDirectDir;
        }
    }

    _tempDirectDir.set(targetPos.x - z.mesh.position.x, 0, targetPos.z - z.mesh.position.z);
    if (_tempDirectDir.lengthSquared() > 0.001) {
        _tempDirectDir.normalize();
        return _tempDirectDir;
    }
    return null;
};

/**
 * Tags a zombie's entire mesh hierarchy with metadata for O(1) lookup.
 * Used by ProjectileSystem to find which zombie was hit without per-frame rebuilds.
 */
export const tagZombieMeshes = (z: Zombie) => {
    const metadata = { zombie: z, isEnemy: true };
    z.mesh.metadata = metadata;
    // Recursively tag all children (head, torso, limbs, eyes, etc.)
    const children = z.mesh.getChildMeshes(false);
    for (let i = 0; i < children.length; i++) {
        children[i].metadata = metadata;
    }
};

/**
 * Applies SLERP rotation smoothing toward movement direction.
 * Uses pre-allocated _tempTargetQuat to avoid allocations.
 */
export const applyRotationSmoothing = (
    z: Zombie,
    moveDir: BABYLON.Vector3,
    frameFactor: number
): void => {
    if (moveDir.lengthSquared() > 0.001) {
        const yaw = Math.atan2(moveDir.x, moveDir.z);
        BABYLON.Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, _tempTargetQuat);
        if (!z.mesh.rotationQuaternion) {
            z.mesh.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(z.mesh.rotation);
        }
        BABYLON.Quaternion.SlerpToRef(
            z.mesh.rotationQuaternion,
            _tempTargetQuat,
            ROTATION_SPEED * frameFactor,
            z.mesh.rotationQuaternion
        );
    }
};

/**
 * Selects the closest active player as the zombie's target.
 * Writes result into targetPosOut and returns the target player ID.
 */
export const getTargetPosition = (
    z: Zombie,
    ctx: ITargetCtx,
    targetPosOut: BABYLON.Vector3
): 'HOST' | 'CLIENT' => {
    targetPosOut.copyFrom(ctx.camera.position);
    let targetId: 'HOST' | 'CLIENT' = 'HOST';

    const isLocalActive = !ctx.gameState.isDowned && !ctx.gameState.isGameOver;
    const isRemoteActive = ctx.gameModeRef.current === 'HOST' &&
        ctx.connectionStatusRef.current === 'CONNECTED' &&
        !ctx.remote.gameState.isDowned;

    if (isLocalActive && isRemoteActive) {
        const distToLocal = BABYLON.Vector3.Distance(z.mesh.position, ctx.camera.position);
        const distToRemote = BABYLON.Vector3.Distance(z.mesh.position, ctx.remote.pos);
        if (distToRemote < distToLocal) {
            targetPosOut.copyFrom(ctx.remote.pos);
            targetId = 'CLIENT';
        }
    } else if (isRemoteActive) {
        targetPosOut.copyFrom(ctx.remote.pos);
        targetId = 'CLIENT';
    }

    return targetId;
};

/**
 * Common authority and pause/debug guard for all zombie AI systems.
 */
export function isZombieSystemActive(ctx: { gameModeRef: { current: string }, gameState: { isDebugMode?: boolean, isPaused: boolean } }): boolean {
    const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
    // In multiplayer, pause only affects local player UI — game logic continues
    const isMultiplayer = ctx.gameModeRef.current !== 'SOLO';
    const effectivelyPaused = ctx.gameState.isPaused && !isMultiplayer;
    return isAuthority && !ctx.gameState.isDebugMode && !effectivelyPaused;
}

/**
 * Applies gravity to a movement vector and performs moveWithCollisions.
 */
export function applyGravityAndMove(z: Zombie, gravity: number, frameFactor: number, moveResult: BABYLON.Vector3): void {
    moveResult.y += gravity * 3 * frameFactor;
    z.mesh.moveWithCollisions(moveResult);
}

/**
 * Clamps a zombie's Y position to 0 if it's within a small threshold of the ground.
 * Prevents floating/jitter on slightly uneven navmesh geometry.
 */
export function clampZombieY(z: Zombie): void {
    if (z.mesh.position.y > 0 && z.mesh.position.y < 0.15) {
        z.mesh.position.y = 0;
    }
}
