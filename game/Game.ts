
import * as BABYLON from '@babylonjs/core';
import { CreateNavigationPluginAsync } from "@babylonjs/addons";
import * as RecastCore from "@recast-navigation/core";
import * as RecastGenerators from "@recast-navigation/generators";
import { GameEngine } from './GameEngine';
import { createWeapons } from '../factories/WeaponMeshFactory';
import { releaseZombieMesh, releaseHellhoundMesh, disposeZombiePools } from '../factories/ZombieMeshFactory';
import { createRemotePlayer } from '../factories/RemotePlayerFactory';
import { loadMap } from '../managers/MapRegistry';
import { GAME_CONFIG, WEAPON_CONFIGS } from '../config';
import { WindowBarrier, MysteryBox, GameMessage, Zombie, DoorMeshEntry, MysteryBoxState, WeaponState } from '../types/index';
import { StateManager } from '../state/StateManager';
import { VisualManager } from '../managers/VisualManager';
import { SoundManager } from '../managers/SoundManager';
import { ZombieManager } from '../managers/ZombieManager';
import { HellhoundManager } from '../managers/HellhoundManager';
import { PowerUpManager } from '../managers/PowerUpManager';
import { ResourceManager } from '../managers/ResourceManager';
import { InputManager } from '../engine/InputManager';
import { SystemManager } from '../engine/SystemManager';
import { loadTextureConfig } from '../maps/MapTextureResolver';
import { createGameLoop } from './GameLoop';
import type { PlayerFields, GameFields } from '../store/useGameStore';

// Systems
import {
    createProjectileSystem, createPlayerMovementSystem, createPlayerCombatSystem,
    createZombieAISystem, createZombieHellhoundAISystem, createZombieWindowAISystem,
    createZombieSpawnSystem, createZombieDamageSystem, createZombieCleanupSystem,
    createZombieAnimationSystem, createInteractionSystem,
    createPowerUpSystem, createWeaponViewSystem, createRoundSystem,
    createNetworkSystem, createRemotePlayerSystem, createDownedSystem, createReviveSystem,
    createMysteryBoxSystem, createZombieSyncSystem,
    createPackAPunchSystem
} from '../systems';
import { applyDamageToLocalPlayer } from '../systems/player/playerDamageUtils';

/** Plain ref-like object so Game.ts stays React-free. */
interface Ref<T> { current: T; }

const COLOR_PROJ_NORMAL = new BABYLON.Color3(0.72, 0.45, 0.2);   // Brass/copper bullet color
const COLOR_PROJ_PACKED = new BABYLON.Color3(0.6, 0.1, 1); // Ray Gun Purple (keep for special weapons)

export type RendererType = 'WebGPU' | 'WebGL';

/**
 * Try to create a WebGPU engine; fall back to WebGL if unsupported.
 * Returns the engine and which renderer is active.
 */
export async function createGameEngine(canvas: HTMLCanvasElement): Promise<{ engine: BABYLON.Engine; rendererType: RendererType }> {
    // Suppress audio context warnings during engine creation
    const originalWarn = console.warn;
    const suppressedWarn = (msg: string, ...args: any[]) => {
        if (typeof msg === 'string' && (msg.includes('context') || msg.includes('GainNode') || msg.includes('Connecting'))) {
            return;
        }
        originalWarn(msg, args);
    };
    console.warn = suppressedWarn;

    try {
        const webGPUSupported = await BABYLON.WebGPUEngine.IsSupportedAsync;
        if (webGPUSupported) {
            const gpuEngine = new BABYLON.WebGPUEngine(canvas, {
                preserveDrawingBuffer: true,
                stencil: true,
                audioEngine: true,
                antialiasing: true,
            });
            // Disable UBOs BEFORE initAsync so bind group layouts respect the limit.
            // WebGPU allows max 12 uniform buffers per stage; our scene needs 16+.
            gpuEngine.disableUniformBuffers = true;
            await gpuEngine.initAsync();
            console.warn = originalWarn;
            console.log('✓ Using WebGPU renderer');
            return { engine: gpuEngine, rendererType: 'WebGPU' };
        }
    } catch (e) {
        console.warn = originalWarn;
        console.warn('WebGPU init failed, falling back to WebGL:', e);
    }

    const glEngine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        audioEngine: true,
    });
    console.warn = originalWarn;
    console.log('✓ Using WebGL renderer');
    return { engine: glEngine, rendererType: 'WebGL' };
}

export class Game {
    public engine: BABYLON.Engine;
    public rendererType: RendererType;
    public scene: BABYLON.Scene;
    public camera: BABYLON.UniversalCamera;
    public canvas: HTMLCanvasElement;
    public navPlugin: BABYLON.RecastJSPlugin | undefined;
    public gameEngine: GameEngine;
    public resourceManager: ResourceManager;
    public inputManager: InputManager;
    public systemManager: SystemManager;

    public stateManager: StateManager | null = null;

    // Map Root for cleanup
    private currentMapRoot: BABYLON.TransformNode | null = null;

    // Game Objects
    public weaponMeshes: { [key: string]: BABYLON.TransformNode } = {};
    public knifeMesh: BABYLON.AbstractMesh | null = null;
    public remotePlayer: { root: BABYLON.TransformNode, armsContainer: BABYLON.TransformNode, weapons: BABYLON.TransformNode[], muzzleFlash: BABYLON.PointLight, updateName: (n: string) => void } | null = null;

    public shadowCasters: BABYLON.AbstractMesh[] = [];

    // Handler for visibility change (alt-tab fix for material lighting)
    private visibilityChangeHandler: (() => void) | null = null;

    // Game loop cleanup
    private gameLoopDispose: (() => void) | null = null;

    constructor(canvas: HTMLCanvasElement, engine: BABYLON.Engine, rendererType: RendererType, private sendNetworkData: (data: GameMessage) => void, updatePlayer: (updates: Partial<PlayerFields>) => void, updateGame: (updates: Partial<GameFields>) => void) {
        this.canvas = canvas;
        this.engine = engine;
        this.rendererType = rendererType;

        // Safety net: ensure UBOs are disabled for WebGL too (WebGPU sets this
        // before initAsync in createGameEngine; WebGL doesn't need early init).
        this.engine.disableUniformBuffers = true;

        this.scene = new BABYLON.Scene(this.engine);
        this.resourceManager = new ResourceManager(this.scene);
        this.inputManager = new InputManager();
        this.systemManager = new SystemManager();

        this.scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
        this.scene.collisionsEnabled = true;

        // Subtle fill light — env texture provides the main ambient IBL
        const fillLight = new BABYLON.HemisphericLight("fillLight", new BABYLON.Vector3(0, 1, 0), this.scene);
        fillLight.intensity = 0.15;
        fillLight.diffuse = new BABYLON.Color3(1, 1, 1);
        fillLight.groundColor = new BABYLON.Color3(0.05, 0.05, 0.05);

        // Standard bullet material - brass metallic look
        const pMat = new BABYLON.StandardMaterial("projectileMat", this.scene);
        pMat.diffuseColor = COLOR_PROJ_NORMAL;
        pMat.specularColor = new BABYLON.Color3(0.9, 0.7, 0.4); // Gold specular highlight
        pMat.specularPower = 64;
        pMat.emissiveColor = new BABYLON.Color3(0.1, 0.06, 0.02); // Very subtle warm glow for visibility
        pMat.disableLighting = false;

        // Packed weapon bullet - keep purple glow for special effect
        const pMatPacked = new BABYLON.StandardMaterial("projectileMatPacked", this.scene);
        pMatPacked.diffuseColor = new BABYLON.Color3(0.4, 0.1, 0.6);
        pMatPacked.emissiveColor = COLOR_PROJ_PACKED.scale(0.5);
        pMatPacked.disableLighting = false;

        // Explosive projectile materials (Ray Gun) - keep glowing effect for plasma look
        const pMatExplosive = new BABYLON.StandardMaterial("projectileMatExplosive", this.scene);
        pMatExplosive.emissiveColor = new BABYLON.Color3(0.2, 1, 0.3); // Green plasma
        pMatExplosive.disableLighting = true;

        const pMatExplosivePacked = new BABYLON.StandardMaterial("projectileMatExplosivePacked", this.scene);
        pMatExplosivePacked.emissiveColor = COLOR_PROJ_PACKED;
        pMatExplosivePacked.disableLighting = true;

        this.gameEngine = new GameEngine();
        this.gameEngine.initialize(this.scene);

        this.camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 2, 0), this.scene);
        this.camera.inertia = 0;   // Disable Babylon's built-in inertia; movement is fully driven by PlayerMovementSystem
        this.camera.speed = GAME_CONFIG.WALK_SPEED;
        this.camera.angularSensibility = 800;
        this.camera.minZ = 0.1;
        this.camera.maxZ = 500; // Indoor maps need nowhere near Babylon's 10,000 default; tighter far plane = better depth buffer precision, less z-fighting
        // Disable all built-in camera inputs — InputManager + PlayerMovementSystem handle
        // all keyboard/mouse input. The default FreeCamera constructor adds keyboard & mouse
        // handlers that would otherwise run checkInputs() every frame and could write to
        // cameraRotation/cameraDirection, conflicting with the custom input pipeline.
        this.camera.inputs.clear();
        this.camera.keysUp = []; this.camera.keysDown = []; this.camera.keysLeft = []; this.camera.keysRight = [];

        this.camera.ellipsoid = new BABYLON.Vector3(0.25, 0.6, 0.25);
        this.camera.ellipsoidOffset = new BABYLON.Vector3(0, -0.6, 0);

        this.camera.checkCollisions = true;
        this.camera.applyGravity = false;
        this.camera.fov = GAME_CONFIG.BASE_FOV;

        this.remotePlayer = createRemotePlayer(this.scene);

        this.stateManager = new StateManager(
            this.scene,
            this.camera,
            this.gameEngine,
            this.resourceManager,
            this.sendNetworkData,
            updatePlayer,
            updateGame,
        );

        // ── Construct managers externally and inject ──────────────────────────
        // StateManager is a pure data/API surface; managers are created here in
        // Game.ts and injected so the state container has no construction logic.
        const sm = this.stateManager;

        const visualManager = new VisualManager(this.scene, this.resourceManager);

        const soundManager = new SoundManager(this.scene);
        sm.soundManager = soundManager;

        const zombieManager = new ZombieManager(
            this.scene,
            sm.gameState,
            sm.zombies,
            sm.windows,
            sm.groundSpawns,
            this.camera,
            (pos) => sm.getZone(pos),
            (pos, type) => {
                if (type === 'ground') {
                    visualManager.createGroundSpawnEruption(pos);
                } else {
                    visualManager.createSpawnEffect(pos);
                }
            },
            (pos, hitDir) => visualManager.createZombieExplosion(pos, hitDir),
            (pos, hitDir) => visualManager.createHeadExplosion(pos, hitDir),
            () => sm.remote.pos,
            () => sm.connectionStatusRef.current === 'CONNECTED',
            sm.zoneSystem,
            sm.configManager,
            this.resourceManager,
            sm.eventBus,
            sm.soundManager
        );

        const hellhoundManager = new HellhoundManager(
            this.scene,
            sm.gameState,
            sm.zombies,
            this.camera,
            (pos) => sm.getZone(pos),
            (pos) => visualManager.createSpawnSmokeEffect(pos),
            () => sm.remote.pos,
            () => sm.connectionStatusRef.current === 'CONNECTED',
            sm.zoneSystem,
            sm.configManager,
            this.resourceManager,
            sm.eventBus,
            visualManager
        );


        const powerUpManager = new PowerUpManager(
            this.scene,
            sm.gameState,
            sm.gameModeRef,
            this.sendNetworkData,
            (amt) => sm.addPoints(sm.hasDoublePoints() ? amt * 2 : amt),
            sm.windows,
            sm.zombies,
            sm,
            sm.configManager,
        );

        zombieManager.setDependencies(
            (pos) => powerUpManager.spawnPowerUp(pos),
            (amt) => sm.addPoints(sm.hasDoublePoints() ? amt * 2 : amt),
            this.sendNetworkData,
            (kills) => sm.setKills(kills),
            (event) => sm.pushKillEvent(event),
        );
        hellhoundManager.setDependencies(
            (pos, type) => powerUpManager.spawnPowerUp(pos, type),
            (amt) => sm.addPoints(sm.hasDoublePoints() ? amt * 2 : amt),
            this.sendNetworkData,
            (kills) => sm.setKills(kills),
            (event) => sm.pushKillEvent(event),
        );
        powerUpManager.setDependencies(
            (z, pos, k) => {
                if (z.type === 'HELLHOUND') {
                    hellhoundManager.onHellhoundDeath(z, pos, k);
                } else {
                    zombieManager.onZombieDeath(z, pos, k);
                }
            },
        );

        sm.setManagers(visualManager, zombieManager, hellhoundManager, powerUpManager);

        // Handle visibility change (alt-tab) to fix material lighting issues
        // When the tab loses and regains focus, materials may need to be refreshed
        this.visibilityChangeHandler = () => {
            if (document.visibilityState === 'visible' && this.scene) {
                // Small delay to let the WebGL context fully restore
                setTimeout(() => {
                    if (this.scene && !this.scene.isDisposed) {
                        this.scene.markAllMaterialsAsDirty(BABYLON.Constants.MATERIAL_AllDirtyFlag);
                    }
                }, 100);
            }
        };
        document.addEventListener("visibilitychange", this.visibilityChangeHandler);

        window.addEventListener("resize", this.resize);
    }

    public initializeSystems() {
        if (!this.stateManager) return;
        const sm = this.stateManager;

        // Populate StateManager references needed by systems
        sm.remote.visuals = this.remotePlayer;

        this.systemManager.register(createProjectileSystem({
            gameState: sm.gameState,
            scene: sm.scene,
            camera: sm.camera,
            gameEngine: sm.gameEngine,
            timerManager: sm.timerManager,
            visualManager: sm.visualManager,
            zombieManager: sm.zombieManager,
            hellhoundManager: sm.hellhoundManager,
            configManager: sm.configManager,
            eventBus: sm.eventBus,
            zombies: sm.zombies,
            gameModeRef: sm.gameModeRef,
            debugSelection: sm.debugSelection,
            send: (msg) => sm.send(msg),
            addPoints: (amt) => sm.addPoints(amt),
            hasDoublePoints: () => sm.hasDoublePoints(),
            setDebugInfo: (v) => sm.ui.setDebugInfo(v),
            setFlashColor: (v) => sm.setFlashColor(v),
            setHealth: (v) => sm.setHealth(v),
            setIsDowned: (v) => sm.setIsDowned(v),
            setIsGameOver: (v) => sm.setIsGameOver(v),
            applyDamageToLocalPlayer: (amount: number, flashColor: string) => applyDamageToLocalPlayer(sm, amount, flashColor),
            staticLevelMeshes: sm.staticLevelMeshes
        }));

        this.systemManager.register(createPlayerMovementSystem(sm));
        this.systemManager.register(createPlayerCombatSystem(sm));

        const interactionSys = createInteractionSystem(sm);
        this.systemManager.register(interactionSys);

        // System execution order matters:
        //  1. ZombieSpawnSystem  — SPAWNING/BREAKING_LID → sets CHASING
        //  2. ZombieAISystem     — crowd init, adds fresh CHASING zombies, runs chase
        //  3. ZombieHellhoundAISystem — independent hellhound state machine
        //  4. ZombieWindowAISystem    — window barrier sub-machine
        this.systemManager.register(createZombieSpawnSystem({
            gameState: sm.gameState,
            gameModeRef: sm.gameModeRef,
            zombies: sm.zombies,
            groundSpawns: sm.groundSpawns,
            zombieManager: sm.zombieManager,
            visualManager: sm.visualManager,
        }));

        this.systemManager.register(createZombieAISystem({
            gameState: sm.gameState,
            scene: sm.scene,
            camera: sm.camera,
            gameModeRef: sm.gameModeRef,
            configManager: sm.configManager,
            zombies: sm.zombies,
            navPlugin: sm.navPlugin,
            remote: {
                pos: sm.remote.pos,
                gameState: sm.remote.gameState
            },
            connectionStatusRef: sm.connectionStatusRef,
            zombieManager: sm.zombieManager,
            hellhoundManager: sm.hellhoundManager,
            crowdRef: sm.crowdRef,
            getIsPathfindingActive: () => sm.showPathfinding.isActive,
        }));

        this.systemManager.register(createZombieHellhoundAISystem({
            gameState: sm.gameState,
            gameModeRef: sm.gameModeRef,
            camera: sm.camera,
            remote: {
                pos: sm.remote.pos,
                gameState: sm.remote.gameState,
            },
            connectionStatusRef: sm.connectionStatusRef,
            configManager: sm.configManager,
            navPlugin: sm.navPlugin,
            zombies: sm.zombies,
            hellhoundManager: sm.hellhoundManager,
            zombieManager: sm.zombieManager,
            getIsPathfindingActive: () => sm.showPathfinding.isActive,
        }));

        this.systemManager.register(createZombieWindowAISystem({
            gameState: sm.gameState,
            gameModeRef: sm.gameModeRef,
            zombies: sm.zombies,
            windows: sm.windows,
            configManager: sm.configManager,
            eventBus: sm.eventBus,
            visualManager: sm.visualManager,
        }));

        this.systemManager.register(createZombieDamageSystem(sm));
        this.systemManager.register(createZombieCleanupSystem(sm));
        this.systemManager.register(createZombieAnimationSystem({
            gameState: sm.gameState,
            scene: sm.scene,
            zombies: sm.zombies,
            configManager: sm.configManager
        }));
        this.systemManager.register(createZombieSyncSystem({
            scene: sm.scene,
            gameModeRef: sm.gameModeRef,
            zombies: sm.zombies,
            eventBus: sm.eventBus,
            resourceManager: sm.resourceManager,
        }));
        this.systemManager.register(createPowerUpSystem(sm));
        this.systemManager.register(createWeaponViewSystem(sm));
        this.systemManager.register(createRoundSystem({
            gameState: sm.gameState,
            gameModeRef: sm.gameModeRef,
            eventBus: sm.eventBus,
            timerManager: sm.timerManager,
            zombieManager: sm.zombieManager,
            hellhoundManager: sm.hellhoundManager,
            configManager: sm.configManager,
            isConnected: () => sm.connectionStatusRef.current === 'CONNECTED',
            send: (msg) => sm.send(msg),
            setRound: (v) => sm.setRound(v),
            setShowRoundIntro: (v) => sm.setShowRoundIntro(v),
            setTotalRoundZombies: (v) => sm.setTotalRoundZombies(v),
            setActiveZombiesCount: (v) => sm.setActiveZombiesCount(v),
            setZombiesSpawned: (v) => sm.ui.setZombiesSpawned(v),
            setZombiesKilledInRound: (v) => sm.ui.setZombiesKilledInRound(v),
            setZombiesToSpawn: (v) => sm.ui.setZombiesToSpawn(v),
            setIsGameOver: (v) => sm.setIsGameOver(v)
        }));
        this.systemManager.register(createNetworkSystem(sm));
        this.systemManager.register(createRemotePlayerSystem(sm));
        this.systemManager.register(createDownedSystem(sm));
        this.systemManager.register(createReviveSystem(sm, this.inputManager));

        sm.mysteryBoxSystem = createMysteryBoxSystem(sm);

        sm.packAPunchSystem = createPackAPunchSystem(sm);
        sm.packAPunchSystem.init();

        this.systemManager.init();

        return { interactionSys };
    }

    /**
     * Re-compiles all materials in the scene. 
     * Essential after loading new map assets or changing environment lighting
     * to prevent "super bright" or incorrectly lit meshes.
     */
    public refreshMaterials() {
        if (this.scene) {
            this.scene.markAllMaterialsAsDirty(BABYLON.Constants.MATERIAL_AllDirtyFlag);
        }
    }

    /**
     * Resets the game session state, clearing all transient entities (zombies, projectiles, power-ups)
     * and resetting weapon materials/visibility. Used when returning to menu or restarting.
     */
    public resetSession() {
        if (!this.stateManager) return;
        const sm = this.stateManager;

        this._clearZombies(sm);
        this._clearPowerUps(sm);
        this._clearProjectiles();
        this._resetWeaponMaterials();
        this._resetVisualAndTimers(sm);
        this._resetGameStateFlags(sm);
        this._resetMysteryBox(sm);
    }

    /** Clear all zombies and hellhounds */
    private _clearZombies(sm: StateManager): void {
        const crowd = sm.crowdRef.current;
        sm.zombies.forEach(z => {
            // Remove from Recast Crowd before releasing mesh
            if (crowd && z.crowdAgentIndex !== undefined) {
                crowd.removeAgent(z.crowdAgentIndex);
                z.crowdAgentIndex = undefined;
            }
            if (z.type === 'HELLHOUND') {
                releaseHellhoundMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, limbs: z.limbs! });
            } else {
                releaseZombieMesh({ mesh: z.mesh as BABYLON.Mesh, head: z.headMesh, torso: z.torsoMesh, limbs: z.limbs! });
            }
        });
        sm.zombies.length = 0;
        sm.gameState.zombiesAlive = 0;
        sm.gameState.zombiesToSpawn = 0;
        sm.gameState.zombiesSpawned = 0;
        sm.gameState.zombiesKilledInRound = 0;

        sm.setActiveZombiesCount(0);
        sm.setTotalRoundZombies(0);
        sm.ui.setZombiesToSpawn(0);
        sm.ui.setZombiesSpawned(0);
        sm.ui.setZombiesKilledInRound(0);
    }

    /** Clear all power-ups */
    private _clearPowerUps(sm: StateManager): void {
        sm.gameState.powerUps.forEach(pu => {
            if (pu.mesh) pu.mesh.dispose();
        });
        sm.gameState.powerUps.length = 0;
        sm.gameState.activePowerUps = {};
        sm.gameState.pendingPowerUps = [];

        sm.setActivePowerUps({});
    }

    /** Clear all projectiles */
    private _clearProjectiles(): void {
        if (this.gameEngine) {
            const active = [...this.gameEngine.activeProjectiles];
            active.forEach(p => this.gameEngine.releaseProjectile(p));
        }
    }

    /** Reset weapon materials and visibility */
    private _resetWeaponMaterials(): void {
        Object.values(this.weaponMeshes).forEach(root => {
            root.getChildMeshes().forEach(m => {
                if (m instanceof BABYLON.Mesh) {
                    const matName = m.material?.name || "";
                    // Only restore if we are currently using the PaP camo
                    // The InteractionSystem adds "_pap" suffix to materials
                    if (matName.includes("_pap")) {
                        if (m.metadata?.originalMaterial) {
                            const papMat = m.material;
                            m.material = m.metadata.originalMaterial;
                            // Dispose the cloned PaP material to release memory and remove observers
                            if (papMat) papMat.dispose();
                        }
                    }
                }
            });
            root.setEnabled(false);
        });
        if (this.knifeMesh) this.knifeMesh.setEnabled(false);

        // Cleanup PaP Texture from resource cache
        this.resourceManager.removeTexture("papCamoTex");
    }

    /** Reset visual manager and timers */
    private _resetVisualAndTimers(sm: StateManager): void {
        sm.visualManager.reset();
        sm.timerManager.clear();
        sm.soundManager?.stopAll();
        sm.soundManager?.resumeAll();
    }

    /** Reset game state flags */
    private _resetGameStateFlags(sm: StateManager): void {
        sm.gameState.hasStarted = false;
        sm.gameState.round = 1;
        sm.setRound(1);
        sm.setShowRoundIntro(false);
        sm.gameState.isPackAPunching = false;
        sm.gameState.isReloading = false;
        sm.gameState.isFiring = false;
        sm.gameState.isAiming = false;
        sm.gameState.isKnifing = false;
        sm.gameState.powerOn = false;
        sm.gameState.isGameOver = false;
        sm.gameState.isSpectating = false;
        sm.setIsSpectating(false);
        sm.gameState.isDowned = false;
        sm.gameState.isBeingRevived = false;
        sm.gameState.isRevivingTeammate = false;

        sm.gameState.reviveProgress = 0;
        sm.setReviveProgress(0);

        sm.gameState.doorStates = {};
        sm.gameState.windowBarriers = {};
        sm.gameState.interactableStates = {};

        sm.gameState.accumulatedDropPoints = 0;
        sm.gameState.nextDropThreshold = 2000;
        sm.gameState.repairPointsRound = 0;
        sm.gameState.externalForce = BABYLON.Vector3.Zero();
        sm.gameState.currentVelocity = BABYLON.Vector3.Zero();

        sm.gameState.quickRevivesRemaining = GAME_CONFIG.MAX_QUICK_REVIVES_SOLO;

        sm.gameState.points = GAME_CONFIG.STARTING_POINTS;
        sm.setPoints(GAME_CONFIG.STARTING_POINTS);

        sm.gameState.totalEarnedPoints = GAME_CONFIG.STARTING_POINTS;
        sm.setTotalEarnedPoints(GAME_CONFIG.STARTING_POINTS);

        sm.gameState.health = GAME_CONFIG.PLAYER_BASE_HEALTH;
        sm.gameState.maxHealth = GAME_CONFIG.PLAYER_BASE_HEALTH;
        sm.setHealth(GAME_CONFIG.PLAYER_BASE_HEALTH);

        sm.gameState.kills = 0;
        sm.setKills(0);
        sm.ui.clearKillEvents();

        sm.gameState.shots = 0;
        sm.setShotsFired(0);

        sm.gameState.perkStates = {};
        sm.setPerks({});

        sm.setFlashColor(null);
        sm.setInteractionMsg(null);
        sm.setHoverMsg(null);

        // Reset weapons to starting state (pistol)
        sm.gameState.weapons = WEAPON_CONFIGS.filter(w => w.id === 'pistol').map(w => ({
            ...w,
            currentAmmo: w.clipSize,
            currentReserve: w.maxReserve,
            isPacked: false,
            mesh: sm.gameState.weaponMeshes[w.id] || null
        })) as WeaponState[];

        sm.gameState.activeWeaponIndex = 0;
        sm.setActiveWeaponIndex(0);
        sm.setWeaponName(sm.gameState.weapons[0].name);
        sm.setAmmo(sm.gameState.weapons[0].currentAmmo);
        sm.setReserveAmmo(sm.gameState.weapons[0].currentReserve);
    }

    /** Reset mystery box state */
    private _resetMysteryBox(sm: StateManager): void {
        if (sm.mysteryBox) {
            sm.mysteryBox.state = MysteryBoxState.BOX_IDLE;
            sm.mysteryBox.stateTimer = 0;
            sm.mysteryBox.lidAngle = 0;
            sm.mysteryBox.activeLocationIndex = 0;
        }
    }

    public async loadLevel(
        selectedMap: string,
        externalMysteryBoxRef: Ref<MysteryBox>
    ) {
        if (!this.stateManager) throw new Error("StateManager not initialized");

        // Pre-warm enemy assets
        await this.stateManager.zombieManager.preWarmAssets();
        await this.stateManager.hellhoundManager.preWarmAssets();

        // Pre-load sounds during map loading using data-driven approach
        const soundsToLoad = [
            { name: 'power', path: '/sounds/power.mp3' },
            { name: 'M1911', path: '/sounds/weapons/m1911.mp3' },
            { name: 'instakill', path: '/sounds/powerups/instakill.mp3' },
            { name: 'nuke', path: '/sounds/powerups/nuke.mp3' },
            { name: 'zombie_spawn', path: '/sounds/zombies/spawn.mp3' },
        ];
        soundsToLoad.forEach(({ name, path }) => {
            this.stateManager?.soundManager?.loadSound(name, path).catch(err => {
                console.warn(`Could not load ${name} sound:`, err);
            });
        });

        // Yield to event loop — allows Babylon PBR pipeline to finish setup.
        // See MapTextureResolver.ts for why this is needed.
        await loadTextureConfig(selectedMap);

        // 1. Cleanup Session & Old Map
        this.resetSession();

        // ── CRITICAL FIX: Clean up old scene lights & shadow generators ──
        // LevelBuilder.initializeEnvironment() creates lights and shadow generators
        // that are NOT children of currentMapRoot. They accumulate on reload,
        // stacking lights and causing incorrect rendering.
        if (this.currentMapRoot) {
            // Dispose lights that were created by the previous level
            const lightsToRemove = this.scene.lights.filter(l =>
                l.name === "hemi" || l.name === "dir" || l.name.startsWith("fixture_light")
            );
            lightsToRemove.forEach(l => l.dispose());

            // Dispose shadow generators from previous level
            this.scene.lights.forEach(l => {
                const shadowGens = l.getShadowGenerators();
                if (shadowGens) {
                    shadowGens.forEach(sg => sg?.dispose());
                }
            });

            this.currentMapRoot.dispose();
            this.currentMapRoot = null;
        }

        this.shadowCasters = [];
        this.stateManager.mapVisuals.doorMeshes.clear();
        this.stateManager.windows.length = 0; // Clear array but keep reference
        this.stateManager.groundSpawns.length = 0; // Clear array but keep reference
        this.stateManager.gameState.mapLoadGeneration++;

        // 2. Load New Map

        try {
            const sm = this.stateManager;
            const onBuildingLoaded = (meshes: BABYLON.AbstractMesh[]) => {
                for (const m of meshes) {
                    if (m && m.checkCollisions && m.isVisible && !m.name.includes("trigger")) {
                        sm.staticLevelMeshes.add(m as BABYLON.Mesh);
                    }
                }
            };

            const lvl = loadMap(selectedMap, this.scene, this.shadowCasters, sm.windows, sm.groundSpawns, externalMysteryBoxRef, this.navPlugin, onBuildingLoaded);

            // Await all map models to load
            await Promise.all(lvl.loadPromises);

            this.currentMapRoot = lvl.root;

            if (lvl.doors) {
                for (const [doorId, entry] of Object.entries(lvl.doors)) {
                    const e = entry as DoorMeshEntry;
                    const newEntry: DoorMeshEntry = {
                        mesh: e.mesh,
                        observer: null,
                        closedY: e.closedY,
                        openY: e.openY,
                        size: e.size,
                        rotation: e.rotation
                    };

                    // Add NavMesh Obstacle for closed doors
                    if (this.navPlugin && e.size) {
                        const position = e.mesh.absolutePosition.clone();
                        const extent = new BABYLON.Vector3(e.size[0] / 2, e.size[1] / 2, e.size[2] / 2);
                        const angle = e.rotation || 0;

                        try {
                            newEntry.obstacle = this.navPlugin.addBoxObstacle(position, extent, angle);
                        } catch (err) {
                            console.error(`Failed to add obstacle for door ${doorId}:`, err);
                        }
                    }

                    this.stateManager.mapVisuals.doorMeshes.set(doorId, newEntry);
                }
            }

            this.stateManager.mapVisuals.powerSwitchHandle = lvl.powerSwitchHandle;
            this.stateManager.mapVisuals.powerSwitchActivate = lvl.powerSwitchActivate ?? null;
            this.stateManager.mapVisuals.powerDoor = lvl.powerDoor;
            this.stateManager.mapVisuals.powerDoorOpenY = lvl.powerDoorOpenY ?? 8;

            this.stateManager.lights = lvl.lights;
            this.stateManager.spawnPoints = lvl.spawnPoints;
            this.stateManager.boxLocations = lvl.boxLocations;
            this.stateManager.boxRotations = lvl.boxRotations;
            this.stateManager.mapGameplay = lvl.mapGameplay || {};
            this.stateManager.mysteryBox = externalMysteryBoxRef.current;
            this.stateManager.mysteryBoxRef = externalMysteryBoxRef;

            // Populate static meshes for decals (all meshes with checkCollisions)
            this.stateManager.staticLevelMeshes.clear();
            for (const m of this.scene.meshes) {
                if (m && m.checkCollisions && m.isVisible && !m.name.includes("trigger")) {
                    this.stateManager.staticLevelMeshes.add(m);
                }
            }

            this.stateManager.updateZoneSystem(lvl.zones, lvl.doorConnections);
            this.stateManager.visualManager.setLights(this.stateManager.lights);

            // Start persistent ambient smoke on all ground spawn holes
            if (sm.groundSpawns.length > 0) {
                const holePositions = sm.groundSpawns.map(gs => gs.position);
                sm.visualManager.startHoleSmoke(holePositions);
            }

            await this.scene.whenReadyAsync();
            console.log(`Level ${selectedMap} loaded successfully.`);
        } catch (e) {
            console.error("Failed to load map:", e);
        }
    }

    /**
     * Load the environment texture for PBR materials.
     * 
     * Vite blocks serving files with a bare .env extension (security measure to
     * prevent leaking dotenv secrets), so the texture is stored as .envmap and
     * loaded with forcedExtension=".env" so Babylon parses it correctly.
     */
    private async loadEnvironmentTexture(): Promise<void> {
        const scene = this.scene;

        return new Promise<void>((resolve) => {
            if (scene.isDisposed) { resolve(); return; }

            const tex = BABYLON.CubeTexture.CreateFromPrefilteredData(
                "/environment.envmap", scene, ".env"
            );

            tex.onLoadObservable.addOnce(() => {
                if (scene.isDisposed) { resolve(); return; }
                scene.environmentTexture = tex;
                scene.environmentIntensity = 0.5;
                console.log("✓ Environment texture loaded successfully");
                resolve();
            });

            // Safety net for cached textures that resolve synchronously
            setTimeout(() => {
                if (scene.isDisposed || scene.environmentTexture) { resolve(); return; }
                if (tex.isReady()) {
                    scene.environmentTexture = tex;
                    scene.environmentIntensity = 0.5;
                    console.log("✓ Environment texture loaded successfully (cached)");
                }
                resolve();
            }, 0);
        });
    }

    public async initializeEngine() {
        try {
            // Initialize Recast core first
            await RecastCore.init();

            // Create navigation plugin with V2 API
            this.navPlugin = await CreateNavigationPluginAsync({
                instance: {
                    ...RecastCore,
                    ...RecastGenerators,
                },
            }) as unknown as BABYLON.RecastJSPlugin;

            if (this.navPlugin) {
                console.log("✓ Recast NavPlugin Initialized (V2)");
            }
        } catch (e) {
            console.warn("Recast initialization failed:", e);
        }

        console.log("Loading environment texture...");

        // Load as .envmap to avoid Vite's security block on .env files.
        // The forcedExtension ".env" tells Babylon to parse it as the .env format.
        await this.loadEnvironmentTexture();

        // Force all materials to recompile now that the environment texture is ready.
        // This is especially important on cached reloads where textures may have compiled
        // their shaders before the environment data was available on the GPU.
        this.scene.markAllMaterialsAsDirty(BABYLON.Constants.MATERIAL_AllDirtyFlag);

        // Initialize Managers dependencies early
        if (this.stateManager) {
            this.stateManager.inputManager = this.inputManager;
            this.stateManager.navPlugin = this.navPlugin;
        }

        // Load environment texture and create weapons
        const loadPromises: Promise<any>[] = [];
        const meshes = createWeapons(this.scene, this.camera, undefined, loadPromises);
        // Wait for weapons and environment
        await Promise.all(loadPromises);

        this.weaponMeshes = {
            pistol: meshes.pistol,
            rifle: meshes.rifle,
            shotgun: meshes.shotgun,
            famas: meshes.famas,
            ray_gun: meshes.ray_gun,
        };
        this.knifeMesh = meshes.knife as BABYLON.AbstractMesh;

        if (this.stateManager) {
            this.stateManager.gameState.weaponMeshes = this.weaponMeshes;
            this.stateManager.gameState.knifeMesh = this.knifeMesh;
        }

        const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, this.scene, [this.camera]);
        pipeline.samples = 2; // 2x MSAA — half the GPU cost of 4x with acceptable quality
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = 0.6;
        pipeline.bloomWeight = 0.3;
        pipeline.bloomScale = 0.5;
        pipeline.imageProcessingEnabled = true;
        pipeline.imageProcessing.toneMappingEnabled = true;
        pipeline.imageProcessing.contrast = 1.4;
        pipeline.imageProcessing.exposure = 1.0;

        await this.scene.whenReadyAsync();
    }

    public startLoop(onTick: (dt: number) => void) {
        this.engine.runRenderLoop(() => {
            const dt = this.engine.getDeltaTime() / 1000;
            onTick(dt);
            if (this.scene) {
                this.scene.render();
            }
        });
    }

    /**
     * Wire up and start the game loop using internal state.
     * Called once after initialize() resolves. Replaces the need for
     * GameScene to construct GameLoopDeps externally.
     */
    public beginRenderLoop(): void {
        if (!this.stateManager) return;
        const sm = this.stateManager;

        const gameLoop = createGameLoop({
            stateManager: sm,
            systemManager: this.systemManager,
            cameraRef: { get current() { return sm.camera; } },
            gameModeRef: sm.gameModeRef,
            pollGamepad: (_dt: number) => { /* gamepad polled inside InputManager.update() */ },
            inputManager: this.inputManager,
        });

        this.startLoop(gameLoop.loop);
        this.gameLoopDispose = gameLoop.dispose;
    }

    private resize = () => {
        this.engine.resize();
    }

    public dispose() {
        window.removeEventListener("resize", this.resize);
        if (this.visibilityChangeHandler) {
            document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
            this.visibilityChangeHandler = null;
        }
        if (this.gameLoopDispose) {
            this.gameLoopDispose();
            this.gameLoopDispose = null;
        }
        if (this.stateManager?.packAPunchSystem) this.stateManager.packAPunchSystem.dispose();
        if (this.systemManager) this.systemManager.dispose();
        if (this.gameEngine) this.gameEngine.dispose();
        if (this.resourceManager) this.resourceManager.dispose();
        disposeZombiePools();
        if (this.engine) this.engine.dispose();
    }
}
