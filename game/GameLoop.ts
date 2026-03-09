
import * as BABYLON from '@babylonjs/core';
import { StateManager } from '../state/StateManager';
import { GAME_CONFIG } from '../config';
import { InputManager, GameAction } from '../engine/InputManager';
import { SystemManager } from '../engine/SystemManager';
import { useGameStore } from '../store/useGameStore';

interface Ref<T> { current: T; }

export interface GameLoopDeps {
    stateManager: StateManager;
    systemManager: SystemManager;
    cameraRef: Ref<BABYLON.UniversalCamera | null>;
    gameModeRef: Ref<string>;
    pollGamepad: (dt: number) => void;
    inputManager: InputManager;
}

/**
 * createGameLoop
 *
 * Returns the per-frame callback wired into Babylon's `runRenderLoop`.
 * Executed once per rendered frame with `dt` in seconds.
 *
 * Order of operations each frame:
 *   1. Guard: skip if paused.
 *   2. Update InputManager (snapshot previous state, poll gamepad).
 *   3. Multiplayer spectator game-over check.
 *   4. When the game has started: advance TimerManager, MysteryBoxSystem,
 *      VisualManager lighting, and zombie-count HUD updates (HOST/SOLO only).
 *   5. Run all registered ECS systems via SystemManager.
 *   6. Health regeneration (outside systems to run after damage this frame).
 */
export const createGameLoop = (deps: GameLoopDeps) => {
    let frameCount = 0;
    const { stateManager: sm, systemManager, gameModeRef, inputManager } = deps;

    // ── Scale Weapon scroll handler ──────────────────────────────────────
    const onWheel = (e: WheelEvent) => {
        const mode = sm.scaleWeaponMode;
        if (!mode.isActive) return;

        e.preventDefault();
        e.stopPropagation();

        const dir = e.deltaY < 0 ? 1 : -1;
        const delta = dir * mode.step * 10;

        if (mode.axis === 'all') {
            mode.scale.x = Math.max(0.001, +(mode.scale.x + delta).toFixed(4));
            mode.scale.y = Math.max(0.001, +(mode.scale.y + delta).toFixed(4));
            mode.scale.z = Math.max(0.001, +(mode.scale.z + delta).toFixed(4));
        } else {
            mode.scale[mode.axis] = Math.max(0.001, +(mode.scale[mode.axis] + delta).toFixed(4));
        }

        // Apply to mesh
        const mesh = sm.gameState.weaponMeshes[mode.weaponId];
        if (mesh) {
            mesh.scaling.set(mode.scale.x, mode.scale.y, mode.scale.z);
        }

        // Push to UI
        sm.ui.setScaleWeaponMode({
            weaponId: mode.weaponId,
            scale: { ...mode.scale },
            step: mode.step,
            axis: mode.axis,
        });
    };

    // Keyboard shortcuts for scale weapon tool (axis toggle, step size, ESC exit)
    const onScaleKeyDown = (e: KeyboardEvent) => {
        const mode = sm.scaleWeaponMode;
        if (!mode.isActive) return;

        let handled = true;
        switch (e.code) {
            case 'KeyX':
                mode.axis = mode.axis === 'x' ? 'all' : 'x';
                break;
            case 'KeyY':
                mode.axis = mode.axis === 'y' ? 'all' : 'y';
                break;
            case 'KeyZ':
                mode.axis = mode.axis === 'z' ? 'all' : 'z';
                break;
            case 'BracketRight': // ] = increase step
                mode.step = Math.min(1, +(mode.step * 10).toFixed(4));
                break;
            case 'BracketLeft': // [ = decrease step
                mode.step = Math.max(0.001, +(mode.step / 10).toFixed(4));
                break;
            case 'Escape':
                const mesh = sm.gameState.weaponMeshes[mode.weaponId];
                if (mesh && mode.originalScale) {
                    mesh.scaling.set(mode.originalScale.x, mode.originalScale.y, mode.originalScale.z);
                }
                mode.isActive = false;
                sm.ui.setScaleWeaponMode(null);
                return; // let ESC propagate for pause
            default:
                handled = false;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
            sm.ui.setScaleWeaponMode({
                weaponId: mode.weaponId,
                scale: { ...mode.scale },
                step: mode.step,
                axis: mode.axis,
            });
        }
    };

    // Attach listeners to canvas (capture phase to intercept before Babylon)
    const canvas = sm.scene.getEngine().getRenderingCanvas();
    if (canvas) {
        canvas.addEventListener('wheel', onWheel, { passive: false, capture: true });
        window.addEventListener('keydown', onScaleKeyDown, { capture: true });
    }

    const dispose = () => {
        if (canvas) {
            canvas.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', onScaleKeyDown);
        }
    };

    return {
        loop: (dt: number) => {
            const currentGameMode = gameModeRef.current;
            const now = Date.now();
            frameCount++;

            // Sync settings to InputManager (throttled - settings don't change often)
            if (frameCount % 30 === 0) { // ~2x per second at 60fps
                inputManager.updateSettings(useGameStore.getState().settings);
            }

            inputManager.update();

            // ── Debug Controls Update ────────────────────────────────────────────
            // When debug_controls is active, update FPS counter and input debug data
            const debugMode = sm.debugControlsMode;
            if (debugMode.isActive) {
                // Sync debug mode to input manager
                inputManager.setDebugControlsActive(true);

                // FPS calculation
                debugMode.frameCount++;
                const elapsed = now - debugMode.lastFpsUpdate;
                if (elapsed >= 500) { // Update FPS every 500ms for stability
                    debugMode.fps = (debugMode.frameCount / elapsed) * 1000;
                    debugMode.frameCount = 0;
                    debugMode.lastFpsUpdate = now;
                }

                // Get debug data from input manager
                const debugData = inputManager.getDebugControlsData();
                const cam = sm.camera;

                // Update UI with debug controls data
                sm.ui.setDebugControls({
                    isActive: true,
                    fps: debugMode.fps,
                    inputSource: debugData.inputSource,
                    cameraRotation: cam ? { x: cam.rotation.x, y: cam.rotation.y } : { x: 0, y: 0 },
                    rawMouseDelta: debugData.rawMouseDelta,
                    rawControllerLook: debugData.rawControllerLook,
                });

                // Debug input logging removed to prevent frame hitches
            } else {
                inputManager.setDebugControlsActive(false);
            }

            // Console Toggle (Works even when paused)
            if (inputManager.justPressed(GameAction.TOGGLE_CONSOLE)) {
                sm.isConsoleOpen = !sm.isConsoleOpen;
                sm.ui.setIsConsoleOpen(sm.isConsoleOpen);

                if (sm.isConsoleOpen) {
                    sm.isInternalPointerRelease = true;
                    if (document.pointerLockElement) document.exitPointerLock();
                    // Clear the flag after a short delay to ensure InputManager has seen it
                    setTimeout(() => { sm.isInternalPointerRelease = false; }, 100);
                } else {
                    if (!sm.gameState.isPaused && !sm.gameState.isGameOver) {
                        sm.scene.getEngine().getRenderingCanvas()?.requestPointerLock();
                    }
                }
            }

            // Update Developer Stats (Zone & Position)
            if (sm.gameState.hasStarted) {
                const cam = sm.camera;
                if (cam) {
                    const zone = sm.getZone(cam.position);
                    sm.ui.setPlayerStats(zone, {
                        x: cam.position.x,
                        y: cam.position.y,
                        z: cam.position.z,
                        rot: cam.rotation.y
                    });
                }
            }

            const isLogicFrozen = sm.gameState.isPaused || sm.isConsoleOpen || sm.debugSelection.isActive;
            sm.gameState.isDebugMode = isLogicFrozen;
            sm.ui.setIsDebugMode(isLogicFrozen);
            sm.ui.setIsDebugActive(sm.debugSelection.isActive);
            sm.gameState.isConsoleOpen = sm.isConsoleOpen;

            if (sm.gameState.isPaused || (sm.isConsoleOpen && !sm.debugSelection.isActive)) {
                return;
            }

            // In multiplayer spectator mode, end the game if the remote player also dies.
            if (sm.gameState.isSpectating && !sm.gameState.isGameOver && currentGameMode !== 'SOLO') {
                if (sm.remote.gameState.health <= 0) {
                    sm.setIsGameOver(true);
                    sm.eventBus.emit('GAME_OVER', null);
                }
            }

            if (sm.gameState.hasStarted) {
                sm.update(dt);

                if (sm.gameState.isSpectating && !sm.getIsSpectating()) {
                    sm.setIsSpectating(true);
                }

                sm.mysteryBoxSystem?.update(dt);

                // Zombie count HUD — throttled to every 30 frames, HOST/SOLO only
                // (CLIENT receives counts via the STATE delta from the host).
                if (frameCount % 30 === 0 && currentGameMode !== 'CLIENT') {
                    sm.setActiveZombiesCount(sm.zombies.length);
                    sm.setTotalRoundZombies(sm.gameState.totalZombiesInRound);
                }
            }

            systemManager.updateAll(dt, now);

            // Passive health regeneration: starts 3 s after last damage, ticks at 20 Hz.
            const maxHP = sm.gameState.maxHealth || GAME_CONFIG.PLAYER_BASE_HEALTH;
            if (sm.gameState.health < maxHP && sm.gameState.health > 0 && !sm.gameState.isGameOver) {
                if (now - sm.gameState.lastDamageTime > 3000) {
                    if (now - sm.gameState.lastRegenTime > 50) {
                        sm.gameState.health = Math.min(maxHP, sm.gameState.health + 5);
                        sm.gameState.lastRegenTime = now;
                        sm.setHealth(sm.gameState.health);
                    }
                }
            }
        },
        dispose
    };
};
