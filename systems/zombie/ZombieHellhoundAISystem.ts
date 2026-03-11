import * as BABYLON from '@babylonjs/core';
import { HellhoundState, GameStateData } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { ZombieManager } from '../../managers/ZombieManager';
import { HellhoundManager } from '../../managers/HellhoundManager';
import {
    _tempMoveResult, _tempLungeDir, _tempRetreatDir,
    updateBurningDamage, computeNavPath, applyRotationSmoothing, getTargetPosition,
} from './zombieAIUtils';

export interface IHellhoundAIContext {
    gameState: GameStateData;
    gameModeRef: { current: string };
    camera: BABYLON.UniversalCamera;
    remote: { pos: BABYLON.Vector3; gameState: { isDowned: boolean } };
    connectionStatusRef: { current: string };
    configManager: MapConfigManager;
    navPlugin?: BABYLON.RecastJSPlugin;
    zombies: Zombie[];
    hellhoundManager: HellhoundManager;
    zombieManager: ZombieManager;
}

/**
 * ZombieHellhoundAISystem
 *
 * Authority only (HOST or SOLO).
 * Responsibility: Full hellhound state machine — SPAWNING → CHASING → ATTACK_WINDUP
 * → ATTACKING (lunge) → RECOVERY. Hellhounds never use the Recast Crowd.
 */
export const createZombieHellhoundAISystem = (ctx: IHellhoundAIContext): System => {
    const _targetPos = new BABYLON.Vector3();

    const updateHellhoundAI = (z: Zombie, dt: number, frameFactor: number): void => {
        const hc = ctx.configManager.hellhound;
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
                    _tempMoveResult.copyFrom(moveDir);
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

    return {
        name: 'zombieHellhoundAI',
        update: (dt: number, now: number) => {
            if (ctx.gameState.isDebugMode || ctx.gameState.isPaused) return;
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            if (!isAuthority) return;

            const frameFactor = dt * 60;

            for (const z of ctx.zombies) {
                if (z.isDead) continue;
                if (z.type !== 'HELLHOUND') continue;

                _tempMoveResult.set(0, 0, 0);

                if (updateBurningDamage(z, now, ctx)) continue;

                updateHellhoundAI(z, dt, frameFactor);
            }
        }
    };
};
