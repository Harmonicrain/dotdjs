
import * as BABYLON from '@babylonjs/core';
import { GameMessage, PowerUpType, GameStateData, WindowBarrier, MysteryBox, ZombieSyncData } from '../types/index';
import { EventBus } from '../engine/EventBus';
import { System } from '../types/systems';
import { SYNC_CONFIG } from '../config';
import { NetworkDeltaCompressor } from '../network/NetworkDeltaCompressor';
import { Zombie } from '../types/entities';

export interface INetworkContext {
    gameState: GameStateData;
    camera: BABYLON.UniversalCamera;
    gameModeRef: { current: string };
    eventBus: EventBus;
    windows: WindowBarrier[];
    zombies: Zombie[];
    mysteryBox: MysteryBox;
    send(data: GameMessage): void;
}

/**
 * NetworkSystem
 *
 * Runs at a fixed 20 Hz tick (SYNC_CONFIG.NETWORK_TICK_MS = 50 ms).
 * Uses NetworkDeltaCompressor to send only fields that changed since the
 * last tick, with a forced full snapshot every FULL_SYNC_INTERVAL_MS ms
 * to guard against delta drift on packet loss.
 *
 * Event messages (SHOOT, INTERACT_*, PLAYER_DOWNED, etc.) are fired
 * immediately from their originating systems and are never touched here.
 */
export const createNetworkSystem = (ctx: INetworkContext): System => {
    const lastSendRef = { current: 0 };
    const compressor = new NetworkDeltaCompressor();

    let windowStatesCache: Record<string, number> = {};
    let windowsDirty = true;

    const _zombiesSnapshot: ZombieSyncData[] = [];
    const _activePowerUpTypes: PowerUpType[] = [];

    // Reset compressor snapshot whenever a new game session begins so we
    // never diff against state from a previous play-through.
    const gameStartedHandler = () => {
        compressor.reset();
        windowsDirty = true;
    };
    ctx.eventBus.on('GAME_STARTED', gameStartedHandler);

    // Listen for board changes to mark windows dirty
    const boardStateChangeHandler = () => {
        windowsDirty = true;
        compressor.markHostDirty('windows');
    };
    ctx.eventBus.on('BOARD_STATE_CHANGE', boardStateChangeHandler);

    // Door state changes when a door open request is processed.
    // Marking dirty here is safe even if the request is ultimately rejected —
    // the comparison will just confirm no change and clear the flag again.
    const doorOpenRequestHandler = () => {
        compressor.markHostDirty('doors');
    };
    ctx.eventBus.on('DOOR_OPEN_REQUEST', doorOpenRequestHandler);

    return {
        name: 'network',

        update: (_dt: number, now: number) => {
            if (!ctx.gameState.hasStarted) return;

            const camera = ctx.camera;
            if (!camera) return;

            // Fixed-rate gate – skip frames that fall inside the current tick window
            if (now - lastSendRef.current <= SYNC_CONFIG.NETWORK_TICK_MS) return;
            lastSendRef.current = now;

            const mode = ctx.gameModeRef.current;
            const gameState = ctx.gameState;

            if (!gameState.weapons || !gameState.weapons[gameState.activeWeaponIndex]) return;

            const currentWeaponId = gameState.weapons[gameState.activeWeaponIndex].id;
            const localName = gameState.playerName || 'Unknown';

            // ── CLIENT → HOST ────────────────────────────────────────────────
            if (mode === 'CLIENT') {
                const delta = compressor.computeClientDelta(now, {
                    pos: {
                        x: camera.position.x, y: camera.position.y, z: camera.position.z,
                        rot: camera.rotation.y, pitch: camera.rotation.x,
                    },
                    activeWeaponIndex: gameState.activeWeaponIndex,
                    activeWeaponId: currentWeaponId,
                    clientHealth: gameState.health,
                    clientPoints: gameState.points,
                    clientTotalEarned: gameState.totalEarnedPoints,
                    clientPerks: gameState.perkStates,
                    clientIsDowned: gameState.isDowned,
                    clientIsSpectating: gameState.isSpectating,
                    clientName: localName,
                    clientKills: gameState.kills,
                    clientShots: gameState.shots,
                });

                ctx.send(delta as GameMessage);

                // ── HOST → CLIENT ────────────────────────────────────────────────
            } else if (mode === 'HOST') {
                // Build window bitmask map only if dirty
                if (windowsDirty) {
                    windowStatesCache = {};
                    ctx.windows.forEach(w => {
                        let mask = 0;
                        w.boards.forEach((b: BABYLON.AbstractMesh, idx: number) => {
                            if (b.isEnabled()) mask |= (1 << idx);
                        });
                        windowStatesCache[w.id] = mask;
                    });
                    windowsDirty = false;
                }

                _activePowerUpTypes.length = 0;
                for (const key in gameState.activePowerUps) {
                    _activePowerUpTypes.push(key as PowerUpType);
                }

                _zombiesSnapshot.length = ctx.zombies.length;
                for (let i = 0; i < ctx.zombies.length; i++) {
                    const z = ctx.zombies[i];
                    if (!_zombiesSnapshot[i]) _zombiesSnapshot[i] = {} as ZombieSyncData;
                    const s = _zombiesSnapshot[i];
                    s.id = z.id;
                    s.type = z.type;
                    s.x = z.mesh.position.x;
                    s.y = z.mesh.position.y;
                    s.z = z.mesh.position.z;
                    // rotationQuaternion takes precedence over rotation in Babylon.js;
                    // extract yaw from the quaternion when it exists (set by applyRotationSmoothing)
                    if (z.mesh.rotationQuaternion) {
                        const q = z.mesh.rotationQuaternion;
                        s.rot = Math.atan2(2 * (q.y * q.w + q.x * q.z), 1 - 2 * (q.x * q.x + q.y * q.y));
                    } else {
                        s.rot = z.mesh.rotation.y;
                    }
                    s.isBurning = z.isBurning;
                    s.health = z.health;
                    s.maxHealth = z.maxHealth;
                    s.isCrawling = !!z.isCrawling;
                }

                const delta = compressor.computeHostDelta(now, {
                    doors: gameState.doorStates,
                    hostPos: {
                        x: camera.position.x, y: camera.position.y, z: camera.position.z,
                        rot: camera.rotation.y, pitch: camera.rotation.x,
                    },
                    activeWeaponIndex: gameState.activeWeaponIndex,
                    activeWeaponId: currentWeaponId,
                    hostHealth: gameState.health,
                    hostPoints: gameState.points,
                    hostTotalEarned: gameState.totalEarnedPoints,
                    hostName: localName,
                    hostPerks: gameState.perkStates,
                    hostIsDowned: gameState.isDowned,
                    hostIsSpectating: gameState.isSpectating,
                    hostKills: gameState.kills,
                    hostShots: gameState.shots,
                    zombies: _zombiesSnapshot,
                    windowStates: windowStatesCache,
                    activeZombiesCount: ctx.zombies.length,
                    totalRoundZombies: gameState.totalZombiesInRound,
                    zombiesSpawned: gameState.zombiesSpawned,
                    zombiesKilledInRound: gameState.zombiesKilledInRound,
                    round: gameState.round,
                    powerOn: gameState.powerOn,
                    isDogRound: gameState.isDogRound,
                    isGameOver: gameState.isGameOver,
                    activePowerUps: _activePowerUpTypes,
                    mysteryBox: {
                        state: ctx.mysteryBox.state,
                        locIndex: ctx.mysteryBox.activeLocationIndex,
                        lidAngle: ctx.mysteryBox.lidAngle,
                        weaponId: ctx.mysteryBox.resultWeaponId,
                        rollIndex: ctx.mysteryBox.currentWeaponIndex,
                        owner: ctx.mysteryBox.ownerName,
                    },
                });

                ctx.send(delta as GameMessage);
            }
        },

        // Clean up EventBus handlers to prevent memory leaks
        dispose: () => {
            ctx.eventBus.off('GAME_STARTED', gameStartedHandler);
            ctx.eventBus.off('BOARD_STATE_CHANGE', boardStateChangeHandler);
            ctx.eventBus.off('DOOR_OPEN_REQUEST', doorOpenRequestHandler);
        }
    };
};
