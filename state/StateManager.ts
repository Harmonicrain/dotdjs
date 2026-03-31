import * as BABYLON from '@babylonjs/core';
import { GAME_CONFIG, WEAPON_CONFIGS } from '../config';
import { GameStateData, WeaponState, MysteryBox, Zombie, PowerUpType, WindowBarrier, GroundSpawn, SpawnPoints, ZoneDefinition, DoorConnection, GameMessage, DoorMeshEntry, MapGameplay, createDefaultMysteryBox } from '../types/index';
import { MysteryBoxSystem } from '../types/systems';
import { DebugSelectionState, ShowPathfindingState, ScaleWeaponModeState, DebugControlsModeState, RenderStatsModeState, BulletDebugState, WeaponAdsDebugState, DEFAULT_DEBUG_SELECTION, DEFAULT_SHOW_PATHFINDING, DEFAULT_SCALE_WEAPON_MODE, DEFAULT_DEBUG_CONTROLS_MODE, DEFAULT_RENDER_STATS_MODE, DEFAULT_BULLET_DEBUG, DEFAULT_WEAPON_ADS_DEBUG } from '../types/debug';
import { GameEngine } from '../game/GameEngine';
import { TimerManager } from '../engine/TimerManager';
import { ZoneSystem } from '../systems/ZoneSystem';
import { ResourceManager } from '../managers/ResourceManager';
import { VisualManager } from '../managers/VisualManager';
import { SoundManager } from '../managers/SoundManager';
import { ZombieManager } from '../managers/ZombieManager';
import { HellhoundManager } from '../managers/HellhoundManager';
import { PowerUpManager } from '../managers/PowerUpManager';
import { EventBus } from '../engine/EventBus';
import { InputManager, InputDevice } from '../engine/InputManager';
import { UIBridge } from './UIBridge';
import { RemotePlayerState } from './RemotePlayerState';

import { MapConfigManager } from '../managers/MapConfigManager';
import { executeCommand } from '../engine/CommandRegistry';
import { applyDamageToLocalPlayer as _applyDamage } from '../systems/player/playerDamageUtils';

import { PlayerFields, GameFields } from '../store/useGameStore';

/**
 * StateManager
 *
 * The single source of truth for all authoritative game state that lives
 * outside of React.  It is created once per `Game` instance and shared by
 * every ECS system via direct reference.
 */
export class StateManager {
    public eventBus: EventBus;
    public gameState: GameStateData;
    public zombies: Zombie[] = [];
    public mysteryBox: MysteryBox;
    public mysteryBoxRef: { current: MysteryBox } | null = null;
    public boxLocations: BABYLON.Vector3[] = [];
    public boxRotations: number[] = [];
    public configManager: MapConfigManager;
    public mysteryBoxSystem: MysteryBoxSystem | null = null;
    public packAPunchSystem: { init(): void; dispose(): void } | null = null;
    public timerManager: TimerManager;
    public zoneSystem: ZoneSystem;

    // Core Engine Refs (Assigned by Game.ts)
    public inputManager: InputManager | null = null;
    public navPlugin: BABYLON.RecastJSPlugin | undefined = undefined;
    public soundManager: SoundManager | null = null;
    public mapGameplay: MapGameplay = {};
    /** Shared ref written by ZombieAISystem, read by ZombieCleanupSystem */
    public crowdRef: { current?: BABYLON.ICrowd } = { current: undefined };

    public get inputDevice(): InputDevice {
        return this.inputManager?.getInputDevice() ?? 'KM';
    }

    // Debug State (types defined in types/debug.ts)
    public debugSelection: DebugSelectionState = { ...DEFAULT_DEBUG_SELECTION };
    public showPathfinding: ShowPathfindingState = { ...DEFAULT_SHOW_PATHFINDING };
    public isConsoleOpen: boolean = false;
    public isInternalPointerRelease: boolean = false;
    public scaleWeaponMode: ScaleWeaponModeState = { ...DEFAULT_SCALE_WEAPON_MODE };
    public debugControlsMode: DebugControlsModeState = { ...DEFAULT_DEBUG_CONTROLS_MODE };
    public renderStatsMode: RenderStatsModeState = { ...DEFAULT_RENDER_STATS_MODE };
    public bulletDebug: BulletDebugState = { ...DEFAULT_BULLET_DEBUG };
    public weaponAdsDebug: WeaponAdsDebugState = { ...DEFAULT_WEAPON_ADS_DEBUG };

    // Level Data
    public staticLevelMeshes: Set<BABYLON.AbstractMesh> = new Set();
    public windows: WindowBarrier[] = [];
    public groundSpawns: GroundSpawn[] = [];
    public lights: BABYLON.PointLight[] = [];
    public spawnPoints: SpawnPoints | null = null;

    // Map Visuals (for Systems to animate)
    public mapVisuals: {
        powerSwitchActivate: (() => void) | null;
        doorMeshes: Map<string, DoorMeshEntry>;
        powerSwitchHandle: BABYLON.TransformNode | null;
        powerDoor: BABYLON.Mesh | null;
        powerDoorOpenY: number;
    } = { doorMeshes: new Map(), powerSwitchHandle: null, powerDoor: null, powerSwitchActivate: null, powerDoorOpenY: 8 };

    // Remote Player Data
    public remote: RemotePlayerState = new RemotePlayerState();

    // Managers — injected via setManagers() after construction
    public visualManager: VisualManager = null!;
    public zombieManager: ZombieManager = null!;
    public hellhoundManager: HellhoundManager = null!;
    public powerUpManager: PowerUpManager = null!;

    // Helpers
    public gameModeRef: { current: string };
    public connectionStatusRef: { current: string };

    // ── UI Bridge ─────────────────────────────────────────────────────
    public ui: UIBridge = null!;

    // ── HUD Sync Methods ─────────────────────
    public setPoints(v: number) { this.ui.setPoints(v); }
    public setTotalEarnedPoints(v: number) { this.ui.setTotalEarnedPoints(v); }
    public setHealth(v: number) { this.ui.setHealth(v); }
    public setAmmo(v: number) { this.ui.setAmmo(v); }
    public setReserveAmmo(v: number) { this.ui.setReserveAmmo(v); }
    public setMaxClip(v: number) { this.ui.setMaxClip(v); }
    public setActiveWeaponIndex(v: number) { this.ui.setActiveWeaponIndex(v); }
    public setWeaponName(v: string) { this.ui.setWeaponName(v); }
    public setIsAiming(v: boolean) { this.ui.setIsAiming(v); }
    public setWeaponId(v: string) { this.ui.setWeaponId(v); }
    public setPerks(v: Record<string, boolean>) { this.ui.setPerks(v); }
    public setIsSpectating(v: boolean) { this.ui.setIsSpectating(v); }
    public setIsGameOver(v: boolean) { this.ui.setIsGameOver(v); }
    public setIsDowned(v: boolean) { this.ui.setIsDowned(v); }
    public setIsBeingRevived(v: boolean) { this.ui.setIsBeingRevived(v); }
    public setReviveProgress(v: number) { this.ui.setReviveProgress(v); }
    public setKills(v: number) { this.ui.setKills(v); }
    public pushKillEvent(event: import('../store/useGameStore').KillEvent) { this.ui.pushKillEvent(event); }

    public setShotsFired(v: number) { this.ui.setShotsFired(v); }
    public setInteractionMsg(v: string | null) { this.ui.setInteractionMsg(v); }
    public setHoverMsg(v: string | null) { this.ui.setHoverMsg(v); }
    public setFlashColor(v: string | null) { this.ui.setFlashColor(v); }
    public setPlayerName(v: string) { this.ui.setPlayerName(v); }
    public setRound(v: number) { this.ui.setRound(v); }
    public setShowRoundIntro(v: boolean) { this.ui.setShowRoundIntro(v); }
    public setActivePowerUps(v: Partial<Record<PowerUpType, number>>) { this.ui.setActivePowerUps(v); }
    public setActiveZombiesCount(v: number) { this.ui.setActiveZombiesCount(v); }
    public setTotalRoundZombies(v: number) { this.ui.setTotalRoundZombies(v); }
    public getGameMode(): string { return this.ui.getGameMode(); }
    public getConnectionStatus(): string { return this.ui.getConnectionStatus(); }
    public getIsSpectating(): boolean { return this.ui.getIsSpectating(); }

    constructor(
        public scene: BABYLON.Scene,
        public camera: BABYLON.UniversalCamera,
        public gameEngine: GameEngine,
        public resourceManager: ResourceManager,
        public send: (data: GameMessage) => void,
        updatePlayer: (updates: Partial<PlayerFields>) => void,
        updateGame: (updates: Partial<GameFields>) => void,
    ) {
        this.eventBus = new EventBus();
        this.timerManager = new TimerManager();
        this.zoneSystem = new ZoneSystem([], []);
        this.configManager = new MapConfigManager();

        // Console Commands
        this.eventBus.on('COMMAND_REQUEST', (cmd: string) => {
            const result = executeCommand(cmd, this);
            if (result) {
                this.ui.setConsoleResult(result);
                this.timerManager.schedule('clear_console', 5000, () => this.ui.setConsoleResult(null));
            }
        });

        // Player Damage Event
        this.eventBus.on('PLAYER_DAMAGE', (data: { amount: number; source: string }) => {
            _applyDamage(this, data.amount, "rgba(200, 50, 0, 0.4)");
        });

        // Some commands (e.g. /scaleweapon) need to close the console and return to gameplay
        this.eventBus.on('COMMAND_CLOSE_CONSOLE', () => {
            this.isConsoleOpen = false;
            this.ui.setIsConsoleOpen(false);
            this.ui.setConsoleResult(null);
            // Re-request pointer lock so the player is back in-game
            if (this.inputManager?.shouldUsePointerLock()) {
                this.scene.getEngine().getRenderingCanvas()?.requestPointerLock();
            }
        });

        // Init GameState
        this.gameState = {
            hasStarted: false, isPaused: false, startTime: 0, mapLoadGeneration: 0, round: 1,
            zombiesToSpawn: 0, zombiesSpawned: 0, zombiesAlive: 0, zombiesKilledInRound: 0, totalZombiesInRound: 0,
            lastSpawnTime: 0, nextRoundTime: 0, isIntermission: false, isDogRound: false,
            dogRoundStarted: false, dogRoundStartTime: 0, dogRoundNumber: 0,
            points: GAME_CONFIG.STARTING_POINTS, totalEarnedPoints: GAME_CONFIG.STARTING_POINTS, health: GAME_CONFIG.PLAYER_BASE_HEALTH, maxHealth: GAME_CONFIG.PLAYER_BASE_HEALTH,
            weapons: WEAPON_CONFIGS.filter(w => w.id === 'pistol').map(w => ({
                ...w, currentAmmo: w.clipSize, currentReserve: w.maxReserve, isPacked: false, mesh: null
            })) as WeaponState[],
            weaponMeshes: {} as { [key: string]: BABYLON.TransformNode },
            activeWeaponIndex: 0, isReloading: false, isFiring: false, isAiming: false, isKnifing: false, lastShotTime: 0,
            knifeMesh: null,
            doorStates: {},
            windowBarriers: {},
            perkStates: {},
            interactableStates: {},
            currentMapId: '',
            powerOn: false,
            kills: 0, shots: 0,
            lastDamageTime: 0, lastRegenTime: 0, lastRepairTime: 0, isGrounded: true, verticalVelocity: 0,
            externalForce: BABYLON.Vector3.Zero(),
            recoilOffsetX: 0, recoilOffsetY: 0, recoilRecoverySpeed: 3.0, screenShakeIntensity: 0, weaponKickTrigger: null,
            powerUps: [], pendingPowerUps: [], accumulatedDropPoints: 0, nextDropThreshold: 2000,
            lastDeathPos: null, activePowerUps: {},
            repairPointsRound: 0, isSpectating: false, isPackAPunching: false, isGameOver: false,
            weaponFiredThisTriggerPull: false, currentVelocity: BABYLON.Vector3.Zero(),
            isDowned: false,
            downedStartTime: 0,
            downedTimeLimit: GAME_CONFIG.DOWNED_BLEED_OUT_TIME,
            isBeingRevived: false,
            isRevivingTeammate: false,
            reviveProgress: 0,
            quickRevivesRemaining: GAME_CONFIG.MAX_QUICK_REVIVES_SOLO,
            savedWeapons: null,
            savedActiveWeaponIndex: 0,
            playerName: "Unknown",
            interactionMsg: null,
            hoverMsg: null
        };


        this.ui = new UIBridge(this.gameState, updatePlayer, updateGame);
        this.mysteryBox = createDefaultMysteryBox();
        this.gameModeRef = { current: this.getGameMode() };
        this.connectionStatusRef = { current: this.getConnectionStatus() };
    }

    public initializeDoor(doorId: string, cost: number, connects: [number, number], startsOpen: boolean = false) {
        this.gameState.doorStates[doorId] = { isOpen: startsOpen, cost, connectsZones: connects };
    }

    public initializeWindow(windowId: string, zone: number, planks: number = 6) {
        if (!this.gameState.windowBarriers[windowId]) {
            this.gameState.windowBarriers[windowId] = { planksRemaining: planks, maxPlanks: planks, isFullyRepaired: true, zone };
        }
    }

    public initializePerk(perkId: string) { this.gameState.perkStates[perkId] = false; }
    public getPerkState(perkId: string): boolean { return this.gameState.perkStates[perkId] ?? false; }
    public updateZoneSystem(zones: ZoneDefinition[], doors: DoorConnection[]) { this.zoneSystem.load(zones, doors); }
    public setPaused(paused: boolean) {
        this.gameState.isPaused = paused;

        const shouldFreezeForPause = paused && this.gameModeRef.current === 'SOLO';

        // Multiplayer pause is local UI only; solo pause freezes simulation visuals.
        this.scene.animationsEnabled = !shouldFreezeForPause;
        this.scene.particlesEnabled = !shouldFreezeForPause;

        if (shouldFreezeForPause) {
            this.timerManager.pauseAll();
            this.soundManager?.pauseAll();
        } else {
            this.timerManager.resumeAll();
            this.soundManager?.resumeAll();
        }
    }
    public update(dt: number) { this.timerManager.update(dt); }
    public updateGameMode(mode: string) { this.gameModeRef.current = mode; }
    public updateConnectionStatus(status: string) { this.connectionStatusRef.current = status; }
    public hasDoublePoints(): boolean {
        return !!(this.gameState.activePowerUps[PowerUpType.DOUBLE_POINTS] && this.gameState.activePowerUps[PowerUpType.DOUBLE_POINTS]! > Date.now());
    }
    public isFireSaleActive(): boolean {
        return !!(this.gameState.activePowerUps[PowerUpType.FIRE_SALE] && this.gameState.activePowerUps[PowerUpType.FIRE_SALE]! > Date.now());
    }
    public addPoints(amount: number) {
        this.gameState.points += amount;
        this.gameState.totalEarnedPoints += amount;
        this.gameState.accumulatedDropPoints += amount;
        this.setPoints(this.gameState.points);
        this.setTotalEarnedPoints(this.gameState.totalEarnedPoints);
    }
    public getZone(pos: BABYLON.Vector3) { return this.zoneSystem.getZone(pos); }
    public setManagers(visual: VisualManager, zombie: ZombieManager, hellhound: HellhoundManager, powerUp: PowerUpManager): void {
        this.visualManager = visual;
        this.zombieManager = zombie;
        this.hellhoundManager = hellhound;
        this.powerUpManager = powerUp;
    }
}
