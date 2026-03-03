
import * as BABYLON from '@babylonjs/core';
import { Game } from './Game';
import { MapLoader } from '../managers/MapLoader';
import { GameMessage, MysteryBox, createDefaultMysteryBox } from '../types/index';
import { MAP_DEFINITIONS } from '../managers/MapRegistry';
import { GAME_CONFIG, DEFAULT_MAP_ID, WEAPON_CONFIGS } from '../config';
import type { PlayerFields, GameFields } from '../store/useGameStore';

/**
 * Callbacks GameLifecycle uses to notify the React layer of state changes.
 * All are plain functions — no React imports needed here.
 */
export interface LifecycleCallbacks {
    onLoadingChange: (loading: boolean) => void;
    onStartedChange: (started: boolean) => void;
    onMapLoadedChange: (loaded: boolean) => void;
    onSetPaused: (paused: boolean) => void;
}

/**
 * GameLifecycle
 *
 * Owns the imperative game lifecycle: engine bootstrap, level loading,
 * player spawn, game-start/stop/reset. Lives entirely in the engine layer
 * with zero React imports.
 *
 * GameScene calls:
 *   lifecycle.init(canvas, send, updatePlayer, updateGame, callbacks)
 *   lifecycle.start(mapId, mode, playerName)
 *   lifecycle.stop()
 *   lifecycle.dispose()
 */
export class GameLifecycle {
    public game: Game | null = null;

    // Stable mystery-box state (replaces the React ref that was passed around)
    private mysteryBox: MysteryBox = createDefaultMysteryBox();
    private mysteryBoxRef = { current: this.mysteryBox };

    private callbacks: LifecycleCallbacks | null = null;
    private playerNameRef = { current: 'Survivor' };
    private engineInitPromise: Promise<void> | null = null;

    // ── Lifecycle ────────────────────────────────────────────────────────

    /**
     * Create the Game instance and wire InputManager listeners.
     * Call once after the canvas is mounted.
     */
    public init(
        canvas: HTMLCanvasElement,
        send: (msg: GameMessage) => void,
        updatePlayer: (updates: Partial<PlayerFields>) => void,
        updateGame: (updates: Partial<GameFields>) => void,
        callbacks: LifecycleCallbacks,
    ): void {
        this.callbacks = callbacks;

        const game = new Game(canvas, send, updatePlayer, updateGame);
        this.game = game;

        // Wire input listeners — InputManager reads game state via a live proxy.
        const stateProxy = {
            get hasStarted()   { return game.stateManager?.gameState.hasStarted   ?? false; },
            get isPaused()     { return game.stateManager?.gameState.isPaused     ?? false; },
            get isSpectating() { return game.stateManager?.gameState.isSpectating ?? false; },
            get isGameOver()   { return game.stateManager?.gameState.isGameOver   ?? false; },
            get isConsoleOpen() { return game.stateManager?.isConsoleOpen ?? false; },
            get isDebugActive() { return game.stateManager?.debugSelection.isActive ?? false; },
            get isInternalPointerRelease() { return game.stateManager?.isInternalPointerRelease ?? false; }
        };

        game.inputManager.attachListeners(canvas, stateProxy, (paused) => {
            this._setPaused(paused);
        });

        // Handle respawn requests emitted by RoundSystem / NetworkMessageHandler.
        // Respawn lives here because it needs to manipulate weapon meshes and camera —
        // things that belong at the lifecycle/engine layer, not inside StateManager.
        game.stateManager?.eventBus.on('RESPAWN_REQUEST', (data: { round: number; points: number }) => {
            this._respawnPlayer(data.round, data.points);
        });

        // Release pointer lock when the game ends — keeps DOM access out of ECS systems.
        game.stateManager?.eventBus.on('GAME_OVER', () => {
            if (document.pointerLockElement) document.exitPointerLock();
        });

        // Boot the engine (including navPlugin initialization) and wait for it.
        // Systems like ZombieAI need navPlugin to be available.
        this.engineInitPromise = game.initializeEngine().then(() => {
            // Only register systems AFTER engine is fully initialized so navPlugin exists
            game.initializeSystems();
            game.beginRenderLoop();
        });
    }

    /**
     * Start (or restart) the game on the given map.
     * Handles: loading screen, level load, player spawn, round init.
     */
    public async start(
        mapId: string,
        mode: 'SOLO' | 'HOST' | 'CLIENT',
        playerName: string,
    ): Promise<void> {
        const { game, callbacks } = this;
        if (!game || !callbacks) return;

        this.playerNameRef.current = playerName;

        callbacks.onLoadingChange(true);

        try {
            // Wait for engine initialization to finish before loading level
            if (this.engineInitPromise) {
                await this.engineInitPromise;
            }

            // Give React one frame to paint the loading screen before heavy work
            await new Promise<void>(resolve =>
                requestAnimationFrame(() => setTimeout(resolve, 50)),
            );

            // Load / reload the selected level
            await game.loadLevel(mapId, this.mysteryBoxRef);
            
            // Pre-warm assets to prevent runtime shader compilation hitches
            const sm = game.stateManager!;
            await Promise.all([
                sm.visualManager.preWarmAssets(),
                sm.zombieManager.preWarmAssets()
            ]);

            // ── CRITICAL FIX: Wait for ALL scene textures to be ready ──
            // When textures are served from browser cache, they may resolve
            // instantly but PBR materials need the environment texture + all
            // albedo textures to be fully uploaded to GPU before compilation
            // produces correct shaders. Without this, cached reloads render black.
            await new Promise<void>((resolve) => {
                const checkReady = () => {
                    const allReady = game.scene.textures.every(t => t.isReady());
                    if (allReady) {
                        resolve();
                    } else {
                        setTimeout(checkReady, 50);
                    }
                };
                // Timeout safety net
                const timeout = setTimeout(() => {
                    console.warn("Texture ready-wait timed out — forcing material refresh");
                    resolve();
                }, 8000);
                checkReady();
            });

            // Now that all textures are confirmed ready, recompile materials once
            game.refreshMaterials();
            // Allow one full frame for the GPU to process the dirty flag
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            game.refreshMaterials();

            await game.scene.whenReadyAsync();
            callbacks.onMapLoadedChange(true);

        // Spawn player
        if (sm.spawnPoints) {
            const spawns = sm.spawnPoints;
            const spawnPos  = mode === 'CLIENT' ? spawns.client.clone() : spawns.host.clone();
            const spawnRotY = mode === 'CLIENT' ? (spawns.clientRotation ?? spawns.rotation) : spawns.rotation;

            // Set initial position
            game.camera.position.copyFrom(spawnPos);
            game.camera.rotation.y = spawnRotY;
            game.camera.rotation.x = 0;
            sm.gameState.verticalVelocity = 0;
            sm.gameState.currentVelocity  = BABYLON.Vector3.Zero();
            sm.gameState.externalForce.set(0, 0, 0);

            // Use frame-synced observer to finalize spawn position after physics settles
            // This prevents the camera jump that occurs with setTimeout
            let framesWaited = 0;
            const spawnObserver = game.scene.onBeforeRenderObservable.add(() => {
                framesWaited++;
                // Wait 3 frames for physics to fully settle, then lock in position
                if (framesWaited >= 3) {
                    game.camera.position.copyFrom(spawnPos);
                    game.camera.rotation.y = spawnRotY;
                    game.camera.rotation.x = 0;
                    sm.gameState.verticalVelocity = 0;
                    sm.gameState.currentVelocity  = BABYLON.Vector3.Zero();
                    sm.gameState.externalForce.set(0, 0, 0);
                    game.scene.onBeforeRenderObservable.remove(spawnObserver);
                }
            });
        }

        // Initialise game state for the new session
        const def = MAP_DEFINITIONS[mapId] ?? MAP_DEFINITIONS[DEFAULT_MAP_ID];
        
        // Data-driven map state (Apply config first so we can use it)
        new MapLoader(sm.scene, sm).initializeState(def);
        
        const startPoints = sm.configManager.gameplay.STARTING_POINTS ?? GAME_CONFIG.STARTING_POINTS;

        sm.gameState.hasStarted         = true;
        sm.gameState.startTime          = Date.now();
        sm.gameState.isPaused           = false;
        sm.gameState.isIntermission     = true;
        sm.gameState.nextRoundTime      = Date.now() + 8_000;
        sm.gameState.isDogRound         = false;
        sm.gameState.isSpectating       = false;
        sm.gameState.isPackAPunching    = false;
        sm.gameState.isGameOver         = false;
        sm.gameState.isDowned           = false;
        sm.gameState.round              = 0;
        sm.gameState.playerName         = playerName;
        sm.gameState.points             = startPoints;
        sm.gameState.perkStates         = {};
        sm.gameState.maxHealth          = GAME_CONFIG.PLAYER_BASE_HEALTH;
        sm.gameState.kills              = 0;
        sm.gameState.shots              = 0;
        sm.setPoints(startPoints);
        sm.setPerks({});
        sm.setHealth(GAME_CONFIG.PLAYER_BASE_HEALTH);
        sm.setKills(0);
        sm.setShotsFired(0);

        // Propagate the session game mode to all systems BEFORE GAME_STARTED fires
        // so that NetworkSystem and RemotePlayerSystem read the correct mode on their
        // very first tick and inside their GAME_STARTED reset handlers.
        sm.updateGameMode(mode);

        // Reset weapons to starting pistol
        const pistolConfig = WEAPON_CONFIGS.find(w => w.id === 'pistol');
        if (pistolConfig) {
            sm.gameState.weapons = [{
                ...pistolConfig,
                currentAmmo:    pistolConfig.clipSize,
                currentReserve: pistolConfig.maxReserve,
                isPacked: false,
                mesh: sm.gameState.weaponMeshes['pistol'] || null,
            }];
            sm.setActiveWeaponIndex(0);
            sm.setWeaponName(pistolConfig.name);
            sm.setAmmo(pistolConfig.clipSize);
            sm.setReserveAmmo(pistolConfig.maxReserve);
        }

        // Signal all systems (NetworkSystem compressor, NetworkMessageHandler cache)
        // to reset their per-session state before the first tick fires.
        sm.eventBus.emit('GAME_STARTED', null);

        // Activate weapon meshes
        sm.gameState.weapons.forEach(w => {
            const mesh = sm.gameState.weaponMeshes[w.id];
            if (mesh) w.mesh = mesh;
        });
        Object.values(sm.gameState.weaponMeshes).forEach(m => m.setEnabled(false));
        const initialWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        if (initialWeapon?.mesh) initialWeapon.mesh.setEnabled(true);

        game.inputManager.reset();

        // Notify React
        callbacks.onStartedChange(true);

        // Schedule a no-op timer that GameScene uses as a cue to clear the fade overlay
        // via its own useEffect watching hasStarted (the 2 s value is cosmetic only).
        sm.timerManager.schedule('fade_out', 2_000, () => {});

        // Request pointer lock
        game.canvas.requestPointerLock();

        callbacks.onLoadingChange(false);
        } catch (e) {
            console.error("Error during level load:", e);
        } finally {
            // Always hide loading screen, even if something fails
            callbacks.onLoadingChange(false);
        }
    }

    /**
     * Stop the current game session and return to menu.
     */
    public stop(): void {
        const { game, callbacks } = this;
        if (!game || !callbacks) return;

        if (document.exitPointerLock) document.exitPointerLock();

        if (game.stateManager) {
            const sm = game.stateManager;
            sm.gameState.hasStarted   = false;
            sm.gameState.isGameOver   = false;
            sm.gameState.isPaused     = false;
            sm.gameState.isSpectating = false;
            sm.updateGameMode('SOLO');
        }

        callbacks.onStartedChange(false);
        callbacks.onLoadingChange(false);
        callbacks.onMapLoadedChange(false);
    }

    /**
     * Tear down the engine entirely. Call from React's cleanup function.
     */
    public dispose(): void {
        this.game?.inputManager.detachListeners();
        this.game?.dispose();
        this.game = null;
        this.callbacks = null;
    }

    // ── Internal ─────────────────────────────────────────────────────────

    /**
     * Respawn the local player. Triggered via eventBus 'RESPAWN_REQUEST'.
     * Handles mesh visibility, weapon state, camera repositioning and UI sync.
     * Moved here from StateManager so the state container stays logic-free.
     */
    private _respawnPlayer(newRound: number, newPoints: number): void {
        const { game } = this;
        if (!game?.stateManager) return;
        const sm = game.stateManager;
        const gs = sm.gameState;

        gs.maxHealth = GAME_CONFIG.PLAYER_BASE_HEALTH;
        gs.points    = newPoints;
        gs.isDowned  = false;
        gs.perkStates = {};
        sm.setHealth(GAME_CONFIG.PLAYER_BASE_HEALTH);
        sm.setIsSpectating(false);
        sm.setPoints(newPoints);
        sm.setPerks({});
        sm.setIsDowned(false);

        // Reset to pistol
        const pistolConfig = WEAPON_CONFIGS.find(w => w.id === 'pistol');
        if (pistolConfig) {
            gs.weapons = [{
                ...pistolConfig,
                currentAmmo:    pistolConfig.clipSize,
                currentReserve: pistolConfig.maxReserve,
                isPacked: false,
                mesh: gs.weaponMeshes['pistol'],
            }];
        }
        Object.values(gs.weaponMeshes).forEach(m => m.setEnabled(false));
        if (gs.weapons[0].mesh) gs.weapons[0].mesh.setEnabled(true);

        sm.setActiveWeaponIndex(0);
        sm.setWeaponName(gs.weapons[0].name);
        sm.setAmmo(gs.weapons[0].currentAmmo);
        sm.setReserveAmmo(gs.weapons[0].currentReserve);

        // Reposition camera to spawn point
        if (sm.spawnPoints) {
            const spawns   = sm.spawnPoints;
            const spawnPos = sm.gameModeRef.current === 'CLIENT'
                ? spawns.client.clone()
                : spawns.host.clone();
            game.camera.position   = spawnPos;
            game.camera.rotation.y = spawns.rotation;
            game.camera.rotation.x = 0;
        }
    }

    private _setPaused(paused: boolean): void {
        const sm = this.game?.stateManager;
        if (!sm) return;

        sm.setPaused(paused);

        if (!paused && this.game) {
            // Resume: re-request pointer lock and flush stale mouse delta
            this.game.canvas.requestPointerLock();
            this.game.inputManager.clearMouseMovement();
        }

        this.callbacks?.onSetPaused(paused);
    }
}
