
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
    const { stateManager: sm, systemManager, gameModeRef, inputManager } = deps;
    let lastSettingsSync = 0;
    let lastDevStatsUpdate = 0;
    let lastZombieCountUpdate = 0;
    let lastDrawCallCount = 0;
    let consoleToggleTimeout: ReturnType<typeof setTimeout> | null = null;

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

        // Apply to child model mesh (root TransformNode is always 1,1,1)
        const mesh = sm.gameState.weaponMeshes[mode.weaponId];
        if (mesh) {
            const modelMesh = mesh.getChildren()?.[0] ?? mesh;
            modelMesh.scaling.set(mode.scale.x, mode.scale.y, mode.scale.z);
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
                    const modelMesh = mesh.getChildren()?.[0] ?? mesh;
                    modelMesh.scaling.set(mode.originalScale.x, mode.originalScale.y, mode.originalScale.z);
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
        if (consoleToggleTimeout !== null) {
            clearTimeout(consoleToggleTimeout);
            consoleToggleTimeout = null;
        }
        if (canvas) {
            canvas.removeEventListener('wheel', onWheel, { capture: true });
            window.removeEventListener('keydown', onScaleKeyDown, { capture: true });
        }
    };

    return {
        loop: (dt: number) => {
            const currentGameMode = gameModeRef.current;
            const now = Date.now();

            // Sync settings to InputManager (throttled - settings don't change often)
            if (now - lastSettingsSync >= 500) {
                lastSettingsSync = now;
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

            // ── Render Stats Update ───────────────────────────────────────────
            if (sm.renderStatsMode.isActive) {
                const scene = sm.scene;
                const engine = scene.getEngine();

                let shadowGenCount = 0;
                let shadowMapSize = 0;
                const totalLights = scene.lights.length;
                let activeLights = 0;
                for (let i = 0; i < totalLights; i++) {
                    const light = scene.lights[i];
                    if (light.isEnabled()) {
                        activeLights++;
                        const sgs = light.getShadowGenerators();
                        if (sgs) {
                            sgs.forEach(sg => {
                                if (sg) {
                                    shadowGenCount++;
                                    const map = sg.getShadowMap();
                                    if (map) {
                                        const size = map.getRenderSize() as number;
                                        shadowMapSize = Math.max(shadowMapSize, size);
                                    }
                                }
                            });
                        }
                    }
                }

                let pbrCount = 0;
                for (let i = 0; i < scene.materials.length; i++) {
                    if (scene.materials[i] instanceof BABYLON.PBRMaterial) pbrCount++;
                }

                const activeMeshes = scene.getActiveMeshes().length;
                let totalVerts = 0;
                let totalFaces = 0;
                const meshList = scene.getActiveMeshes();
                for (let i = 0; i < meshList.length; i++) {
                    totalVerts += meshList.data[i].getTotalVertices();
                    totalFaces += meshList.data[i].getTotalIndices() / 3;
                }

                const currentDrawCalls = (engine as any)._drawCalls?.current ?? 0;
                const perFrameDrawCalls = currentDrawCalls - lastDrawCallCount;
                lastDrawCallCount = currentDrawCalls;

                sm.ui.setRenderStats({
                    isActive: true,
                    drawCalls: perFrameDrawCalls,
                    activeMeshes,
                    totalMeshes: scene.meshes.length,
                    totalVertices: totalVerts,
                    totalFaces: Math.round(totalFaces),
                    activeLights,
                    totalLights,
                    pbrMaterials: pbrCount,
                    totalMaterials: scene.materials.length,
                    shadowGenerators: shadowGenCount,
                    shadowMapSize,
                    textures: scene.textures.length,
                    particleSystems: scene.particleSystems.filter(ps => ps.isStarted()).length,
                });
            }

            // Console Toggle (Works even when paused)
            if (inputManager.justPressed(GameAction.TOGGLE_CONSOLE)) {
                sm.isConsoleOpen = !sm.isConsoleOpen;
                sm.ui.setIsConsoleOpen(sm.isConsoleOpen);

                if (sm.isConsoleOpen) {
                    sm.isInternalPointerRelease = true;
                    if (document.pointerLockElement && inputManager.shouldUsePointerLock()) document.exitPointerLock();
                    // Clear the flag after a short delay to ensure InputManager has seen it
                    if (consoleToggleTimeout !== null) clearTimeout(consoleToggleTimeout);
                    consoleToggleTimeout = setTimeout(() => { consoleToggleTimeout = null; sm.isInternalPointerRelease = false; }, 100);
                } else {
                    if (!sm.gameState.isPaused && !sm.gameState.isGameOver && inputManager.shouldUsePointerLock()) {
                        sm.scene.getEngine().getRenderingCanvas()?.requestPointerLock();
                    }
                }
            }

            // Update Developer Stats (Zone & Position) — Throttled & Debug Only
            if (sm.gameState.hasStarted && now - lastDevStatsUpdate >= 167) {
                lastDevStatsUpdate = now;
                if (sm.ui.getIsDebugActive() || sm.isConsoleOpen) {
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
            }

            const isLogicFrozen = sm.gameState.isPaused || sm.isConsoleOpen || sm.debugSelection.isActive;
            sm.gameState.isDebugMode = isLogicFrozen;
            sm.ui.setIsDebugMode(isLogicFrozen);
            sm.ui.setIsDebugActive(sm.debugSelection.isActive);
            sm.gameState.isConsoleOpen = sm.isConsoleOpen;

            if (sm.navPlugin) {
                sm.navPlugin.timeFactor = isLogicFrozen ? 0 : 1;
            }

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

                // Zombie count HUD — throttled to ~2x/sec, HOST/SOLO only
                // (CLIENT receives counts via the STATE delta from the host).
                if (now - lastZombieCountUpdate >= 500 && currentGameMode !== 'CLIENT') {
                    lastZombieCountUpdate = now;
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
