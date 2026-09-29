
import * as React from 'react';
import * as BABYLON from '@babylonjs/core';
import type { GameEngine } from '../game/GameEngine';
import type { InputManager } from '../engine/InputManager';
import type { StateManager } from '../state/StateManager';
import { WeaponState, RemoteGameState } from './player';
import { MysteryBox, InteractableType, DoorState, WindowBarrierState } from './world';
import { MysteryBoxSystem, RemotePlayerVisuals } from './systems';
import { StoredPos } from './network';

export enum PowerUpType {
    MAX_AMMO = 'MAX_AMMO',
    INSTA_KILL = 'INSTA_KILL',
    DOUBLE_POINTS = 'DOUBLE_POINTS',
    NUKE = 'NUKE',
    CARPENTER = 'CARPENTER',
    FIRE_SALE = 'FIRE_SALE'
}

export type PowerUp = {
    id: string;
    type: PowerUpType;
    mesh: BABYLON.TransformNode;
    position: BABYLON.Vector3;
    spawnTime: number;
    isCollected: boolean;
};

export interface PendingPowerUp {
    id: string;
    type: PowerUpType;
    position: BABYLON.Vector3;
    spawnTime: number;
}

// --- LOGICAL STATE SLICES ---

export interface GameFlowState {
    hasStarted: boolean;
    isPaused: boolean;
    isDebugMode?: boolean;
    isConsoleOpen?: boolean;
    isGodMode?: boolean;
    isNoclip?: boolean;
    startTime: number;
    isSpectating: boolean;
    isGameOver: boolean;
    currentMapId: string;
    isHostLoaded?: boolean;
    mapLoadGeneration: number;
    interactionMsg: string | null;
    hoverMsg: string | null;
}

export interface RoundState {
    round: number;
    zombiesToSpawn: number;
    zombiesSpawned: number;
    zombiesAlive: number;
    zombiesKilledInRound: number;
    totalZombiesInRound: number;
    lastSpawnTime: number;
    nextRoundTime: number;
    isIntermission: boolean;
    isDogRound: boolean;
    dogRoundStarted?: boolean;
    dogRoundStartTime?: number;
    dogRoundNumber?: number; // Total dog rounds occurred so far
}

export interface PlayerState {
    points: number;
    totalEarnedPoints: number;
    health: number;
    maxHealth: number;
    weapons: WeaponState[];
    activeWeaponIndex: number;

    isReloading: boolean;
    isFiring: boolean;
    isAiming: boolean;
    isKnifing: boolean;
    lastShotTime: number;
    isPackAPunching: boolean;
    weaponFiredThisTriggerPull: boolean;

    kills: number;
    shots: number;

    lastDamageTime: number;
    lastRegenTime: number;

    // Perks (Generic System - State tracking)
    perkStates: Record<string, boolean>;

    isDowned: boolean;
    downedStartTime: number;
    downedTimeLimit: number;
    isBeingRevived: boolean;
    isRevivingTeammate: boolean;
    reviveProgress: number;
    quickRevivesRemaining: number;

    /** Weapons saved when entering downed state, restored on revive */
    savedWeapons: WeaponState[] | null;
    savedActiveWeaponIndex: number;

    playerName: string;
}

export interface PhysicsState {
    isGrounded: boolean;
    verticalVelocity: number;
    currentVelocity: BABYLON.Vector3;
    /** External force applied by other systems (e.g., knockback). Applied and decayed by PlayerMovementSystem. */
    externalForce: BABYLON.Vector3;
    /** Accumulated camera recoil pitch offset (radians, decays over time) */
    recoilOffsetX: number;
    /** Accumulated camera recoil yaw offset (radians, decays over time) */
    recoilOffsetY: number;
    /** Current recoil recovery speed (radians/sec), set per weapon */
    recoilRecoverySpeed: number;
    /** Screen shake intensity (decays per frame) */
    screenShakeIntensity: number;
    /** Weapon mesh kick trigger — set true by CombatSystem, consumed by WeaponViewSystem */
    weaponKickTrigger: { kickBackZ: number; kickRotX: number } | null;
}

export interface WorldState {
    // Detailed states
    doorStates: Record<string, DoorState>;
    windowBarriers: Record<string, WindowBarrierState>;
    perkStates: Record<string, boolean>;
    interactableStates: Record<string, boolean>;
    powerOn: boolean;

    lastDeathPos: BABYLON.Vector3 | null;
    activePowerUps: Partial<Record<PowerUpType, number>>;
    repairPointsRound: number;
    lastRepairTime: number;

    powerUps: PowerUp[];
    pendingPowerUps: PendingPowerUp[];
}

export interface AssetsState {
    weaponMeshes: { [key: string]: BABYLON.TransformNode };
    knifeMesh: BABYLON.AbstractMesh | null;
}

export type GameStateData = GameFlowState & RoundState & PlayerState & PhysicsState & WorldState & AssetsState;

export interface GameContext {
    scene: React.MutableRefObject<BABYLON.Scene | null>;
    camera: React.MutableRefObject<BABYLON.UniversalCamera | null>;
    gameEngine: React.MutableRefObject<GameEngine | null>;

    stateManager: React.MutableRefObject<StateManager | null>;

    mysteryBoxSystem: React.MutableRefObject<MysteryBoxSystem | null>;
    inputManager: React.MutableRefObject<InputManager | null>;

    gameMode: React.MutableRefObject<string>;
    connectionStatus: React.MutableRefObject<string>;
    navPlugin: React.MutableRefObject<BABYLON.RecastJSPlugin | undefined>;

    remotePlayer: {
        visual: React.MutableRefObject<RemotePlayerVisuals | null>;
        name: React.MutableRefObject<string>;
        weaponId: React.MutableRefObject<string>;
    };

    map: {
        powerDoor: React.MutableRefObject<BABYLON.Mesh | null>;
        powerSwitch: React.MutableRefObject<BABYLON.TransformNode | null>;
        powerDoorObserver: React.MutableRefObject<BABYLON.Observer<BABYLON.Scene> | null>;
    };
}

export interface ZombieSyncData {
    id: string;
    type?: string;
    x: number;
    y: number;
    z: number;
    rot: number;
    isBurning?: boolean;
    health?: number;
    maxHealth?: number;
    isCrawling?: boolean;
}

export type GameMessage =
    | { type: 'READY'; name: string }
    | { type: 'START_GAME'; mapId: string }
    | { type: 'PING' }
    | {
        type: 'STATE';
        /** Monotonic sequence number for gap detection. */
        _seq: number;
        /** Present and true on full snapshots; absent on delta packets. */
        _full?: boolean;
        // All payload fields optional – absent means "unchanged since last full sync".
        doors?: Record<string, DoorState>;
        hostPos?: StoredPos;
        activeWeaponIndex?: number;
        activeWeaponId?: string;
        hostHealth?: number;
        hostPoints?: number;
        hostTotalEarned?: number;
        hostName?: string;
        hostPerks?: Record<string, boolean>;
        hostIsDowned?: boolean;
        hostIsSpectating?: boolean;
        hostKills?: number;
        hostShots?: number;
        /** Only zombies that moved or are new since the last tick. */
        zombies?: ZombieSyncData[];
        /** IDs of zombies that have died since the last tick. */
        removedZombieIds?: string[];
        windowStates?: Record<string, number>;
        activeZombiesCount?: number;
        totalRoundZombies?: number;
        zombiesSpawned?: number;
        zombiesKilledInRound?: number;
        round?: number;
        powerOn?: boolean;
        isDogRound?: boolean;
        isGameOver?: boolean;
        activePowerUps?: PowerUpType[];
        mysteryBox?: {
            state: number;
            locIndex: number;
            lidAngle: number;
            weaponId: string | null;
            rollIndex: number;
            owner: string | null;
        };
    }
    | {
        type: 'INPUT';
        /** Monotonic sequence number for gap detection. */
        _seq: number;
        /** Present and true on full snapshots; absent on delta packets. */
        _full?: boolean;
        // All payload fields optional – absent means "unchanged since last full sync".
        pos?: StoredPos;
        activeWeaponIndex?: number;
        activeWeaponId?: string;
        clientHealth?: number;
        clientPoints?: number;
        clientTotalEarned?: number;
        clientPerks?: Record<string, boolean>;
        clientIsDowned?: boolean;
        clientIsSpectating?: boolean;
        clientName?: string;
        clientKills?: number;
        clientShots?: number;
    }
    | {
        type: 'SHOOT';
        origin: { x: number; y: number; z: number };
        dir: { x: number; y: number; z: number };
        isPacked?: boolean;
        isExplosive?: boolean;
        damage: number;
        owner?: 'HOST' | 'CLIENT';
        speed?: number;
        splashRadius?: number;
        splashDamage?: number;
        selfDamageMultiplier?: number;
    }
    | { type: 'INTERACT_DOOR'; doorId: string }
    | { type: 'INTERACT_PERK'; perkId: string; perkType: string; cost: number }
    | { type: 'INTERACT_WALL_BUY'; weaponId: string; cost: number }
    | { type: 'INTERACT_PACK_A_PUNCH'; weaponId: string; cost: number }
    | { type: 'INTERACT_POWER' }
    | { type: 'INTERACT_WINDOW'; targetId: string }
    | { type: 'SPAWN_POWERUP'; id: string; pType: PowerUpType; x: number; y: number; z: number }
    | { type: 'ACTIVATE_POWERUP_EFFECT'; pType: PowerUpType }
    | { type: 'INTERACT_BOX' }
    | { type: 'INTERACT_BOX_START'; playerName: string; locIndex?: number; isFireSale?: boolean }
    | { type: 'INTERACT_BOX_TAKE'; playerName: string }
    | { type: 'HIT_CONFIRM'; amount: number }
    | { type: 'RESPAWN'; round: number; points: number }
    | { type: 'PLAYER_DOWNED'; playerName: string; position: { x: number; y: number; z: number } }
    | { type: 'ZOMBIE_DAMAGE'; amount: number; isHellhound: boolean }
    | { type: 'REVIVE_START'; revivorName: string; downedPlayerName: string }
    | { type: 'REVIVE_CANCEL'; revivorName: string }
    | { type: 'REVIVE_COMPLETE'; revivorName: string; downedPlayerName: string }
    | { type: 'SELF_REVIVE'; playerName: string }
    | { type: 'HOST_LOADED' }
    | { type: 'POINTS_UPDATE'; points: number; totalEarned: number }
    | { type: 'INTERACT_REJECT'; interactionType: string; points: number }
    | { type: 'WALL_BUY_CONFIRM'; weaponId: string }
    | { type: 'PERK_CONFIRM'; perkId: string; perkType: string }
    | { type: 'PACK_A_PUNCH_CONFIRM'; weaponId: string }
    | { type: 'BOX_TAKE_CONFIRM'; weaponId: string }
    | { type: 'CLIENT_ZOMBIE_HIT'; zombieId: string; damage: number; isHeadshot: boolean; isLegHit: boolean; meshName: string }
    | { type: 'CLIENT_EXPLOSION_HIT'; x: number; y: number; z: number; splashRadius: number; splashDamage: number; selfDamageMultiplier?: number; isPacked: boolean };
