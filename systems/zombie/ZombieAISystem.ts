import * as BABYLON from '@babylonjs/core';
import { ZombieState, GameStateData, RemoteGameState } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { ZombieManager } from '../../managers/ZombieManager';
import { HellhoundManager } from '../../managers/HellhoundManager';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { getHorizontalDistSq } from '../../engine/GeometryUtils';
import {
    _tempMoveResult, _tempDirectDir,
    updateBurningDamage, computeNavPath, applyRotationSmoothing,
} from './zombieAIUtils';

export interface IZombieAIContext {
    gameState: GameStateData;
    scene: BABYLON.Scene;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    configManager: MapConfigManager;
    zombies: Zombie[];
    navPlugin?: BABYLON.RecastJSPlugin;
    remote: {
        pos: BABYLON.Vector3;
        gameState: RemoteGameState;
    };
    connectionStatusRef: { current: string };
    zombieManager: ZombieManager;
    hellhoundManager: HellhoundManager;
    /** Shared ref so ZombieCleanupSystem can remove crowd agents on despawn */
    crowdRef: { current?: BABYLON.ICrowd };
    getIsPathfindingActive: () => boolean;
}

// ── Recast Crowd configuration ────────────────────────────────────────────────
// One crowd manages all chasing zombies. A single crowd.update(dt) call per
// frame replaces N individual computePath + moveWithCollisions calls, batching
// agent movement inside the Recast WASM module.
const MAX_CROWD_AGENTS = 64;
const CROWD_AGENT_RADIUS = 0.4;
const TARGET_UPDATE_INTERVAL = 0.25; // How often crowd agents receive a new goto target

const _BASE_AGENT_PARAMS: BABYLON.IAgentParameters = {
    radius: CROWD_AGENT_RADIUS,
    height: 1.8,
    maxAcceleration: 8.0,
    maxSpeed: 2.1,
    collisionQueryRange: 0.5,
    pathOptimizationRange: 0.0,
    separationWeight: 1.0,
};

/**
 * ZombieAISystem
 *
 * Authority only (HOST or SOLO).
 * Responsibility: Recast Crowd lifecycle, CHASING zombie movement (crowd path
 * or navmesh fallback), and solo-downed wander. Hellhounds, window-state
 * zombies, and spawn-state zombies are handled by their dedicated systems.
 */
export const createZombieAISystem = (ctx: IZombieAIContext): System => {
    const _targetPos = new BABYLON.Vector3();
    const _crowdVelocity = new BABYLON.Vector3();

    let crowd: BABYLON.ICrowd | undefined;
    let crowdMapGeneration = -1;
    let lastCrowdLogTime = 0;

    // Keep the shared ref in sync so ZombieCleanupSystem can remove agents
    const syncCrowdRef = () => { ctx.crowdRef.current = crowd; };

    const addZombieToCrowd = (z: Zombie): void => {
        if (!crowd || z.crowdAgentIndex !== undefined) return;
        const params: BABYLON.IAgentParameters = {
            ..._BASE_AGENT_PARAMS,
            maxSpeed: z.speed * 60,
            maxAcceleration: (z.speed * 60) * 10, // Snappy start/stop
        };
        if (ctx.getIsPathfindingActive()) {
            console.log(`[ZombieAI] Adding ${z.id} to crowd. Pos:`, z.mesh.position.asArray());
        }
        z.crowdAgentIndex = crowd.addAgent(z.mesh.position, params, z.mesh as BABYLON.TransformNode);
        crowd.agentGoto(z.crowdAgentIndex, z.mesh.position);
        if (ctx.getIsPathfindingActive()) {
            console.log(`[ZombieAI] Added ${z.id} to crowd as agent ${z.crowdAgentIndex} at ${z.mesh.position.y.toFixed(2)}m`);
        }
    };

    const removeZombieFromCrowd = (z: Zombie): void => {
        if (!crowd || z.crowdAgentIndex === undefined) return;
        crowd.removeAgent(z.crowdAgentIndex);
        z.crowdAgentIndex = undefined;
    };

    /**
     * SOLO downed wander — zombies wander away from the player when they are
     * downed in solo mode. Handles its own gravity + moveWithCollisions.
     */
    const updateSoloDownedWander = (
        z: Zombie,
        dt: number,
        now: number,
        frameFactor: number
    ): void => {
        const zc = ctx.configManager.zombieAI;
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

        applyRotationSmoothing(z, moveDir, frameFactor);
        _tempMoveResult.copyFrom(moveDir);
        _tempMoveResult.scaleInPlace(z.speed * frameFactor);
        _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;
        z.mesh.moveWithCollisions(_tempMoveResult);
    };

    /**
     * Zombie chase — crowd path (fast) or navmesh fallback.
     *
     * Crowd path: crowd.update(dt) already ran this frame (via scene observable)
     * and wrote the new mesh position. We only refresh the goto target and
     * derive rotation from agent velocity.
     *
     * Fallback: computeNavPath + moveWithCollisions (called from the main loop
     * after this function returns, together with gravity).
     */
    const updateZombieChase = (
        z: Zombie,
        dt: number,
        now: number,
        frameFactor: number
    ): void => {
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

        // ── Crowd path (fast) ─────────────────────────────────────────────────
        if (crowd && z.crowdAgentIndex !== undefined) {
            if (z.lastPathLogTime === undefined || now - z.lastPathLogTime > 10000) {
                if (ctx.getIsPathfindingActive()) {
                    console.log(`[ZombieAI] ${z.type} ${z.id}: Using Recast Crowd`);
                }
                z.lastPathLogTime = now;
            }
            if (z.pathUpdateTimer === undefined) z.pathUpdateTimer = 0;
            z.pathUpdateTimer -= dt;

            // Check if within attack range
            const distHorizontalSq = getHorizontalDistSq(z.mesh.position, _targetPos);
            const heightDiff = Math.abs(z.mesh.position.y - _targetPos.y);
            const inAttackRange = distHorizontalSq <= (zc.ATTACK_RANGE * 0.9) * (zc.ATTACK_RANGE * 0.9) && 
                                  heightDiff <= ctx.configManager.combat.ATTACK_HEIGHT_THRESHOLD;

            if (inAttackRange) {
                if (!z.wasInAttackRange) {
                    z.wasInAttackRange = true;
                    // Stop agent by setting speed to 0 and stopping current goto
                    const params: BABYLON.IAgentParameters = {
                        ..._BASE_AGENT_PARAMS,
                        maxSpeed: 0,
                        maxAcceleration: 1000, // Decelerate instantly
                    };
                    crowd.updateAgentParameters(z.crowdAgentIndex, params);
                    
                    _tempDirectDir.copyFrom(z.mesh.position);
                    _tempDirectDir.y = 0;
                    crowd.agentGoto(z.crowdAgentIndex, _tempDirectDir);
                }
            } else {
                if (z.wasInAttackRange) {
                    z.wasInAttackRange = false;
                    z.pathUpdateTimer = 0; // Force immediate path update this frame
                    // Restore original speed and snappy acceleration
                    const params: BABYLON.IAgentParameters = {
                        ..._BASE_AGENT_PARAMS,
                        maxSpeed: z.speed * 60,
                        maxAcceleration: (z.speed * 60) * 10,
                    };
                    crowd.updateAgentParameters(z.crowdAgentIndex, params);
                }

                if (z.pathUpdateTimer <= 0) {
                    _targetPos.y = 0;
                    crowd.agentGoto(z.crowdAgentIndex, _targetPos);
                    z.pathUpdateTimer = TARGET_UPDATE_INTERVAL + (Math.random() * 0.05);
                }
            }

            crowd.getAgentVelocityToRef(z.crowdAgentIndex, _crowdVelocity);
            _crowdVelocity.y = 0;
            if (_crowdVelocity.lengthSquared() > 0.01) {
                applyRotationSmoothing(z, _crowdVelocity, frameFactor);
            } else if (inAttackRange) {
                // Agent has stopped to attack, manually rotate toward target
                _targetPos.subtractToRef(z.mesh.position, _tempDirectDir);
                _tempDirectDir.y = 0;
                applyRotationSmoothing(z, _tempDirectDir, frameFactor);
            }
            return;
        }

        // ── Fallback: computeNavPath + moveWithCollisions (applied by caller) ─
        if (z.lastPathLogTime === undefined || now - z.lastPathLogTime > 10000) {
            if (ctx.getIsPathfindingActive()) {
                console.log(`[ZombieAI] ${z.type} ${z.id}: Using computeNavPath (Fallback)`);
            }
            z.lastPathLogTime = now;
        }
        const moveDir = computeNavPath(z, _targetPos, dt, ctx);
        if (moveDir) {
            moveDir.y = 0;
            applyRotationSmoothing(z, moveDir, frameFactor);

            const distHorizontalSq = getHorizontalDistSq(z.mesh.position, _targetPos);
            const heightDiff = Math.abs(z.mesh.position.y - _targetPos.y);

            if (distHorizontalSq > (zc.ATTACK_RANGE * 0.9) * (zc.ATTACK_RANGE * 0.9) || heightDiff > ctx.configManager.combat.ATTACK_HEIGHT_THRESHOLD) {
                _tempMoveResult.copyFrom(moveDir);
                _tempMoveResult.scaleInPlace(z.speed * frameFactor);
            }
        }
    };

    return {
        name: 'zombieAI',
        dispose: () => {
            if (crowd) {
                for (const z of ctx.zombies) {
                    if (z.crowdAgentIndex !== undefined) {
                        try { crowd.removeAgent(z.crowdAgentIndex); } catch (_) { }
                        z.crowdAgentIndex = undefined;
                    }
                }
                crowd.dispose();
                crowd = undefined;
                syncCrowdRef();
            }
        },
        update: (dt: number, now: number) => {
            if (ctx.gameState.isDebugMode || ctx.gameState.isPaused) return;
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            if (!isAuthority) return;

            const scene = ctx.scene;
            const camera = ctx.camera;
            if (!scene || !camera) return;

            const currentGameMode = ctx.gameModeRef.current;
            const zombies = ctx.zombies;
            const frameFactor = dt * 60;
            const gc = ctx.configManager.gameplay;

            // ── Crowd init / reload ───────────────────────────────────────────
            // Must run before the zombie loop so crowd positions are ready when
            // we read velocity for rotation smoothing.
            // On map reload the navmesh is rebuilt but the old crowd still
            // references the destroyed navmesh — dispose and recreate it.
            const gen = ctx.gameState.mapLoadGeneration;
            if (crowd && gen !== crowdMapGeneration) {
                for (const z of zombies) {
                    if (z.crowdAgentIndex !== undefined) {
                        try { crowd.removeAgent(z.crowdAgentIndex); } catch (_) { }
                        z.crowdAgentIndex = undefined;
                    }
                }
                crowd.dispose();
                crowd = undefined;
                syncCrowdRef();
            }
            if (!crowd && ctx.navPlugin) {
                try {
                    crowd = ctx.navPlugin.createCrowd(MAX_CROWD_AGENTS, CROWD_AGENT_RADIUS, ctx.scene);
                    crowdMapGeneration = gen;
                    syncCrowdRef();
                    if (ctx.getIsPathfindingActive()) {
                        console.log('[ZombieAI] Recast Crowd initialised (max agents:', MAX_CROWD_AGENTS, ')');
                    }
                } catch (e) {
                    // Navmesh not ready yet — will retry next frame
                }
            }

            if (crowd && now - lastCrowdLogTime > 5000) {
                const activeAgents = zombies.filter(z => z.crowdAgentIndex !== undefined).length;
                if (ctx.getIsPathfindingActive()) {
                    console.log(`[ZombieAI] Recast Crowd active: ${activeAgents} agents updating.`);
                }
                lastCrowdLogTime = now;
            }

            for (const z of zombies) {
                // Dead: remove from crowd and skip
                if (z.isDead) {
                    if (z.crowdAgentIndex !== undefined) removeZombieFromCrowd(z);
                    continue;
                }

                // Hellhounds handled by ZombieHellhoundAISystem
                if (z.type === 'HELLHOUND') continue;

                // Spawn states handled by ZombieSpawnSystem (runs before this system)
                if (z.state === ZombieState.SPAWNING || z.state === ZombieState.BREAKING_LID) continue;

                _tempMoveResult.set(0, 0, 0);

                // Burning damage
                if (updateBurningDamage(z, now, ctx)) {
                    removeZombieFromCrowd(z);
                    continue;
                }

                // Window states handled by ZombieWindowAISystem; keep them out of the crowd
                if (z.state === ZombieState.APPROACHING_WINDOW ||
                    z.state === ZombieState.ATTACKING_BARRIER ||
                    z.state === ZombieState.ENTERING) {
                    if (z.crowdAgentIndex !== undefined) removeZombieFromCrowd(z);
                    continue;
                }

                // Solo downed wander (handles own movement + gravity)
                if (currentGameMode === 'SOLO' && ctx.gameState.isDowned) {
                    if (z.crowdAgentIndex !== undefined) removeZombieFromCrowd(z);
                    updateSoloDownedWander(z, dt, now, frameFactor);
                    continue;
                }

                if (z.wander) z.wander = undefined;

                // Ensure CHASING zombies have a crowd agent.
                // Covers: fresh spawns (ZombieSpawnSystem just set CHASING) and
                // zombies that entered via ENTERING → CHASING.
                if (z.state === ZombieState.CHASING && crowd && z.crowdAgentIndex === undefined) {
                    addZombieToCrowd(z);
                }

                if (z.state === ZombieState.CHASING) {
                    updateZombieChase(z, dt, now, frameFactor);
                }

                // Apply gravity for fallback-path zombies (crowd agents skip this)
                if (z.crowdAgentIndex === undefined) {
                    _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;
                    z.mesh.moveWithCollisions(_tempMoveResult);
                    if (z.mesh.position.y > 0 && z.mesh.position.y < 0.15) z.mesh.position.y = 0;
                }
            }
        }
    };
};
