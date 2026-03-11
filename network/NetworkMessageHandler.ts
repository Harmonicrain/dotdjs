
import * as BABYLON from '@babylonjs/core';
import { GameMessage, PowerUpType, DoorState, ZombieSyncData } from '../types/index';
import { StoredPos } from '../types/network';
import { StateManager } from '../state/StateManager';
import { GameFields, PlayerFields, RemoteFields } from '../store/useGameStore';

export interface NetworkHandlerActions {
    updateGame: (updates: Partial<GameFields>) => void;
    updateRemote: (updates: Partial<RemoteFields>) => void;
    updatePlayer: (updates: Partial<PlayerFields>) => void;

    setIsClientReady: (ready: boolean) => void;
    setRemotePlayerName: (name: string) => void;
    setSelectedMap: (mapId: string) => void;
    startGameLocal: (overrideMode?: string, overrideMapId?: string) => void;

    setInteractionMsg: (msg: string | null) => void;
}

// ── Cached full-state types ───────────────────────────────────────────────────

export interface CachedHostState {
    [key: string]: any;
    doors: Record<string, DoorState>;
    hostPos: StoredPos;
    activeWeaponIndex: number;
    activeWeaponId: string;
    hostHealth: number;
    hostPoints: number;
    hostTotalEarned: number;
    hostName: string;
    hostPerks: Record<string, boolean>;
    hostIsDowned: boolean;
    hostKills: number;
    hostShots: number;
    zombies: ZombieSyncData[];
    windowStates: Record<string, number>;
    activeZombiesCount: number;
    totalRoundZombies: number;
    zombiesSpawned: number;
    zombiesKilledInRound: number;
    round: number;
    powerOn: boolean;
    isDogRound: boolean;
    activePowerUps: PowerUpType[];
    mysteryBox: {
        state: number; locIndex: number; lidAngle: number;
        weaponId: string | null; rollIndex: number; owner: string | null;
    };
}

export interface CachedClientState {
    [key: string]: any;
    pos: StoredPos;
    activeWeaponIndex: number;
    activeWeaponId: string;
    clientHealth: number;
    clientPoints: number;
    clientTotalEarned: number;
    clientPerks: Record<string, boolean>;
    clientIsDowned: boolean;
    clientName: string;
    clientKills: number;
    clientShots: number;
}

// ── Default factories ─────────────────────────────────────────────────────────

const ZERO_POS = () => ({ x: 0, y: 0, z: 0, rot: 0, pitch: 0 });

function defaultHostCache(startPoints = 0, name = 'Unknown'): CachedHostState {
    return {
        doors: {}, hostPos: ZERO_POS(),
        activeWeaponIndex: 0, activeWeaponId: 'pistol',
        hostHealth: 100, hostPoints: startPoints, hostTotalEarned: startPoints,
        hostName: name, hostPerks: {}, hostIsDowned: false,
        hostKills: 0, hostShots: 0, zombies: [], windowStates: {},
        activeZombiesCount: 0, totalRoundZombies: 0,
        zombiesSpawned: 0, zombiesKilledInRound: 0,
        round: 1,
        powerOn: false, isDogRound: false, activePowerUps: [],
        mysteryBox: { state: 0, locIndex: 0, lidAngle: 0, weaponId: null, rollIndex: 0, owner: null },
    };
}

function defaultClientCache(startPoints = 0, name = 'Unknown'): CachedClientState {
    return {
        pos: ZERO_POS(), activeWeaponIndex: 0, activeWeaponId: 'pistol',
        clientHealth: 100, clientPoints: startPoints, clientTotalEarned: startPoints,
        clientPerks: {}, clientIsDowned: false, clientName: name,
        clientKills: 0, clientShots: 0,
    };
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Merges defined fields from source to target for specified field names.
 * Reduces repetitive `if (msg.field !== undefined) cached.field = msg.field;` patterns.
 */
function mergeIfDefined<T extends Record<string, unknown>>(
    target: T,
    source: Record<string, unknown>,
    fields: (keyof T)[]
): void {
    for (const field of fields) {
        if (source[field as string] !== undefined) {
            (target as Record<string, unknown>)[field as string] = source[field as string];
        }
    }
}

/**
 * Syncs remote player position to interpolation buffer and legacy position props.
 */
function syncRemotePosition(
    sm: StateManager,
    pos: StoredPos
): void {
    sm.remote.interpolationBuffer.push({
        timestamp: Date.now(),
        x: pos.x,
        y: pos.y,
        z: pos.z,
        rotY: pos.rot,
        pitch: pos.pitch,
    });

    sm.remote.pos.set(pos.x, pos.y, pos.z);
    sm.remote.rot = pos.rot;
    sm.remote.pitch = pos.pitch;
}

/**
 * Syncs remote player game state (health, downed, kills, shots, perks).
 */
function syncRemoteGameState(
    sm: StateManager,
    health: number,
    points: number,
    isDowned: boolean,
    kills: number,
    shots: number,
    perks: Record<string, boolean>
): void {
    sm.remote.gameState.health = health;
    sm.remote.gameState.points = points;
    sm.remote.gameState.isDowned = isDowned;
    sm.remote.gameState.kills = kills;
    sm.remote.gameState.shots = shots;
    sm.remote.gameState.perks = perks;
}

export const createNetworkMessageHandler = (
    stateManager: StateManager,
    actions: NetworkHandlerActions,
) => {
    let cachedHost: CachedHostState = defaultHostCache();
    let cachedClient: CachedClientState = defaultClientCache();
    let lastHostSeq = -1;
    let lastClientSeq = -1;

    // On game start / restart wipe cached state so a fresh full-sync is required
    stateManager.eventBus.on('GAME_STARTED', (data: { startPoints?: number } | null) => {
        const startPoints = data?.startPoints ?? 0;
        const currentRemoteName = stateManager.remote.name;
        const localName = stateManager.gameState.playerName;

        cachedHost = defaultHostCache(startPoints, stateManager.gameModeRef.current === 'HOST' ? localName : currentRemoteName);
        cachedClient = defaultClientCache(startPoints, stateManager.gameModeRef.current === 'CLIENT' ? localName : currentRemoteName);

        lastHostSeq = -1;
        lastClientSeq = -1;
        stateManager.remote.interpolationBuffer.clear();

        // Ensure remote state is initialized correctly
        stateManager.remote.gameState.points = startPoints;
        stateManager.remote.gameState.health = 100;
        stateManager.remote.gameState.isDowned = false;
        stateManager.remote.gameState.kills = 0;
        stateManager.remote.gameState.shots = 0;
        stateManager.remote.gameState.perks = {};

        actions.updateRemote({
            remotePoints: startPoints,
            remoteTotalEarnedPoints: startPoints,
            remoteHealth: 100,
            remoteKills: 0,
            remoteShots: 0,
            remotePerks: {},
            remotePlayerName: currentRemoteName
        });
    });

    return (msg: GameMessage) => {
        // stateManager may not exist yet during lobby phase for some message types
        if (!stateManager && msg.type !== 'START_GAME' && msg.type !== 'READY') return;
        const sm = stateManager;

        switch (msg.type) {

            // ── Non-tick event messages — completely unchanged ─────────────────

            case 'READY':
                if (msg.name) {
                    actions.setIsClientReady(true);
                    actions.setRemotePlayerName(msg.name);
                    sm.remote.name = msg.name;
                    sm.remote.visuals?.updateName(msg.name);
                    // Update cache so subsequent tick updates don't overwrite with default
                    cachedClient.clientName = msg.name;
                }
                break;

            case 'START_GAME':
                if (msg.mapId) actions.setSelectedMap(msg.mapId);
                actions.startGameLocal('CLIENT', msg.mapId);
                break;

            case 'SHOOT':
                sm.eventBus.emit('REMOTE_SHOOT', msg);
                break;

            case 'INTERACT_DOOR': {
                // HOST validates CLIENT has enough points before opening
                const doorState = sm.gameState.doorStates[msg.doorId];
                if (doorState && !doorState.isOpen) {
                    const clientPoints = cachedClient.clientPoints;
                    if (clientPoints >= doorState.cost) {
                        sm.eventBus.emit('DOOR_OPEN_REQUEST', msg.doorId);
                        // Deduct points from CLIENT's tracked state and confirm
                        const newPoints = clientPoints - doorState.cost;
                        cachedClient.clientPoints = newPoints;
                        sm.send({ type: 'POINTS_UPDATE', points: newPoints, totalEarned: cachedClient.clientTotalEarned });
                    } else {
                        sm.send({ type: 'INTERACT_REJECT', interactionType: 'DOOR', points: clientPoints });
                    }
                }
                break;
            }

            case 'INTERACT_PERK': {
                // HOST validates CLIENT perk purchase
                const perkMsg = msg as any;
                const clientPoints = cachedClient.clientPoints;
                if (clientPoints >= perkMsg.cost) {
                    const newPoints = clientPoints - perkMsg.cost;
                    cachedClient.clientPoints = newPoints;
                    sm.send({ type: 'POINTS_UPDATE', points: newPoints, totalEarned: cachedClient.clientTotalEarned });
                } else {
                    sm.send({ type: 'INTERACT_REJECT', interactionType: 'PERK', points: clientPoints });
                }
                break;
            }

            case 'INTERACT_WALL_BUY': {
                // HOST validates CLIENT wall buy
                const wbMsg = msg as any;
                const clientPoints = cachedClient.clientPoints;
                if (clientPoints >= wbMsg.cost) {
                    const newPoints = clientPoints - wbMsg.cost;
                    cachedClient.clientPoints = newPoints;
                    sm.send({ type: 'POINTS_UPDATE', points: newPoints, totalEarned: cachedClient.clientTotalEarned });
                } else {
                    sm.send({ type: 'INTERACT_REJECT', interactionType: 'WALL_BUY', points: clientPoints });
                }
                break;
            }

            case 'INTERACT_PACK_A_PUNCH': {
                // HOST validates CLIENT Pack-a-Punch
                const papMsg = msg as any;
                const clientPoints = cachedClient.clientPoints;
                if (clientPoints >= papMsg.cost && sm.gameState.powerOn) {
                    const newPoints = clientPoints - papMsg.cost;
                    cachedClient.clientPoints = newPoints;
                    sm.send({ type: 'POINTS_UPDATE', points: newPoints, totalEarned: cachedClient.clientTotalEarned });
                } else {
                    sm.send({ type: 'INTERACT_REJECT', interactionType: 'PACK_A_PUNCH', points: clientPoints });
                }
                break;
            }

            case 'INTERACT_POWER':
                sm.eventBus.emit('POWER_ON_REQUEST', null);
                break;

            case 'INTERACT_WINDOW':
                if (msg.targetId) {
                    const w = sm.windows.find(win => win.id === msg.targetId);
                    if (w) {
                        const disabledBoard = w.boards.find((b: BABYLON.AbstractMesh) => !b.isEnabled());
                        if (disabledBoard) disabledBoard.setEnabled(true);
                    }
                }
                break;

            case 'INTERACT_BOX':
            case 'INTERACT_BOX_START':
            case 'INTERACT_BOX_TAKE': {
                if (sm.mysteryBoxSystem) {
                    const playerName =
                        (msg.type === 'INTERACT_BOX_START' || msg.type === 'INTERACT_BOX_TAKE')
                            ? msg.playerName
                            : undefined;

                    // For BOX_START, validate CLIENT has enough points
                    if (msg.type === 'INTERACT_BOX_START') {
                        const isFireSale = !!msg.isFireSale;
                        const boxCost = isFireSale ? 10 : sm.configManager.mysteryBox.COST;
                        const clientPoints = cachedClient.clientPoints;
                        if (clientPoints >= boxCost) {
                            const newPoints = clientPoints - boxCost;
                            cachedClient.clientPoints = newPoints;
                            const prevLocIdx = sm.mysteryBox.activeLocationIndex;
                            if (isFireSale && msg.locIndex !== undefined) {
                                sm.mysteryBox.activeLocationIndex = msg.locIndex;
                            }
                            sm.send({ type: 'POINTS_UPDATE', points: newPoints, totalEarned: cachedClient.clientTotalEarned });
                            const interactResult = sm.mysteryBoxSystem.interact(playerName, boxCost);
                            if (!interactResult) sm.mysteryBox.activeLocationIndex = prevLocIdx;
                        } else {
                            sm.send({ type: 'INTERACT_REJECT', interactionType: 'BOX', points: clientPoints });
                        }
                    } else {
                        sm.mysteryBoxSystem.interact(playerName);
                    }
                }
                break;
            }

            case 'SPAWN_POWERUP':
                sm.gameState.pendingPowerUps.push({
                    id: msg.id,
                    type: msg.pType,
                    position: new BABYLON.Vector3(msg.x, msg.y, msg.z),
                    spawnTime: Date.now(),
                });
                break;

            case 'ACTIVATE_POWERUP_EFFECT':
                actions.updateGame({ interactionMsg: `${msg.pType.replace('_', ' ')}!` });
                sm.timerManager.schedule('net_powerup_msg_clear', 3000, () => actions.updateGame({ interactionMsg: null }));
                if (sm.powerUpManager) {
                    sm.powerUpManager.activatePowerUp(msg.pType as PowerUpType, true);
                }
                break;

            case 'HIT_CONFIRM':
                sm.addPoints(msg.amount);
                break;

            case 'ZOMBIE_DAMAGE': {
                if (sm.gameState.isGodMode || sm.gameState.isDowned || sm.gameState.isGameOver) break;
                const now = Date.now();
                if (now - sm.gameState.lastDamageTime < sm.configManager.gameplay.DAMAGE_IMMUNITY_MS) break;

                sm.gameState.lastDamageTime = now;
                sm.gameState.health = Math.max(0, sm.gameState.health - msg.amount);
                sm.setHealth(sm.gameState.health);
                sm.setFlashColor(msg.isHellhound ? "rgba(200, 50, 0, 0.4)" : "rgba(255, 0, 0, 0.4)");
                sm.timerManager.schedule('dmg_flash', sm.configManager.visuals.HIT_FLASH_DURATION * 2, () => sm.setFlashColor(null));

                if (sm.gameState.health <= 0 && !sm.gameState.isDowned) {
                    const isSolo = sm.gameModeRef.current === 'SOLO';
                    const hasQuickRevive = sm.gameState.perkStates['quickRevive'];

                    if (isSolo && !hasQuickRevive) {
                        sm.setHealth(0);
                        sm.setIsGameOver(true);
                    } else {
                        sm.gameState.isDowned = true;
                        sm.gameState.downedStartTime = now;
                        sm.gameState.downedTimeLimit = sm.configManager.gameplay.DOWNED_BLEED_OUT_TIME;
                        sm.setIsDowned(true);

                        // Notify others (host) that we went down
                        sm.send({
                            type: 'PLAYER_DOWNED',
                            playerName: sm.gameState.playerName || 'Unknown',
                            position: { x: sm.camera.position.x, y: sm.camera.position.y, z: sm.camera.position.z },
                        });
                    }
                }
                break;
            }

            case 'POINTS_UPDATE':
                // HOST confirmed a purchase — apply the authoritative point value
                sm.gameState.points = msg.points;
                sm.setPoints(msg.points);
                sm.gameState.totalEarnedPoints = msg.totalEarned;
                sm.setTotalEarnedPoints(msg.totalEarned);
                break;

            case 'INTERACT_REJECT':
                // HOST rejected an interaction — sync CLIENT points to HOST's authoritative value
                sm.gameState.points = msg.points;
                sm.setPoints(msg.points);
                break;

            case 'RESPAWN':
                actions.updateGame({ round: msg.round });
                sm.eventBus.emit('RESPAWN_REQUEST', { round: msg.round, points: msg.points });
                actions.updateGame({ isSpectating: false });
                break;

            case 'PLAYER_DOWNED':
                sm.remote.gameState.isDowned = true;
                actions.setInteractionMsg(`${msg.playerName} IS DOWN!`);
                sm.timerManager.schedule('net_downed_msg_clear', 3000, () => actions.setInteractionMsg(null));

                // In multiplayer, if both players are now downed, trigger game over on the host
                if (sm.gameModeRef.current === 'HOST' && sm.gameState.isDowned) {
                    sm.setIsGameOver(true);
                }
                break;

            case 'REVIVE_START':
                sm.eventBus.emit('REVIVE_EVENT', { type: 'START', revivorName: msg.revivorName });
                break;

            case 'REVIVE_CANCEL':
                sm.eventBus.emit('REVIVE_EVENT', { type: 'CANCEL', revivorName: msg.revivorName });
                break;

            case 'REVIVE_COMPLETE':
                sm.eventBus.emit('REVIVE_EVENT', {
                    type: 'COMPLETE',
                    revivorName: msg.revivorName,
                    downedPlayerName: msg.downedPlayerName,
                });
                break;

            case 'SELF_REVIVE':
                sm.remote.gameState.isDowned = false;
                actions.setInteractionMsg(`${msg.playerName} REVIVED SELF`);
                sm.timerManager.schedule('net_self_revive_msg_clear', 2000, () => actions.setInteractionMsg(null));
                break;

            case 'HOST_LOADED':
                sm.gameState.isHostLoaded = true;
                sm.eventBus.emit('HOST_LOADED_RECEIVED', null);
                break;

            // ── Tick messages — delta-aware ────────────────────────────────────

            case 'STATE': {
                const seq: number | undefined = msg._seq;
                const isFull: boolean = !!msg._full;

                // Gap detection: if seq jumped and this isn't a full sync, our delta
                // chain is broken. Reset the cache and wait for the next full sync.
                if (seq !== undefined && lastHostSeq !== -1 && seq > lastHostSeq + 1 && !isFull) {
                    cachedHost = defaultHostCache();
                }
                if (seq !== undefined) lastHostSeq = seq;

                // ── Merge delta fields into the cached host state ──────────────
                mergeIfDefined(cachedHost, msg, [
                    'doors', 'hostPos', 'activeWeaponIndex', 'activeWeaponId',
                    'hostHealth', 'hostPoints', 'hostTotalEarned', 'hostName',
                    'hostPerks', 'hostIsDowned', 'hostKills', 'hostShots',
                    'windowStates', 'activeZombiesCount', 'totalRoundZombies',
                    'zombiesSpawned', 'zombiesKilledInRound', 'round',
                    'powerOn', 'isDogRound', 'activePowerUps', 'mysteryBox'
                ]);

                // ── Sync door states to client game state ───────────────────────
                if (msg.doors !== undefined) {
                    for (const [doorId, doorState] of Object.entries(msg.doors)) {
                        const previousState = sm.gameState.doorStates[doorId];
                        const wasOpen = previousState?.isOpen ?? false;
                        const isOpen = doorState.isOpen;

                        sm.gameState.doorStates[doorId] = doorState;

                        if (!wasOpen && isOpen) {
                            sm.eventBus.emit('DOOR_OPEN_REQUEST', doorId);
                        }
                    }
                }

                // ── Feed merged state to the game ──────────────────────────────
                actions.updateGame({
                    round: cachedHost.round,
                    isDogRound: cachedHost.isDogRound,
                    activeZombiesCount: cachedHost.activeZombiesCount,
                    totalRoundZombies: cachedHost.totalRoundZombies,
                    zombiesSpawned: cachedHost.zombiesSpawned,
                    zombiesKilledInRound: cachedHost.zombiesKilledInRound,
                    zombiesToSpawn: cachedHost.totalRoundZombies - cachedHost.zombiesSpawned,
                    powerOn: cachedHost.powerOn,
                });
                if (isFull && msg.zombies !== undefined) {
                    // Full sync – replace entire list
                    cachedHost.zombies = msg.zombies;
                } else {
                    // Remove dead zombies first
                    if (msg.removedZombieIds?.length) {
                        const removed = new Set<string>(msg.removedZombieIds as string[]);
                        cachedHost.zombies = cachedHost.zombies.filter(z => !removed.has(z.id));
                    }
                    // Upsert moved / new zombies
                    if (msg.zombies?.length) {
                        const map = new Map<string, ZombieSyncData>(
                            cachedHost.zombies.map(z => [z.id, z])
                        );
                        for (const z of msg.zombies as ZombieSyncData[]) {
                            map.set(z.id, z);
                        }
                        cachedHost.zombies = Array.from(map.values());
                    }
                }

                // ── Sync remote player position and state ──────────────────────
                syncRemotePosition(sm, cachedHost.hostPos);
                sm.remote.weaponId = cachedHost.activeWeaponId;
                syncRemoteGameState(
                    sm,
                    cachedHost.hostHealth,
                    cachedHost.hostPoints,
                    cachedHost.hostIsDowned,
                    cachedHost.hostKills,
                    cachedHost.hostShots,
                    cachedHost.hostPerks
                );

                // Emit full merged state for systems (ZombieSystem uses this to sync
                // zombie positions on the client, WeaponViewSystem for remote weapon, etc.)
                sm.eventBus.emit('NET_GAME_STATE_UPDATE', cachedHost);

                actions.updateRemote({
                    remoteHealth: cachedHost.hostHealth,
                    remotePoints: cachedHost.hostPoints,
                    remoteTotalEarnedPoints: cachedHost.hostTotalEarned,
                    remoteKills: cachedHost.hostKills ?? 0,
                    remoteShots: cachedHost.hostShots ?? 0,
                    remotePerks: cachedHost.hostPerks,
                    remotePlayerName: cachedHost.hostName
                });
                break;
            }

            case 'INPUT': {
                const seq: number | undefined = msg._seq;
                const isFull: boolean = !!msg._full;

                // Gap detection for client → host direction
                if (seq !== undefined && lastClientSeq !== -1 && seq > lastClientSeq + 1 && !isFull) {
                    cachedClient = defaultClientCache();
                }
                if (seq !== undefined) lastClientSeq = seq;

                // Merge delta fields
                mergeIfDefined(cachedClient, msg, [
                    'pos', 'activeWeaponIndex', 'activeWeaponId',
                    'clientHealth', 'clientPoints', 'clientTotalEarned',
                    'clientPerks', 'clientIsDowned', 'clientName',
                    'clientKills', 'clientShots'
                ]);

                // Sync remote player position and state
                syncRemotePosition(sm, cachedClient.pos);
                sm.remote.weaponId = cachedClient.activeWeaponId;
                syncRemoteGameState(
                    sm,
                    cachedClient.clientHealth,
                    cachedClient.clientPoints,
                    cachedClient.clientIsDowned,
                    cachedClient.clientKills,
                    cachedClient.clientShots,
                    cachedClient.clientPerks
                );

                // Emit for systems (host uses this for authoritative zombie kill credit, etc.)
                sm.eventBus.emit('NET_CLIENT_INPUT', cachedClient);

                actions.updateRemote({
                    remoteHealth: cachedClient.clientHealth,
                    remotePoints: cachedClient.clientPoints,
                    remoteTotalEarnedPoints: cachedClient.clientTotalEarned,
                    remoteKills: cachedClient.clientKills ?? 0,
                    remoteShots: cachedClient.clientShots ?? 0,
                    remotePerks: cachedClient.clientPerks,
                    remotePlayerName: cachedClient.clientName
                });
                break;
            }
        }
    };
};
