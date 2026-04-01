
import * as BABYLON from '@babylonjs/core';
import { Game } from './Game';
import { getSessionStartPoints, startEngineSessionState } from './sessionStateUtils';
import { MapLoader } from '../managers/MapLoader';
import { GameMessage, MysteryBox, createDefaultMysteryBox } from '../types/index';
import { MAP_DEFINITIONS } from '../managers/MapRegistry';
import { GAME_CONFIG, DEFAULT_MAP_ID } from '../config';
import { resetPlayerWeapons } from '../engine/weaponResetUtils';
import type { InputDevice } from '../engine/InputManager';
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
    onInputDeviceChange?: (device: InputDevice) => void;
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

    // EventBus handler references for cleanup
    private _onRespawnRequest: ((data: { round: number; points: number }) => void) | null = null;
    private _onGameOver: (() => void) | null = null;

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
        }, callbacks.onInputDeviceChange);

        // Handle respawn requests emitted by RoundSystem / NetworkMessageHandler.
        // Respawn lives here because it needs to manipulate weapon meshes and camera —
        // things that belong at the lifecycle/engine layer, not inside StateManager.
        this._onRespawnRequest = (data: { round: number; points: number }) => {
            this._respawnPlayer(data.round, data.points);
        };
        game.stateManager?.eventBus.on('RESPAWN_REQUEST', this._onRespawnRequest);

        // Release pointer lock when the game ends — keeps DOM access out of ECS systems.
        this._onGameOver = () => {
            if (document.pointerLockElement && game.inputManager.shouldUsePointerLock()) document.exitPointerLock();
        };
        game.stateManager?.eventBus.on('GAME_OVER', this._onGameOver);

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
            const sm = game.stateManager!;
            await this._waitForEngineAndPaint();
            await this._prepareLevel(game, mapId, callbacks);
            this._spawnPlayer(game, sm, mode);

            const def = MAP_DEFINITIONS[mapId] ?? MAP_DEFINITIONS[DEFAULT_MAP_ID];
            new MapLoader(sm.scene, sm).initializeState(def);
            const startPoints = sm.configManager.gameplay.STARTING_POINTS ?? getSessionStartPoints(mapId);

            // Propagate the session game mode to all systems BEFORE GAME_STARTED fires
            // so that NetworkSystem and RemotePlayerSystem read the correct mode on their
            // very first tick and inside their GAME_STARTED reset handlers.
            sm.updateGameMode(mode);

            startEngineSessionState(sm, playerName, startPoints);

            await this._waitForMultiplayerReady(sm, mode);

            // Signal all systems (NetworkSystem compressor, NetworkMessageHandler cache)
            // to reset their per-session state before the first tick fires.
            sm.eventBus.emit('GAME_STARTED', { startPoints });

            game.inputManager.reset();

            callbacks.onStartedChange(true);

            if (game.inputManager.shouldUsePointerLock()) game.canvas.requestPointerLock();
            await this._waitForWarmupFrames(5);

            callbacks.onLoadingChange(false);
        } catch (e) {
            console.error("Error during level load:", e);
        } finally {
            // Always hide loading screen, even if something fails
            callbacks.onLoadingChange(false);
        }
    }

    private async _waitForEngineAndPaint(): Promise<void> {
        if (this.engineInitPromise) {
            await this.engineInitPromise;
        }

        await new Promise<void>(resolve =>
            requestAnimationFrame(() => setTimeout(resolve, 50)),
        );
    }

    private async _prepareLevel(game: Game, mapId: string, callbacks: LifecycleCallbacks): Promise<void> {
        this.mysteryBox = createDefaultMysteryBox();
        this.mysteryBoxRef.current = this.mysteryBox;

        await game.loadLevel(mapId, this.mysteryBoxRef);

        const sm = game.stateManager!;
        await Promise.all([
            sm.visualManager.preWarmAssets(),
            sm.zombieManager.preWarmAssets(),
            sm.hellhoundManager.preWarmAssets(),
        ]);

        await this._waitForTextures(game);
        game.refreshMaterials();
        await this._waitForWarmupFrames(1);
        game.refreshMaterials();
        await game.scene.whenReadyAsync();

        callbacks.onMapLoadedChange(true);
    }

    private async _waitForTextures(game: Game): Promise<void> {
        await new Promise<void>((resolve) => {
            let resolved = false;
            const done = () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                resolve();
            };
            const checkReady = () => {
                const allReady = game.scene.textures.every(t => t.isReady());
                if (allReady) {
                    done();
                } else {
                    setTimeout(checkReady, 50);
                }
            };
            const timeout = setTimeout(() => {
                console.warn("Texture ready-wait timed out — forcing material refresh");
                done();
            }, 8000);
            checkReady();
        });
    }

    private _spawnPlayer(game: Game, sm: NonNullable<Game['stateManager']>, mode: 'SOLO' | 'HOST' | 'CLIENT'): void {
        if (!sm.spawnPoints) return;

        const spawns = sm.spawnPoints;
        const spawnPos = mode === 'CLIENT' ? spawns.client.clone() : spawns.host.clone();
        const spawnRotY = mode === 'CLIENT' ? (spawns.clientRotation ?? spawns.rotation) : spawns.rotation;

        const applySpawnTransform = () => {
            game.camera.position.copyFrom(spawnPos);
            game.camera.rotation.y = spawnRotY;
            game.camera.rotation.x = 0;
            sm.gameState.verticalVelocity = 0;
            sm.gameState.currentVelocity = BABYLON.Vector3.Zero();
            sm.gameState.externalForce.set(0, 0, 0);
        };

        applySpawnTransform();

        let framesWaited = 0;
        const spawnObserver = game.scene.onBeforeRenderObservable.add(() => {
            framesWaited++;
            if (framesWaited < 3) return;

            applySpawnTransform();
            game.scene.onBeforeRenderObservable.remove(spawnObserver);
        });
    }

    private async _waitForMultiplayerReady(sm: NonNullable<Game['stateManager']>, mode: 'SOLO' | 'HOST' | 'CLIENT'): Promise<void> {
        if (mode === 'HOST') {
            sm.send({ type: 'HOST_LOADED' });
            return;
        }

        if (mode !== 'CLIENT' || sm.gameState.isHostLoaded) return;

        await new Promise<void>((resolve) => {
            let resolved = false;
            const done = () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(safetyTimeout);
                sm.eventBus.off('HOST_LOADED_RECEIVED', onHostLoaded);
                resolve();
            };
            const onHostLoaded = () => done();
            sm.eventBus.on('HOST_LOADED_RECEIVED', onHostLoaded);
            const safetyTimeout = setTimeout(done, 15000);
        });
    }

    private async _waitForWarmupFrames(count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }
    }

    /**
     * Stop the current game session and return to menu.
     */
    public stop(): void {
        const { game, callbacks } = this;
        if (!game || !callbacks) return;

        if (document.exitPointerLock && game.inputManager.shouldUsePointerLock()) document.exitPointerLock();

        if (game.stateManager) {
            const sm = game.stateManager;
            sm.updateGameMode('SOLO');

            // Must go through setPaused() so scene.particlesEnabled and
            // scene.animationsEnabled are restored — setting the flag directly
            // left those Babylon flags stale across map loads.
            sm.setPaused(false);
        }

        callbacks.onStartedChange(false);
        callbacks.onLoadingChange(false);
        callbacks.onMapLoadedChange(false);
    }

    /**
     * Tear down the engine entirely. Call from React's cleanup function.
     */
    public dispose(): void {
        // Clean up EventBus handlers to prevent accumulation across reloads
        const eventBus = this.game?.stateManager?.eventBus;
        if (eventBus) {
            if (this._onRespawnRequest) eventBus.off('RESPAWN_REQUEST', this._onRespawnRequest);
            if (this._onGameOver) eventBus.off('GAME_OVER', this._onGameOver);
        }
        this._onRespawnRequest = null;
        this._onGameOver = null;

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
        sm.setPlayerName(gs.playerName);

        // Reset to pistol
        resetPlayerWeapons(sm);

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
            if (this.game.inputManager.shouldUsePointerLock()) {
                this.game.canvas.requestPointerLock();
            }
            this.game.inputManager.clearMouseMovement();
        }

        this.callbacks?.onSetPaused(paused);
    }
}
