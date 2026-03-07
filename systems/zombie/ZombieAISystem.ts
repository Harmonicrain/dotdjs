import * as BABYLON from '@babylonjs/core';
import { ZombieState, HellhoundState, GameStateData, WindowBarrier, RemoteGameState, GameMessage } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { ZoneSystem } from '../ZoneSystem';
import { EventBus } from '../../engine/EventBus';
import { TimerManager } from '../../engine/TimerManager';
import { ZombieManager } from '../../managers/ZombieManager';
import { HellhoundManager } from '../../managers/HellhoundManager';
import { VisualManager } from '../../managers/VisualManager';
import { MapConfigManager } from '../../managers/MapConfigManager';

export interface IZombieAIContext {
    gameState: GameStateData;
    scene: BABYLON.Scene;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    eventBus: EventBus;
    timerManager: TimerManager;
    zombieManager: ZombieManager;
    hellhoundManager: HellhoundManager;
    visualManager: VisualManager;
    configManager: MapConfigManager;
    zombies: Zombie[];

    windows: WindowBarrier[];
    zoneSystem: ZoneSystem;
    navPlugin?: BABYLON.RecastJSPlugin;
    remote: {
        pos: BABYLON.Vector3;
        gameState: RemoteGameState;
    };
    connectionStatusRef: { current: string };
    isDoorOpen(doorId: string): boolean;
    send(data: GameMessage): void;
    setHealth(v: number): void;
    setIsDowned(v: boolean): void;
    setIsGameOver(v: boolean): void;
    setFlashColor(v: string | null): void;
}

// Pre-allocated scratch vectors to avoid per-frame allocations
const _tempNavEndVec = new BABYLON.Vector3();
const _tempSeparation = new BABYLON.Vector3();
const _tempDirectDir = new BABYLON.Vector3();
const _tempGravity = new BABYLON.Vector3();
const _tempBlended = new BABYLON.Vector3();
const _tempMoveResult = new BABYLON.Vector3();
const _tempLookAt = new BABYLON.Vector3();
const _tempLungeDir = new BABYLON.Vector3();
const _tempRetreatDir = new BABYLON.Vector3();
// Scratch Quaternions — avoids two Quaternion allocations per moving zombie per frame
const _tempTargetQuat = new BABYLON.Quaternion();

// ── Spatial grid for O(n) separation force ───────────────────────────────
// Cell size slightly larger than the separation radius (~sqrt of ZOMBIE_SEPARATION_DIST).
// Rebuilt once per frame before the zombie loop; each zombie only checks its
// own cell and the 8 neighbours instead of all N zombies.
const _GRID_CELL_SIZE = 3;
const _separationGrid = new Map<number, Zombie[]>();

const _gridKey = (x: number, z: number): number => {
    const cx = Math.floor(x / _GRID_CELL_SIZE);
    const cz = Math.floor(z / _GRID_CELL_SIZE);
    // Simple integer hash — avoids string allocation
    return (cx & 0xFFFF) << 16 | (cz & 0xFFFF);
};

const buildSeparationGrid = (zombies: Zombie[]): void => {
    // Reuse existing bucket arrays where possible to minimise GC
    for (const bucket of _separationGrid.values()) bucket.length = 0;
    for (const z of zombies) {
        if (z.isDead) continue;
        const key = _gridKey(z.mesh.position.x, z.mesh.position.z);
        let bucket = _separationGrid.get(key);
        if (!bucket) { bucket = []; _separationGrid.set(key, bucket); }
        bucket.push(z);
    }
};

// Constants
const PATH_UPDATE_INTERVAL = 0.5;
const PATH_REACH_THRESHOLD = 0.8;
const ROTATION_SPEED = 0.15;

/**
 * Computes horizontal distance between two positions (ignoring Y).
 */
const getHorizontalDist = (p1: BABYLON.Vector3, p2: BABYLON.Vector3): number => {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dz * dz);
};

/**
 * Computes horizontal squared distance between two positions (ignoring Y).
 */
const getHorizontalDistSq = (p1: BABYLON.Vector3, p2: BABYLON.Vector3): number => {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return dx * dx + dz * dz;
};


/**
 * Updates burning damage for a zombie.
 * Returns true if zombie died.
 */
const updateBurningDamage = (
    z: Zombie,
    now: number,
    ctx: IZombieAIContext
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
 * Computes separation force from nearby zombies using the pre-built spatial
 * grid. Only the zombie's own cell and its 8 neighbours are checked, reducing
 * complexity from O(n²) to O(n * k) where k is average bucket occupancy.
 * Modifies _tempSeparation in place and returns it.
 */
const computeSeparationForce = (
    z: Zombie,
    separationDist: number
): BABYLON.Vector3 => {
    _tempSeparation.set(0, 0, 0);
    let neighbors = 0;

    const cx = Math.floor(z.mesh.position.x / _GRID_CELL_SIZE);
    const cz = Math.floor(z.mesh.position.z / _GRID_CELL_SIZE);

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const key = ((cx + dx) & 0xFFFF) << 16 | ((cz + dz) & 0xFFFF);
            const bucket = _separationGrid.get(key);
            if (!bucket) continue;
            for (const other of bucket) {
                if (other === z || other.isDead) continue;
                const distSq = BABYLON.Vector3.DistanceSquared(z.mesh.position, other.mesh.position);
                if (distSq < separationDist) {
                    const pushX = z.mesh.position.x - other.mesh.position.x;
                    const pushZ = z.mesh.position.z - other.mesh.position.z;
                    const len = Math.sqrt(pushX * pushX + pushZ * pushZ);
                    if (len > 0.001) {
                        _tempSeparation.x += pushX / len;
                        _tempSeparation.z += pushZ / len;
                    }
                    neighbors++;
                }
            }
        }
    }

    if (neighbors > 0) {
        _tempSeparation.scaleInPlace(1.0 / neighbors);
    }
    return _tempSeparation;
};

/**
 * Computes navmesh path for a zombie.
 * Uses a pathCursor index instead of Array.shift() so node advancement is O(1)
 * rather than O(n) (shift re-indexes the entire array on every consumed node).
 */
const computeNavPath = (
    z: Zombie,
    targetPos: BABYLON.Vector3,
    dt: number,
    ctx: IZombieAIContext
): BABYLON.Vector3 | null => {
    if (!ctx.navPlugin) {
        _tempDirectDir.set(targetPos.x - z.mesh.position.x, 0, targetPos.z - z.mesh.position.z);
        if (_tempDirectDir.lengthSquared() > 0.001) {
            _tempDirectDir.normalize();
            return _tempDirectDir;
        }
        return null;
    }

    if (z.pathUpdateTimer === undefined) z.pathUpdateTimer = 0;
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
            console.warn(`[ZombieAI] ${z.type} ${z.id}: Start far from navmesh (${distToNavStart.toFixed(2)}m)`);
            z.warnedNavStart = true;
        }
        if (distToNavEnd > 5 && !z.warnedNavEnd) {
            console.warn(`[ZombieAI] ${z.type} ${z.id}: Target far from navmesh (${distToNavEnd.toFixed(2)}m)`);
            z.warnedNavEnd = true;
        }

        const newPath = ctx.navPlugin.computePath(navStart, navEnd);
        z.pathUpdateTimer = PATH_UPDATE_INTERVAL + (Math.random() * 0.1);

        if (newPath && newPath.length > 0) {
            z.path = newPath;
            z.pathfindingFailed = false;
            // Skip first node if zombie is already standing on it
            z.pathCursor = (BABYLON.Vector3.DistanceSquared(z.mesh.position, newPath[0]) < 0.25) ? 1 : 0;
        } else {
            if (!z.pathfindingFailed) {
                console.warn(`[ZombieAI] ${z.type} ${z.id}: Navmesh pathfinding failed, using direct movement`);
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
 * Applies rotation smoothing toward movement direction.
 * Uses pre-allocated scratch Quaternion to avoid two allocations per call.
 */
const applyRotationSmoothing = (
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
 * Gets the best target position (host or client player).
 */
const getTargetPosition = (
    z: Zombie,
    ctx: IZombieAIContext,
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
 * ZombieAISystem
 *
 * Authority only (HOST or SOLO).
 * Responsibility: Handles zombie movement, pathfinding (zones/doors), 
 * wandering when player is downed (SOLO), and barrier interactions.
 * Uses MapConfigManager for map-specific tuning.
 */
export const createZombieAISystem = (ctx: IZombieAIContext): System => {
    const _targetPos = new BABYLON.Vector3();

    // ── O(1) window lookup ────────────────────────────────────────────────────
    // windows.find() was called every frame per zombie in window interaction states.
    // A Map keyed by window ID reduces that from O(n*windows) to O(n) per frame.
    // The map is rebuilt lazily whenever ctx.windows grows (windows are registered
    // after the system is created, so we can't build it once at factory time).
    const windowMap = new Map<string, (typeof ctx.windows)[0]>();
    let windowMapSnapshot: any = null;

    const rebuildWindowMap = () => {
        windowMap.clear();
        for (const w of ctx.windows) {
            windowMap.set(w.id, w);
        }
        windowMapSnapshot = ctx.windows.length > 0 ? ctx.windows[0] : null;
    };

    const ensureWindowMap = () => {
        // Rebuild when count changes (windows registered after system creation)
        if (windowMap.size !== ctx.windows.length) { rebuildWindowMap(); return; }
        // Handle same-map reloads by checking reference of first window
        if (ctx.windows.length > 0 && windowMapSnapshot !== ctx.windows[0]) { rebuildWindowMap(); return; }
    };
    /**
     * Updates hellhound AI state machine.
     */

    const updateHellhoundAI = (
        z: Zombie,
        dt: number,
        separation: BABYLON.Vector3,
        frameFactor: number
    ): void => {
        const hc = ctx.configManager.hellhound;
        const sc = ctx.configManager.sync;
        const gc = ctx.configManager.gameplay;

        if (z.stateTimer !== undefined) {
            z.stateTimer -= dt * 1000;
        }

        const targetId = getTargetPosition(z, ctx, _targetPos);
        z.targetPlayerId = targetId;

        if (z.hellhoundState === HellhoundState.SPAWNING) {
            if (z.stateTimer !== undefined && z.stateTimer <= 0) {
                z.hellhoundState = HellhoundState.CHASING;
            }
            _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;
            z.mesh.moveWithCollisions(_tempMoveResult);
            return;
        }

        const distToTargetSq = BABYLON.Vector3.DistanceSquared(z.mesh.position, _targetPos);
        const heightDiff = Math.abs(z.mesh.position.y - _targetPos.y);

        if (z.hellhoundState === HellhoundState.CHASING) {
            if (distToTargetSq <= hc.ATTACK_INITIATE_RANGE * hc.ATTACK_INITIATE_RANGE && heightDiff < ctx.configManager.combat.ATTACK_HEIGHT_THRESHOLD) {

                z.hellhoundState = HellhoundState.ATTACK_WINDUP;
                z.stateTimer = hc.ATTACK_WINDUP_MIN + Math.random() * (hc.ATTACK_WINDUP_MAX - hc.ATTACK_WINDUP_MIN);
            } else {
                const moveDir = computeNavPath(z, _targetPos, dt, ctx);
                if (moveDir) {
                    moveDir.y = 0;
                    applyRotationSmoothing(z, moveDir, frameFactor);
                    _tempBlended.copyFrom(moveDir);
                    _tempBlended.addInPlaceFromFloats(
                        separation.x * sc.ZOMBIE_SEPARATION_FORCE,
                        separation.y * sc.ZOMBIE_SEPARATION_FORCE,
                        separation.z * sc.ZOMBIE_SEPARATION_FORCE
                    );
                    _tempBlended.normalize();
                    _tempMoveResult.copyFrom(_tempBlended);
                    _tempMoveResult.scaleInPlace(z.speed * frameFactor);
                }
            }
        } else if (z.hellhoundState === HellhoundState.ATTACK_WINDUP) {
            if (z.stateTimer !== undefined && z.stateTimer <= 0) {
                z.hellhoundState = HellhoundState.ATTACKING;
                z.stateTimer = hc.ATTACK_DURATION_MIN + Math.random() * (hc.ATTACK_DURATION_MAX - hc.ATTACK_DURATION_MIN);
                z.lungeStartPos = z.mesh.position.clone();
                z.lungeTargetPos = _targetPos.clone();
                z.lungeTargetPos.subtractToRef(z.lungeStartPos, _tempLungeDir);
                _tempLungeDir.normalize();
                _tempLungeDir.y = 0;
                const yaw = Math.atan2(_tempLungeDir.x, _tempLungeDir.z);
                if (!z.mesh.rotationQuaternion) {
                    z.mesh.rotationQuaternion = new BABYLON.Quaternion();
                }
                BABYLON.Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, z.mesh.rotationQuaternion);
            }
        } else if (z.hellhoundState === HellhoundState.ATTACKING) {
            if (z.stateTimer !== undefined && z.stateTimer <= 0) {
                z.hellhoundState = HellhoundState.RECOVERY;
                z.stateTimer = hc.RECOVERY_MIN + Math.random() * (hc.RECOVERY_MAX - hc.RECOVERY_MIN);
            } else if (z.lungeTargetPos && z.lungeStartPos) {
                z.lungeTargetPos.subtractToRef(z.lungeStartPos, _tempLungeDir);
                _tempLungeDir.normalize();
                _tempLungeDir.y = 0;
                _tempMoveResult.copyFrom(_tempLungeDir);
                _tempMoveResult.scaleInPlace(z.speed * hc.LUNGE_SPEED_MULTIPLIER * frameFactor);
                
                const distFromStartSq = BABYLON.Vector3.DistanceSquared(z.mesh.position, z.lungeStartPos);
                const distToPlayerSq = BABYLON.Vector3.DistanceSquared(z.mesh.position, _targetPos);
                if (distFromStartSq >= hc.LUNGE_DISTANCE * hc.LUNGE_DISTANCE || distToPlayerSq <= 2.25) {

                    z.hellhoundState = HellhoundState.RECOVERY;
                    z.stateTimer = hc.RECOVERY_MIN + Math.random() * (hc.RECOVERY_MAX - hc.RECOVERY_MIN);
                }
            }
        } else if (z.hellhoundState === HellhoundState.RECOVERY) {
            if (z.lungeStartPos) {
                z.lungeStartPos.subtractToRef(z.mesh.position, _tempRetreatDir);
                _tempRetreatDir.y = 0;
                const distBack = _tempRetreatDir.length();
                if (distBack > 0.5) {
                    _tempRetreatDir.normalize();
                    _tempMoveResult.copyFrom(_tempRetreatDir);
                    _tempMoveResult.scaleInPlace(z.speed * frameFactor);
                } else {
                    z.hellhoundState = HellhoundState.CHASING;
                    z.lungeStartPos = undefined;
                    z.lungeTargetPos = undefined;
                }
            }
            if (z.stateTimer !== undefined && z.stateTimer <= 0) {
                z.hellhoundState = HellhoundState.CHASING;
                z.lungeStartPos = undefined;
                z.lungeTargetPos = undefined;
            }
        }

        _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;
        z.mesh.moveWithCollisions(_tempMoveResult);
    };

    /**
     * Updates zombie wander behavior when player is downed in solo.
     */
    const updateSoloDownedWander = (
        z: Zombie,
        dt: number,
        now: number,
        separation: BABYLON.Vector3,
        frameFactor: number
    ): void => {
        const zc = ctx.configManager.zombieAI;
        const sc = ctx.configManager.sync;
        const gc = ctx.configManager.gameplay;
        const camera = ctx.camera;

        if (!z.wander || now >= z.wander.nextUpdateTime) {
            z.mesh.position.subtractToRef(camera.position, _tempDirectDir);
            _tempDirectDir.y = 0;
            const baseAngle = _tempDirectDir.lengthSquared() > 0.001
                ? Math.atan2(_tempDirectDir.z, _tempDirectDir.x)
                : Math.random() * Math.PI * 2;

            const spread = (Math.random() - 0.5) * (Math.PI * 140 / 180);
            const newAngle = baseAngle + spread;
            const dist = zc.WANDER_DIST_MIN + Math.random() * (zc.WANDER_DIST_MAX - zc.WANDER_DIST_MIN);
            const nextTime = now + zc.WANDER_UPDATE_MIN + Math.random() * (zc.WANDER_UPDATE_MAX - zc.WANDER_UPDATE_MIN);
            const wx = z.mesh.position.x + Math.cos(newAngle) * dist;
            const wy = z.mesh.position.y;
            const wz = z.mesh.position.z + Math.sin(newAngle) * dist;

            if (z.wander) {
                // Reuse existing object and Vector3 — avoid allocation on wander refresh
                z.wander.angle = newAngle;
                z.wander.nextUpdateTime = nextTime;
                z.wander.wanderTarget.set(wx, wy, wz);
            } else {
                z.wander = {
                    angle: newAngle,
                    nextUpdateTime: nextTime,
                    wanderTarget: new BABYLON.Vector3(wx, wy, wz),
                };
            }
        }

        const distToTargetSq = getHorizontalDistSq(z.mesh.position, z.wander.wanderTarget);
        if (distToTargetSq < zc.WANDER_TARGET_THRESHOLD * zc.WANDER_TARGET_THRESHOLD) {

            z.wander = undefined;
            return;
        }

        const ws = z.wander;
        ws.wanderTarget.subtractToRef(z.mesh.position, _tempDirectDir);
        _tempDirectDir.y = 0;
        if (_tempDirectDir.lengthSquared() > 0.001) {
            _tempDirectDir.normalize();
        } else {
            _tempDirectDir.set(Math.cos(ws.angle), 0, Math.sin(ws.angle));
        }
        const moveDir = _tempDirectDir;

        _tempBlended.copyFrom(moveDir);
        _tempBlended.addInPlaceFromFloats(
            separation.x * sc.ZOMBIE_SEPARATION_FORCE,
            separation.y * sc.ZOMBIE_SEPARATION_FORCE,
            separation.z * sc.ZOMBIE_SEPARATION_FORCE
        );
        _tempBlended.normalize();
        applyRotationSmoothing(z, _tempBlended, frameFactor);
        _tempMoveResult.copyFrom(_tempBlended);
        _tempMoveResult.scaleInPlace(z.speed * frameFactor);
        _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;
        z.mesh.moveWithCollisions(_tempMoveResult);
    };

    /**
     * Updates zombie chase behavior.
     */
    const updateZombieChase = (
        z: Zombie,
        dt: number,
        separation: BABYLON.Vector3,
        frameFactor: number
    ): void => {
        const sc = ctx.configManager.sync;
        const zc = ctx.configManager.zombieAI;

        _targetPos.copyFrom(ctx.camera.position);

        if (ctx.gameModeRef.current === 'HOST' && ctx.connectionStatusRef.current === 'CONNECTED') {
            const isLocalDown = ctx.gameState.health <= 0 || ctx.gameState.isDowned;
            const isRemoteDown = ctx.remote.gameState.health <= 0 || ctx.remote.gameState.isDowned;

            if (ctx.remote.pos && !isRemoteDown) {
                const distToLocalSq = BABYLON.Vector3.DistanceSquared(z.mesh.position, ctx.camera.position);
                const distToRemoteSq = BABYLON.Vector3.DistanceSquared(z.mesh.position, ctx.remote.pos);
                if (isLocalDown || distToRemoteSq < distToLocalSq) {
                    _targetPos.copyFrom(ctx.remote.pos);
                }

            }
        }

        const moveDir = computeNavPath(z, _targetPos, dt, ctx);

        if (moveDir) {
            moveDir.y = 0;
            applyRotationSmoothing(z, moveDir, frameFactor);

            const distHorizontalSq = getHorizontalDistSq(z.mesh.position, _targetPos);
            const heightDiff = Math.abs(z.mesh.position.y - _targetPos.y);

            if (distHorizontalSq > (zc.ATTACK_RANGE * 0.9) * (zc.ATTACK_RANGE * 0.9) || heightDiff > ctx.configManager.combat.ATTACK_HEIGHT_THRESHOLD) {

                _tempBlended.copyFrom(moveDir);
                _tempBlended.addInPlaceFromFloats(
                    separation.x * sc.ZOMBIE_SEPARATION_FORCE,
                    separation.y * sc.ZOMBIE_SEPARATION_FORCE,
                    separation.z * sc.ZOMBIE_SEPARATION_FORCE
                );
                _tempBlended.normalize();
                _tempMoveResult.copyFrom(_tempBlended);
                _tempMoveResult.scaleInPlace(z.speed * frameFactor);
            }
        }
    };

    /**
     * Updates zombie window/barrier interaction states.
     */
    const updateWindowInteraction = (
        z: Zombie,
        dt: number,
        now: number,
        separation: BABYLON.Vector3,
        frameFactor: number
    ): void => {
        const zc = ctx.configManager.zombieAI;
        const sc = ctx.configManager.sync;

        const targetWindow = z.targetWindowId ? windowMap.get(z.targetWindowId) ?? null : null;
        if (!targetWindow) {
            z.state = ZombieState.CHASING;
            return;
        }

        if (z.state === ZombieState.APPROACHING_WINDOW) {
            _tempLookAt.set(targetWindow.attackPoint.x, z.mesh.position.y, targetWindow.attackPoint.z);
            z.mesh.lookAt(_tempLookAt);

            targetWindow.attackPoint.subtractToRef(z.mesh.position, _tempDirectDir);
            _tempDirectDir.normalize();
            _tempDirectDir.y = 0;
            const distSq = getHorizontalDistSq(z.mesh.position, targetWindow.attackPoint);
            const sepFactor = distSq < 12.25 ? 0.1 : 1.0;
            const sepForce = sc.ZOMBIE_SEPARATION_FORCE * sepFactor;
            _tempBlended.copyFrom(_tempDirectDir);
            _tempBlended.addInPlaceFromFloats(
                separation.x * sepForce,
                separation.y * sepForce,
                separation.z * sepForce
            );
            _tempBlended.normalize();
            _tempMoveResult.copyFrom(_tempBlended);
            _tempMoveResult.scaleInPlace(z.speed * frameFactor);

            if (distSq < 4.0) {
                z.state = ZombieState.ATTACKING_BARRIER;
            } else if (distSq < 25.0) {
                if (!z.lastPosition) { z.lastPosition = new BABYLON.Vector3(); z.lastPosition.copyFrom(z.mesh.position); }
                if (!z.stuckTimer) z.stuckTimer = 0;
                z.stuckTimer += dt;
                if (z.stuckTimer > 0.5) {
                    const moveDistSq = BABYLON.Vector3.DistanceSquared(z.mesh.position, z.lastPosition);
                    if (moveDistSq < 0.01) z.state = ZombieState.ATTACKING_BARRIER;
                    z.lastPosition.copyFrom(z.mesh.position);
                    z.stuckTimer = 0;
                }
            }
        } else if (z.state === ZombieState.ATTACKING_BARRIER) {
            const activeBoards = targetWindow.boards.filter(b => b.isEnabled());
            if (activeBoards.length > 0) {
                z.barrierAttackTimer += dt;
                if (z.barrierAttackTimer > zc.BARRIER_ATTACK_INTERVAL) {
                    z.barrierAttackTimer = 0;
                    const b = activeBoards[Math.floor(Math.random() * activeBoards.length)];
                    b.setEnabled(false);
                    ctx.eventBus.emit('BOARD_STATE_CHANGE', { windowId: targetWindow.id });
                    ctx.visualManager.createWoodDebris(b.position);
                }
                z.mesh.rotation.z = Math.sin(now * 0.01) * 0.15;
            } else {
                z.state = ZombieState.ENTERING;
            }
        } else if (z.state === ZombieState.ENTERING) {

            _tempLookAt.set(targetWindow.entryPoint.x, z.mesh.position.y, targetWindow.entryPoint.z);
            z.mesh.lookAt(_tempLookAt);
            targetWindow.entryPoint.subtractToRef(z.mesh.position, _tempDirectDir);
            _tempDirectDir.normalize();
            _tempMoveResult.copyFrom(_tempDirectDir);
            _tempMoveResult.scaleInPlace(z.speed * frameFactor);
            z.mesh.position.addInPlace(_tempMoveResult);
            if (getHorizontalDistSq(z.mesh.position, targetWindow.entryPoint) < 0.25) {
                z.state = ZombieState.CHASING;
            }

        }
    };

    return {
        name: 'zombieAI',
        dispose: () => {
        },
        update: (dt: number, now: number) => {

            if (ctx.gameState.isDebugMode) return;
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            if (!isAuthority) return;

            const scene = ctx.scene;
            const camera = ctx.camera;
            const zoneSystem = ctx.zoneSystem;
            if (!scene || !camera || !zoneSystem) return;

            const currentGameMode = ctx.gameModeRef.current;
            const zombies = ctx.zombies;
            const frameFactor = dt * 60;
            const sc = ctx.configManager.sync;
            const gc = ctx.configManager.gameplay;

            // Build spatial grid once — O(n); each zombie then does O(k) neighbour check
            buildSeparationGrid(zombies);
            // Sync window map if new windows were registered since last frame
            ensureWindowMap();

            for (const z of zombies) {
                if (z.isDead) continue;

                _tempMoveResult.set(0, 0, 0);

                // Burning damage
                if (updateBurningDamage(z, now, ctx)) continue;

                // Compute separation force (grid-accelerated)
                const separation = computeSeparationForce(z, sc.ZOMBIE_SEPARATION_DIST);

                // Hellhound AI
                if (z.type === 'HELLHOUND') {
                    updateHellhoundAI(z, dt, separation, frameFactor);
                    continue;
                }

                // Solo downed wander
                if (currentGameMode === 'SOLO' && ctx.gameState.isDowned) {
                    updateSoloDownedWander(z, dt, now, separation, frameFactor);
                    continue;
                }

                if (z.wander) z.wander = undefined;

                // Zombie chase or window interaction
                if (z.state === ZombieState.CHASING) {
                    updateZombieChase(z, dt, separation, frameFactor);
                } else if (z.type === 'ZOMBIE') {
                    updateWindowInteraction(z, dt, now, separation, frameFactor);
                }

                // Apply gravity (except when entering window)
                if (z.state !== ZombieState.ENTERING) {
                    _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;
                    z.mesh.moveWithCollisions(_tempMoveResult);
                    if (z.mesh.position.y > 0 && z.mesh.position.y < 0.15) z.mesh.position.y = 0;
                }
            }
        }
    };
};
