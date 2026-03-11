import * as BABYLON from '@babylonjs/core';
import { ZombieState, GameStateData, WindowBarrier } from '../../types/index';
import { System } from '../../types/systems';
import { Zombie } from '../../types/entities';
import { EventBus } from '../../engine/EventBus';
import { VisualManager } from '../../managers/VisualManager';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { getHorizontalDistSq } from '../../engine/GeometryUtils';
import { _tempMoveResult, _tempLookAt, _tempDirectDir } from './zombieAIUtils';

export interface IWindowAIContext {
    gameState: GameStateData;
    gameModeRef: { current: string };
    zombies: Zombie[];
    windows: WindowBarrier[];
    configManager: MapConfigManager;
    eventBus: EventBus;
    visualManager: VisualManager;
}

/**
 * ZombieWindowAISystem
 *
 * Authority only (HOST or SOLO).
 * Responsibility: 3-state window barrier sub-machine —
 * APPROACHING_WINDOW → ATTACKING_BARRIER → ENTERING → (transitions to CHASING).
 * Window-state zombies never use the Recast Crowd; crowd removal is
 * handled centrally by ZombieAISystem.
 */
export const createZombieWindowAISystem = (ctx: IWindowAIContext): System => {
    // ── O(1) window lookup ────────────────────────────────────────────────────
    // windows.find() was called every frame per zombie. A Map keyed by window ID
    // reduces that from O(n×windows) to O(n) per frame.
    // Rebuilt lazily whenever ctx.windows grows (windows are registered after
    // the system is created, so we can't build the map once at factory time).
    const windowMap = new Map<string, WindowBarrier>();
    let windowMapSnapshot: WindowBarrier | null = null;

    const rebuildWindowMap = () => {
        windowMap.clear();
        for (const w of ctx.windows) {
            windowMap.set(w.id, w);
        }
        windowMapSnapshot = ctx.windows.length > 0 ? ctx.windows[0] : null;
    };

    const ensureWindowMap = () => {
        if (windowMap.size !== ctx.windows.length) { rebuildWindowMap(); return; }
        if (ctx.windows.length > 0 && windowMapSnapshot !== ctx.windows[0]) { rebuildWindowMap(); return; }
    };

    const updateWindowInteraction = (
        z: Zombie,
        dt: number,
        now: number,
        frameFactor: number
    ): void => {
        const zc = ctx.configManager.zombieAI;

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
            _tempMoveResult.copyFrom(_tempDirectDir);
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
        name: 'zombieWindowAI',
        update: (dt: number, now: number) => {
            if (ctx.gameState.isDebugMode || ctx.gameState.isPaused) return;
            const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
            if (!isAuthority) return;

            const gc = ctx.configManager.gameplay;
            const frameFactor = dt * 60;

            ensureWindowMap();

            for (const z of ctx.zombies) {
                if (z.isDead) continue;
                if (z.type !== 'ZOMBIE') continue;
                if (z.state !== ZombieState.APPROACHING_WINDOW &&
                    z.state !== ZombieState.ATTACKING_BARRIER &&
                    z.state !== ZombieState.ENTERING) continue;

                _tempMoveResult.set(0, 0, 0);

                // Snapshot state before update to know which movement path ran
                const stateBeforeUpdate = z.state;
                updateWindowInteraction(z, dt, now, frameFactor);

                // ENTERING moves the zombie directly via addInPlace and skips gravity.
                // APPROACHING_WINDOW and ATTACKING_BARRIER accumulate into _tempMoveResult
                // and need gravity + moveWithCollisions applied here.
                if (stateBeforeUpdate !== ZombieState.ENTERING) {
                    _tempMoveResult.y += gc.GRAVITY * 3 * frameFactor;
                    z.mesh.moveWithCollisions(_tempMoveResult);
                    if (z.mesh.position.y > 0 && z.mesh.position.y < 0.15) z.mesh.position.y = 0;
                }
            }
        }
    };
};
