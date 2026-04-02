
import * as BABYLON from '@babylonjs/core';
import { StateManager } from '../state/StateManager';
import { GAME_CONFIG } from '../config';
import { InputManager, GameAction } from '../engine/InputManager';
import { SystemManager } from '../engine/SystemManager';

interface Ref<T> { current: T; }

export interface GameLoopDeps {
    stateManager: StateManager;
    systemManager: SystemManager;
    cameraRef: Ref<BABYLON.UniversalCamera | null>;
    gameModeRef: Ref<string>;
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
 *   2. Update InputManager.
 *   3. Multiplayer spectator game-over check.
 *   4. When the game has started: advance TimerManager, MysteryBoxSystem,
 *      VisualManager lighting, and zombie-count HUD updates (HOST/SOLO only).
 *   5. Run all registered ECS systems via SystemManager.
 *   6. Health regeneration (outside systems to run after damage this frame).
 */
export const createGameLoop = (deps: GameLoopDeps) => {
    const { stateManager: sm, systemManager, gameModeRef, inputManager } = deps;
    let lastDevStatsUpdate = 0;
    let lastZombieCountUpdate = 0;
    let lastDrawCallCount = 0;
    let consoleToggleTimeout: ReturnType<typeof setTimeout> | null = null;

    const getWeaponModelNode = (weaponRoot: BABYLON.TransformNode): BABYLON.TransformNode | BABYLON.AbstractMesh => {
        return weaponRoot.getChildTransformNodes()[0] ?? weaponRoot.getChildMeshes()[0] ?? weaponRoot;
    };

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
            const modelMesh = getWeaponModelNode(mesh);
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
                    const modelMesh = getWeaponModelNode(mesh);
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

    const updateDebugControls = (now: number) => {
        const debugMode = sm.debugControlsMode;
        if (debugMode.isActive) {
            inputManager.setDebugControlsActive(true);

            debugMode.frameCount++;
            const elapsed = now - debugMode.lastFpsUpdate;
            if (elapsed >= 500) {
                debugMode.fps = (debugMode.frameCount / elapsed) * 1000;
                debugMode.frameCount = 0;
                debugMode.lastFpsUpdate = now;
            }

            const debugData = inputManager.getDebugControlsData();
            const cam = sm.camera;
            sm.ui.setDebugControls({
                isActive: true,
                fps: debugMode.fps,
                inputSource: debugData.inputSource,
                cameraRotation: cam ? { x: cam.rotation.x, y: cam.rotation.y } : { x: 0, y: 0 },
                rawMouseDelta: debugData.rawMouseDelta,
                rawControllerLook: debugData.rawControllerLook,
            });
            return;
        }

        inputManager.setDebugControlsActive(false);
    };

    const updateRenderStats = () => {
        if (!sm.renderStatsMode.isActive) return;

        const scene = sm.scene;
        const engine = scene.getEngine();

        let shadowGenCount = 0;
        let shadowMapSize = 0;
        const totalLights = scene.lights.length;
        let activeLights = 0;
        for (let i = 0; i < totalLights; i++) {
            const light = scene.lights[i];
            if (!light.isEnabled()) continue;

            activeLights++;
            const sgs = light.getShadowGenerators();
            if (!sgs) continue;

            sgs.forEach(sg => {
                if (!sg) return;
                shadowGenCount++;
                const map = sg.getShadowMap();
                if (map) {
                    const size = map.getRenderSize() as number;
                    shadowMapSize = Math.max(shadowMapSize, size);
                }
            });
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
    };

    const handleConsoleToggle = () => {
        if (!inputManager.justPressed(GameAction.TOGGLE_CONSOLE)) return;

        sm.isConsoleOpen = !sm.isConsoleOpen;
        sm.ui.setIsConsoleOpen(sm.isConsoleOpen);

        if (sm.isConsoleOpen) {
            sm.isInternalPointerRelease = true;
            if (document.pointerLockElement && inputManager.shouldUsePointerLock()) document.exitPointerLock();
            if (consoleToggleTimeout !== null) clearTimeout(consoleToggleTimeout);
            consoleToggleTimeout = setTimeout(() => {
                consoleToggleTimeout = null;
                sm.isInternalPointerRelease = false;
            }, 100);
            return;
        }

        if (!sm.gameState.isPaused && !sm.gameState.isGameOver && inputManager.shouldUsePointerLock()) {
            sm.scene.getEngine().getRenderingCanvas()?.requestPointerLock();
        }
    };

    const updateDeveloperStats = (now: number) => {
        if (!sm.gameState.hasStarted || now - lastDevStatsUpdate < 167) return;
        lastDevStatsUpdate = now;

        if (!sm.ui.getIsDebugActive() && !sm.isConsoleOpen) return;

        const cam = sm.camera;
        if (!cam) return;

        const zone = sm.getZone(cam.position);
        sm.ui.setPlayerStats(zone, {
            x: cam.position.x,
            y: cam.position.y,
            z: cam.position.z,
            rot: cam.rotation.y,
        });
    };

    const updateDebugFreezeState = (currentGameMode: string): boolean => {
        const isMultiplayer = currentGameMode !== 'SOLO';
        const isPausedForLogic = sm.gameState.isPaused && !isMultiplayer;
        const isLogicFrozen = isPausedForLogic || sm.isConsoleOpen || sm.debugSelection.isActive;

        sm.gameState.isDebugMode = isLogicFrozen;
        sm.ui.setIsDebugMode(isLogicFrozen);
        sm.ui.setIsDebugActive(sm.debugSelection.isActive);
        sm.gameState.isConsoleOpen = sm.isConsoleOpen;

        if (sm.navPlugin) {
            sm.navPlugin.timeFactor = isLogicFrozen ? 0 : 1;
        }

        return isPausedForLogic || (sm.isConsoleOpen && !sm.debugSelection.isActive);
    };

    const updateSpectatorGameOver = (currentGameMode: string) => {
        if (!sm.gameState.isSpectating || sm.gameState.isGameOver || currentGameMode === 'SOLO') return;
        if (sm.remote.gameState.health > 0) return;

        sm.setIsGameOver(true);
        sm.eventBus.emit('GAME_OVER', null);
    };

    const updateStartedSessionState = (dt: number, now: number, currentGameMode: string) => {
        if (!sm.gameState.hasStarted) return;

        sm.update(dt);

        if (sm.gameState.isSpectating && !sm.getIsSpectating()) {
            sm.setIsSpectating(true);
        }

        sm.mysteryBoxSystem?.update(dt);

        if (now - lastZombieCountUpdate >= 500 && currentGameMode !== 'CLIENT') {
            lastZombieCountUpdate = now;
            sm.setActiveZombiesCount(sm.zombies.length);
            sm.setTotalRoundZombies(sm.gameState.totalZombiesInRound);
        }
    };

    const applyPassiveHealthRegen = (now: number) => {
        const maxHP = sm.gameState.maxHealth || GAME_CONFIG.PLAYER_BASE_HEALTH;
        if (sm.gameState.health >= maxHP || sm.gameState.health <= 0 || sm.gameState.isGameOver) return;
        if (now - sm.gameState.lastDamageTime <= 3000) return;
        if (now - sm.gameState.lastRegenTime <= 50) return;

        sm.gameState.health = Math.min(maxHP, sm.gameState.health + 5);
        sm.gameState.lastRegenTime = now;
        sm.setHealth(sm.gameState.health);
    };

    return {
        loop: (dt: number) => {
            const currentGameMode = gameModeRef.current;
            const now = Date.now();

            inputManager.update();

            updateDebugControls(now);
            updateRenderStats();
            handleConsoleToggle();
            updateDeveloperStats(now);

            if (updateDebugFreezeState(currentGameMode)) return;

            updateSpectatorGameOver(currentGameMode);
            updateStartedSessionState(dt, now, currentGameMode);

            systemManager.updateAll(dt, now);
            applyPassiveHealthRegen(now);
        },
        dispose
    };
};
