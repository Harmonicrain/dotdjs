import * as BABYLON from '@babylonjs/core';
import { DEFAULT_MAP_ID, GAME_CONFIG, WEAPON_CONFIGS } from '../config';
import { resetPlayerWeapons } from '../engine/weaponResetUtils';
import { MAP_DEFINITIONS } from '../managers/MapRegistry';
import { StateManager } from '../state/StateManager';
import type { GameFields, PlayerFields, RemoteFields } from '../store/useGameStore';

const START_WEAPON = WEAPON_CONFIGS[0];

export const getSessionStartPoints = (mapId: string): number => {
    const mapDef = MAP_DEFINITIONS[mapId] ?? MAP_DEFINITIONS[DEFAULT_MAP_ID];
    return mapDef.config?.gameplay?.STARTING_POINTS ?? GAME_CONFIG.STARTING_POINTS;
};

export const createMenuStoreState = (): {
    player: Partial<PlayerFields>;
    game: Partial<GameFields>;
    remote: Partial<RemoteFields>;
} => ({
    player: {
        points: GAME_CONFIG.STARTING_POINTS,
        totalEarnedPoints: GAME_CONFIG.STARTING_POINTS,
        health: GAME_CONFIG.PLAYER_BASE_HEALTH,
        ammo: START_WEAPON.clipSize,
        reserveAmmo: START_WEAPON.maxReserve,
        activeWeaponIndex: 0,
        weaponName: START_WEAPON.name,
        weaponId: START_WEAPON.id,
        perks: {},
        isDowned: false,
        isBeingRevived: false,
        reviveProgress: 0,
        flashColor: null,
        kills: 0,
        shotsFired: 0,
    },
    game: {
        round: 1,
        showRoundIntro: false,
        activeZombiesCount: 0,
        zombiesSpawned: 0,
        zombiesKilledInRound: 0,
        zombiesToSpawn: 0,
        totalRoundZombies: 0,
        isDogRound: false,
        powerOn: false,
        activePowerUps: {},
        interactionMsg: null,
        hoverMsg: null,
        isPaused: false,
        isSpectating: false,
        isGameOver: false,
        showFade: false,
    },
    remote: {
        remoteHealth: GAME_CONFIG.PLAYER_BASE_HEALTH,
        remotePoints: GAME_CONFIG.STARTING_POINTS,
        remoteTotalEarnedPoints: GAME_CONFIG.STARTING_POINTS,
        remotePerks: {},
        remoteKills: 0,
        remoteShots: 0,
    },
});

export const createSessionStartStoreState = (
    mapId: string,
    mode: 'SOLO' | 'HOST' | 'CLIENT',
    playerName: string,
): {
    player: Partial<PlayerFields>;
    game: Partial<GameFields>;
    remote?: Partial<RemoteFields>;
} => {
    const startPoints = getSessionStartPoints(mapId);

    return {
        player: {
            playerName,
            points: startPoints,
            totalEarnedPoints: startPoints,
            health: GAME_CONFIG.PLAYER_BASE_HEALTH,
            ammo: START_WEAPON.clipSize,
            reserveAmmo: START_WEAPON.maxReserve,
            activeWeaponIndex: 0,
            weaponName: START_WEAPON.name,
            weaponId: START_WEAPON.id,
            perks: {},
            isDowned: false,
            isBeingRevived: false,
            reviveProgress: 0,
            flashColor: null,
            kills: 0,
            shotsFired: 0,
        },
        game: {
            gameMode: mode,
            round: 0,
            showRoundIntro: false,
            activeZombiesCount: 0,
            zombiesSpawned: 0,
            zombiesKilledInRound: 0,
            zombiesToSpawn: 0,
            totalRoundZombies: 0,
            isDogRound: false,
            powerOn: false,
            activePowerUps: {},
            interactionMsg: null,
            hoverMsg: null,
            isPaused: false,
            isSpectating: false,
            isGameOver: false,
            showFade: true,
        },
        remote: mode === 'SOLO' ? undefined : {
            remoteHealth: GAME_CONFIG.PLAYER_BASE_HEALTH,
            remotePoints: startPoints,
            remoteTotalEarnedPoints: startPoints,
            remotePerks: {},
            remoteKills: 0,
            remoteShots: 0,
        },
    };
};

type SessionEngineOptions = {
    startPoints: number;
    playerName?: string;
    hasStarted: boolean;
    round: number;
    isIntermission: boolean;
    nextRoundTime: number;
    startTime: number;
};

const applySharedEngineSessionState = (sm: StateManager, options: SessionEngineOptions): void => {
    const gs = sm.gameState;

    gs.hasStarted = options.hasStarted;
    gs.startTime = options.startTime;
    gs.round = options.round;
    gs.isIntermission = options.isIntermission;
    gs.nextRoundTime = options.nextRoundTime;
    gs.isDogRound = false;
    gs.dogRoundStarted = false;
    gs.dogRoundStartTime = 0;
    gs.isPackAPunching = false;
    gs.isReloading = false;
    gs.isFiring = false;
    gs.isAiming = false;
    gs.isKnifing = false;
    gs.weaponFiredThisTriggerPull = false;
    gs.powerOn = false;
    gs.isGameOver = false;
    gs.isSpectating = false;
    gs.isDowned = false;
    gs.isBeingRevived = false;
    gs.isRevivingTeammate = false;
    gs.reviveProgress = 0;
    gs.quickRevivesRemaining = GAME_CONFIG.MAX_QUICK_REVIVES_SOLO;
    gs.points = options.startPoints;
    gs.totalEarnedPoints = options.startPoints;
    gs.health = GAME_CONFIG.PLAYER_BASE_HEALTH;
    gs.maxHealth = GAME_CONFIG.PLAYER_BASE_HEALTH;
    gs.kills = 0;
    gs.shots = 0;
    gs.lastDamageTime = 0;
    gs.lastRegenTime = 0;
    gs.lastRepairTime = 0;
    gs.lastDeathPos = null;
    gs.perkStates = {};
    gs.repairPointsRound = 0;
    gs.externalForce = BABYLON.Vector3.Zero();
    gs.currentVelocity = BABYLON.Vector3.Zero();
    gs.verticalVelocity = 0;
    gs.recoilOffsetX = 0;
    gs.recoilOffsetY = 0;
    gs.recoilRecoverySpeed = 3.0;
    gs.screenShakeIntensity = 0;
    gs.weaponKickTrigger = null;
    gs.savedWeapons = null;
    gs.savedActiveWeaponIndex = 0;
    gs.zombiesToSpawn = 0;
    gs.zombiesSpawned = 0;
    gs.zombiesAlive = 0;
    gs.zombiesKilledInRound = 0;
    gs.totalZombiesInRound = 0;

    if (options.playerName !== undefined) {
        gs.playerName = options.playerName;
        sm.setPlayerName(options.playerName);
    }

    sm.setRound(options.round);
    sm.setShowRoundIntro(false);
    sm.setIsSpectating(false);
    sm.setIsGameOver(false);
    sm.setIsDowned(false);
    sm.setReviveProgress(0);
    sm.setPoints(options.startPoints);
    sm.setTotalEarnedPoints(options.startPoints);
    sm.setHealth(GAME_CONFIG.PLAYER_BASE_HEALTH);
    sm.setKills(0);
    sm.ui.clearKillEvents();
    sm.setShotsFired(0);
    sm.setPerks({});
    sm.setActiveZombiesCount(0);
    sm.setTotalRoundZombies(0);
    sm.ui.setZombiesToSpawn(0);
    sm.ui.setZombiesSpawned(0);
    sm.ui.setZombiesKilledInRound(0);
    sm.setFlashColor(null);
    sm.setInteractionMsg(null);
    sm.setHoverMsg(null);

    resetPlayerWeapons(sm);
};

export const resetEngineSessionState = (
    sm: StateManager,
    startPoints = GAME_CONFIG.STARTING_POINTS,
): void => {
    sm.gameState.doorStates = {};
    sm.gameState.windowBarriers = {};
    sm.gameState.interactableStates = {};

    applySharedEngineSessionState(sm, {
        startPoints,
        hasStarted: false,
        round: 1,
        isIntermission: false,
        nextRoundTime: 0,
        startTime: 0,
    });
};

export const startEngineSessionState = (
    sm: StateManager,
    playerName: string,
    startPoints: number,
    now = Date.now(),
): void => {
    applySharedEngineSessionState(sm, {
        startPoints,
        playerName,
        hasStarted: true,
        round: 0,
        isIntermission: true,
        nextRoundTime: now + 8_000,
        startTime: now,
    });
};
