
import * as BABYLON from '@babylonjs/core';
import { vi } from 'vitest';
import { GameStateData, Zombie } from '../../types';
import { EventBus } from '../../engine/EventBus';
import { TimerManager } from '../../engine/TimerManager';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { WeaponState } from '../../types/player';

const createMockWeapon = (id: string): WeaponState => ({
    id,
    name: id.toUpperCase(),
    clipSize: 30,
    maxReserve: 90,
    fireRate: 100,
    automatic: true,
    damage: 20,
    scale: 1,
    pellets: 1,
    hipPos: { x: 0, y: 0, z: 0 },
    adsPos: { x: 0, y: 0, z: 0 },
    barrelLength: 1,
    reloadTime: 2000,
    currentAmmo: 30,
    currentReserve: 90,
    mesh: null,
    isPacked: false
});

export const createMockGameState = (): GameStateData => ({
    // GameFlowState
    hasStarted: true,
    isPaused: false,
    isDebugMode: false,
    isConsoleOpen: false,
    isGodMode: false,
    isNoclip: false,
    startTime: Date.now(),
    isSpectating: false,
    isGameOver: false,
    currentMapId: 'testMap',
    mapLoadGeneration: 0,
    interactionMsg: null,
    hoverMsg: null,

    // RoundState
    round: 1,
    zombiesToSpawn: 6,
    zombiesSpawned: 0,
    zombiesAlive: 0,
    zombiesKilledInRound: 0,
    totalZombiesInRound: 6,
    lastSpawnTime: 0,
    nextRoundTime: 0,
    isIntermission: false,
    isDogRound: false,

    // PlayerState
    points: 500,
    totalEarnedPoints: 500,
    health: 100,
    maxHealth: 100,
    weapons: [createMockWeapon('pistol')],
    activeWeaponIndex: 0,
    isReloading: false,
    isFiring: false,
    isAiming: false,
    isKnifing: false,
    lastShotTime: 0,
    isPackAPunching: false,
    weaponFiredThisTriggerPull: false,
    kills: 0,
    shots: 0,
    lastDamageTime: 0,
    lastRegenTime: 0,
    perkStates: {},
    isDowned: false,
    downedStartTime: 0,
    downedTimeLimit: 45000,
    isBeingRevived: false,
    isRevivingTeammate: false,
    reviveProgress: 0,
    quickRevivesRemaining: 3,
    playerName: 'LocalPlayer',

    // PhysicsState
    isGrounded: true,
    verticalVelocity: 0,
    currentVelocity: BABYLON.Vector3.Zero(),
    externalForce: BABYLON.Vector3.Zero(),

    // WorldState
    doorStates: {},
    windowBarriers: {},
    interactableStates: {},
    powerOn: false,
    accumulatedDropPoints: 0,
    nextDropThreshold: 2000,
    lastDeathPos: null,
    activePowerUps: {},
    repairPointsRound: 0,
    lastRepairTime: 0,
    powerUps: [],
    pendingPowerUps: [],

    // AssetsState
    weaponMeshes: {},
    knifeMesh: null
});

export const createMockContext = (overrides: Partial<GameStateData> = {}) => {
    const gameState = { ...createMockGameState(), ...overrides };
    const eventBus = new EventBus();
    const timerManager = new TimerManager();
    const configManager = new MapConfigManager();
    
    return {
        gameState,
        eventBus,
        timerManager,
        configManager,
        scene: new BABYLON.Scene(new BABYLON.NullEngine()),
        camera: {
            position: BABYLON.Vector3.Zero(),
            rotation: BABYLON.Vector3.Zero(),
            getFrontPosition: () => BABYLON.Vector3.Forward()
        } as any,
        zombies: [] as Zombie[],
        gameModeRef: { current: 'SOLO' },
        inputManager: {
            isDown: vi.fn(() => false),
            justPressed: vi.fn(() => false),
            isFireInputActive: vi.fn(() => false),
        } as any,
        send: vi.fn(),
        addPoints: vi.fn(),
        hasDoublePoints: vi.fn(() => false),
        setDebugInfo: vi.fn(),
        setFlashColor: vi.fn(),
        setHealth: vi.fn(),
        setIsDowned: vi.fn(),
        setIsGameOver: vi.fn(),
        applyDamageToLocalPlayer: vi.fn(),
        visualManager: {
            createBloodSplatter: vi.fn(),
            createImpactParticles: vi.fn(),
            createDecal: vi.fn(),
            createPlasmaExplosion: vi.fn(),
            createProjectileTrail: vi.fn(),
            createGroundSpawnEruption: vi.fn(),
            setHoleSmokeEnabled: vi.fn(),
        } as any,
        zombieManager: {
            onZombieDeath: vi.fn(),
            spawnZombieHost: vi.fn(),
            releaseGroundSpawnHole: vi.fn(),
        } as any,
        hellhoundManager: {
            onHellhoundDeath: vi.fn(),
            spawnHellhoundHost: vi.fn(),
        } as any,
        gameEngine: {
            activeProjectiles: [],
            releaseProjectile: vi.fn(),
            spawnProjectile: vi.fn(),
        } as any,
        staticLevelMeshes: new Set<BABYLON.AbstractMesh>(),
        debugSelection: {
            isActive: false,
            selectedMesh: null
        }
    };
};
