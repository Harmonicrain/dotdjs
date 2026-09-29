import * as BABYLON from '@babylonjs/core';
import { GameMessage, PowerUpType, ZombieSyncData } from '../types/index';
import { StoredPos, CachedClientState, CachedHostState } from '../types/network';
import { StateManager } from '../state/StateManager';
import { GameFields, RemoteFields } from '../store/useGameStore';
import { handleWeaponPickup } from '../systems/interaction/weaponPickupUtils';
import { applyPackAPunchUpgrade } from '../systems/packAPunchUtils';
import { applyExplosionHit, applyProjectileHit } from '../systems/zombie/zombieDamageUtils';

type StateMessage = Extract<GameMessage, { type: 'STATE' }>;
type InputMessage = Extract<GameMessage, { type: 'INPUT' }>;

const HOST_CACHE_FIELDS: Array<keyof CachedHostState> = [
    'doors', 'hostPos', 'activeWeaponIndex', 'activeWeaponId',
    'hostHealth', 'hostPoints', 'hostTotalEarned', 'hostName',
    'hostPerks', 'hostIsDowned', 'hostKills', 'hostShots',
    'hostIsSpectating', 'windowStates', 'activeZombiesCount',
    'totalRoundZombies', 'zombiesSpawned', 'zombiesKilledInRound',
    'round', 'powerOn', 'isDogRound', 'isGameOver', 'activePowerUps', 'mysteryBox'
];

const CLIENT_CACHE_FIELDS: Array<keyof CachedClientState> = [
    'pos', 'activeWeaponIndex', 'activeWeaponId',
    'clientHealth', 'clientPoints', 'clientTotalEarned',
    'clientPerks', 'clientIsDowned', 'clientName',
    'clientIsSpectating', 'clientKills', 'clientShots'
];

export interface NetworkHandlerActions {
    updateGame: (updates: Partial<GameFields>) => void;
    updateRemote: (updates: Partial<RemoteFields>) => void;
    setIsClientReady: (ready: boolean) => void;
    setRemotePlayerName: (name: string) => void;
    setSelectedMap: (mapId: string) => void;
    startGameLocal: (overrideMode?: string, overrideMapId?: string) => void;
    setInteractionMsg: (msg: string | null) => void;
}

export interface NetworkMessageHandler {
    handleMessage: (msg: GameMessage) => void;
    dispose: () => void;
}

const ZERO_POS = () => ({ x: 0, y: 0, z: 0, rot: 0, pitch: 0 });

function defaultHostCache(startPoints = 0, name = 'Unknown'): CachedHostState {
    return {
        doors: {}, hostPos: ZERO_POS(),
        activeWeaponIndex: 0, activeWeaponId: 'pistol',
        hostHealth: 100, hostPoints: startPoints, hostTotalEarned: startPoints,
        hostName: name, hostPerks: {}, hostIsDowned: false, hostIsSpectating: false,
        hostKills: 0, hostShots: 0, zombies: [], windowStates: {},
        activeZombiesCount: 0, totalRoundZombies: 0,
        zombiesSpawned: 0, zombiesKilledInRound: 0,
        round: 1,
        powerOn: false, isDogRound: false, isGameOver: false, activePowerUps: [],
        mysteryBox: { state: 0, locIndex: 0, lidAngle: 0, weaponId: null, rollIndex: 0, owner: null },
    };
}

function defaultClientCache(startPoints = 0, name = 'Unknown'): CachedClientState {
    return {
        pos: ZERO_POS(), activeWeaponIndex: 0, activeWeaponId: 'pistol',
        clientHealth: 100, clientPoints: startPoints, clientTotalEarned: startPoints,
        clientPerks: {}, clientIsDowned: false, clientIsSpectating: false, clientName: name,
        clientKills: 0, clientShots: 0,
    };
}

function mergeIfDefined<T extends object>(
    target: T,
    source: Record<string, unknown>,
    fields: Array<keyof T>
): void {
    for (const field of fields) {
        if (source[field as string] !== undefined) {
            (target as Record<string, unknown>)[field as string] = source[field as string];
        }
    }
}

function syncRemotePosition(sm: StateManager, pos: StoredPos): void {
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

function syncRemoteGameState(
    sm: StateManager,
    health: number,
    points: number,
    isDowned: boolean,
    isSpectating: boolean,
    kills: number,
    shots: number,
    perks: Record<string, boolean>
): void {
    sm.remote.gameState.health = health;
    sm.remote.gameState.points = points;
    sm.remote.gameState.isDowned = isDowned;
    sm.remote.gameState.isSpectating = isSpectating;
    sm.remote.gameState.kills = kills;
    sm.remote.gameState.shots = shots;
    sm.remote.gameState.perks = perks;
}

export const createNetworkMessageHandler = (
    stateManager: StateManager,
    actions: NetworkHandlerActions,
): NetworkMessageHandler => {
    const sm = stateManager;

    let cachedHost: CachedHostState = defaultHostCache();
    let cachedClient: CachedClientState = defaultClientCache();
    let lastHostSeq = -1;
    let lastClientSeq = -1;

    const updateRemoteUIFromHostCache = (): void => {
        actions.updateRemote({
            remoteHealth: cachedHost.hostHealth,
            remotePoints: cachedHost.hostPoints,
            remoteTotalEarnedPoints: cachedHost.hostTotalEarned,
            remoteKills: cachedHost.hostKills ?? 0,
            remoteShots: cachedHost.hostShots ?? 0,
            remotePerks: cachedHost.hostPerks,
            remotePlayerName: cachedHost.hostName,
        });
    };

    const updateRemoteUIFromClientCache = (): void => {
        actions.updateRemote({
            remoteHealth: cachedClient.clientHealth,
            remotePoints: cachedClient.clientPoints,
            remoteTotalEarnedPoints: cachedClient.clientTotalEarned,
            remoteKills: cachedClient.clientKills ?? 0,
            remoteShots: cachedClient.clientShots ?? 0,
            remotePerks: cachedClient.clientPerks,
            remotePlayerName: cachedClient.clientName,
        });
    };

    const resetRemoteGameState = (startPoints: number): void => {
        sm.remote.interpolationBuffer.clear();
        sm.remote.gameState.points = startPoints;
        sm.remote.gameState.health = 100;
        sm.remote.gameState.isDowned = false;
        sm.remote.gameState.isSpectating = false;
        sm.remote.gameState.kills = 0;
        sm.remote.gameState.shots = 0;
        sm.remote.gameState.perks = {};
    };

    const resetCachesForGameStart = (startPoints: number): void => {
        const currentRemoteName = sm.remote.name;
        const localName = sm.gameState.playerName;

        cachedHost = defaultHostCache(
            startPoints,
            sm.gameModeRef.current === 'HOST' ? localName : currentRemoteName,
        );
        cachedClient = defaultClientCache(
            startPoints,
            sm.gameModeRef.current === 'CLIENT' ? localName : currentRemoteName,
        );

        lastHostSeq = -1;
        lastClientSeq = -1;
        resetRemoteGameState(startPoints);

        actions.updateRemote({
            remotePoints: startPoints,
            remoteTotalEarnedPoints: startPoints,
            remoteHealth: 100,
            remoteKills: 0,
            remoteShots: 0,
            remotePerks: {},
            remotePlayerName: currentRemoteName,
        });
    };

    const gameStartedHandler = (data: { startPoints?: number } | null): void => {
        resetCachesForGameStart(data?.startPoints ?? 0);
    };

    sm.eventBus.on('GAME_STARTED', gameStartedHandler);

    const shouldIgnoreHostDelta = (msg: StateMessage): boolean => {
        if (lastHostSeq !== -1 && msg._seq > lastHostSeq + 1 && !msg._full) {
            lastHostSeq = msg._seq;
            return true;
        }

        lastHostSeq = msg._seq;
        return false;
    };

    const shouldIgnoreClientDelta = (msg: InputMessage): boolean => {
        if (lastClientSeq !== -1 && msg._seq > lastClientSeq + 1 && !msg._full) {
            lastClientSeq = msg._seq;
            return true;
        }

        lastClientSeq = msg._seq;
        return false;
    };

    const sendClientPointsUpdate = (): void => {
        sm.send({
            type: 'POINTS_UPDATE',
            points: cachedClient.clientPoints,
            totalEarned: cachedClient.clientTotalEarned,
        });
    };

    const rejectInteraction = (interactionType: string): void => {
        sm.send({
            type: 'INTERACT_REJECT',
            interactionType,
            points: cachedClient.clientPoints,
        });
    };

    const trySpendClientPoints = (cost: number, interactionType: string): boolean => {
        if (cachedClient.clientPoints < cost) {
            rejectInteraction(interactionType);
            return false;
        }

        cachedClient.clientPoints -= cost;
        sendClientPointsUpdate();
        return true;
    };

    const applyDoorStateUpdates = (doors: StateMessage['doors']): void => {
        if (doors === undefined) return;

        for (const [doorId, doorState] of Object.entries(doors)) {
            const previousState = sm.gameState.doorStates[doorId];
            const wasOpen = previousState?.isOpen ?? false;
            const isOpen = doorState.isOpen;

            sm.gameState.doorStates[doorId] = doorState;

            if (!wasOpen && isOpen) {
                sm.eventBus.emit('DOOR_OPEN_REQUEST', doorId);
            }
        }
    };

    const applyHostZombieDelta = (msg: StateMessage): void => {
        if (msg._full && msg.zombies !== undefined) {
            cachedHost.zombies = msg.zombies;
            return;
        }

        if (msg.removedZombieIds?.length) {
            const removed = new Set<string>(msg.removedZombieIds);
            cachedHost.zombies = cachedHost.zombies.filter(z => !removed.has(z.id));
        }

        if (msg.zombies?.length) {
            const zombieMap = new Map<string, ZombieSyncData>(
                cachedHost.zombies.map(z => [z.id, z]),
            );

            for (const zombie of msg.zombies) {
                zombieMap.set(zombie.id, zombie);
            }

            cachedHost.zombies = Array.from(zombieMap.values());
        }
    };

    const syncRemoteFromHostCache = (): void => {
        syncRemotePosition(sm, cachedHost.hostPos);
        sm.remote.weaponId = cachedHost.activeWeaponId;
        syncRemoteGameState(
            sm,
            cachedHost.hostHealth,
            cachedHost.hostPoints,
            cachedHost.hostIsDowned,
            cachedHost.hostIsSpectating,
            cachedHost.hostKills,
            cachedHost.hostShots,
            cachedHost.hostPerks,
        );
    };

    const syncRemoteFromClientCache = (): void => {
        syncRemotePosition(sm, cachedClient.pos);
        sm.remote.weaponId = cachedClient.activeWeaponId;
        syncRemoteGameState(
            sm,
            cachedClient.clientHealth,
            cachedClient.clientPoints,
            cachedClient.clientIsDowned,
            cachedClient.clientIsSpectating,
            cachedClient.clientKills,
            cachedClient.clientShots,
            cachedClient.clientPerks,
        );
    };

    const handleStateMessage = (msg: StateMessage): void => {
        if (shouldIgnoreHostDelta(msg)) return;

        if (msg._full) {
            cachedHost = defaultHostCache(cachedHost.hostPoints, cachedHost.hostName);
        }

        mergeIfDefined(cachedHost, msg as unknown as Record<string, unknown>, HOST_CACHE_FIELDS);
        applyDoorStateUpdates(msg.doors);

        actions.updateGame({
            round: cachedHost.round,
            isDogRound: cachedHost.isDogRound,
            activeZombiesCount: cachedHost.activeZombiesCount,
            totalRoundZombies: cachedHost.totalRoundZombies,
            zombiesSpawned: cachedHost.zombiesSpawned,
            zombiesKilledInRound: cachedHost.zombiesKilledInRound,
            zombiesToSpawn: cachedHost.totalRoundZombies - cachedHost.zombiesSpawned,
            powerOn: cachedHost.powerOn,
            isGameOver: cachedHost.isGameOver,
        });

        applyHostZombieDelta(msg);
        syncRemoteFromHostCache();
        sm.eventBus.emit('NET_GAME_STATE_UPDATE', cachedHost);
        updateRemoteUIFromHostCache();
    };

    const handleInputMessage = (msg: InputMessage): void => {
        if (shouldIgnoreClientDelta(msg)) return;

        if (msg._full) {
            cachedClient = defaultClientCache(cachedClient.clientPoints, cachedClient.clientName);
        }

        mergeIfDefined(cachedClient, msg as unknown as Record<string, unknown>, CLIENT_CACHE_FIELDS);
        syncRemoteFromClientCache();
        sm.eventBus.emit('NET_CLIENT_INPUT', cachedClient);
        updateRemoteUIFromClientCache();
    };

    const handleReadyMessage = (msg: Extract<GameMessage, { type: 'READY' }>): void => {
        actions.setIsClientReady(true);
        actions.setRemotePlayerName(msg.name);
        sm.remote.name = msg.name;
        sm.remote.visuals?.updateName(msg.name);
        cachedClient.clientName = msg.name;
    };

    const handleClientZombieHit = (msg: Extract<GameMessage, { type: 'CLIENT_ZOMBIE_HIT' }>): void => {
        const hitZombie = sm.zombies.find(z => z.id === msg.zombieId);
        if (hitZombie && !hitZombie.isDead) {
            applyProjectileHit(sm, {
                zombie: hitZombie,
                damage: msg.damage,
                owner: 'CLIENT',
                isHeadshot: msg.isHeadshot,
                isLegHit: msg.isLegHit,
                hitMeshName: msg.meshName,
            });
        }
    };

    const handleClientExplosionHit = (msg: Extract<GameMessage, { type: 'CLIENT_EXPLOSION_HIT' }>): void => {
        const impactPoint = new BABYLON.Vector3(msg.x, msg.y, msg.z);

        for (const zombie of sm.zombies) {
            applyExplosionHit(sm, {
                zombie,
                impactPoint,
                splashRadius: msg.splashRadius,
                splashDamage: msg.splashDamage,
                owner: 'CLIENT',
            });
        }
    };

    const handleDoorInteraction = (msg: Extract<GameMessage, { type: 'INTERACT_DOOR' }>): void => {
        const doorState = sm.gameState.doorStates[msg.doorId];
        if (!doorState || doorState.isOpen) return;

        if (trySpendClientPoints(doorState.cost, 'DOOR')) {
            sm.eventBus.emit('DOOR_OPEN_REQUEST', msg.doorId);
        }
    };

    const handlePerkInteraction = (msg: Extract<GameMessage, { type: 'INTERACT_PERK' }>): void => {
        if (!trySpendClientPoints(msg.cost, 'PERK')) return;

        sm.send({ type: 'PERK_CONFIRM', perkId: msg.perkId, perkType: msg.perkType });
    };

    const handleWallBuyInteraction = (msg: Extract<GameMessage, { type: 'INTERACT_WALL_BUY' }>): void => {
        if (!trySpendClientPoints(msg.cost, 'WALL_BUY')) return;

        sm.send({ type: 'WALL_BUY_CONFIRM', weaponId: msg.weaponId });
    };

    const handlePackAPunchInteraction = (msg: Extract<GameMessage, { type: 'INTERACT_PACK_A_PUNCH' }>): void => {
        if (!sm.gameState.powerOn) {
            rejectInteraction('PACK_A_PUNCH');
            return;
        }

        if (!trySpendClientPoints(msg.cost, 'PACK_A_PUNCH')) return;

        sm.send({ type: 'PACK_A_PUNCH_CONFIRM', weaponId: msg.weaponId });
    };

    const handleWindowInteraction = (msg: Extract<GameMessage, { type: 'INTERACT_WINDOW' }>): void => {
        const windowBarrier = sm.windows.find(win => win.id === msg.targetId);
        if (!windowBarrier) return;

        const disabledBoard = windowBarrier.boards.find((board: BABYLON.AbstractMesh) => !board.isEnabled());
        if (disabledBoard) {
            disabledBoard.setEnabled(true);
        }
    };

    const handleMysteryBoxInteraction = (
        msg: Extract<GameMessage, { type: 'INTERACT_BOX' | 'INTERACT_BOX_START' | 'INTERACT_BOX_TAKE' }>,
    ): void => {
        if (!sm.mysteryBoxSystem) return;

        const playerName = msg.type === 'INTERACT_BOX_START' || msg.type === 'INTERACT_BOX_TAKE'
            ? msg.playerName
            : undefined;

        if (msg.type === 'INTERACT_BOX_START') {
            const isFireSale = !!msg.isFireSale;
            const boxCost = isFireSale ? 10 : sm.configManager.mysteryBox.COST;
            if (!trySpendClientPoints(boxCost, 'BOX')) return;

            const previousLocationIndex = sm.mysteryBox.activeLocationIndex;
            if (isFireSale && msg.locIndex !== undefined) {
                sm.mysteryBox.activeLocationIndex = msg.locIndex;
            }

            const interactResult = sm.mysteryBoxSystem.interact(playerName, boxCost);
            if (!interactResult) {
                sm.mysteryBox.activeLocationIndex = previousLocationIndex;
            }
            return;
        }

        const takeResult = sm.mysteryBoxSystem.interact(playerName);
        if (typeof takeResult === 'string' && takeResult !== 'NO_POINTS') {
            sm.send({ type: 'BOX_TAKE_CONFIRM', weaponId: takeResult });
        }
    };

    const handleZombieDamage = (msg: Extract<GameMessage, { type: 'ZOMBIE_DAMAGE' }>): void => {
        if (sm.gameState.isGodMode || sm.gameState.isDowned || sm.gameState.isGameOver) return;

        const now = Date.now();
        if (now - sm.gameState.lastDamageTime < sm.configManager.gameplay.DAMAGE_IMMUNITY_MS) return;

        sm.gameState.lastDamageTime = now;
        sm.gameState.health = Math.max(0, sm.gameState.health - msg.amount);
        sm.setHealth(sm.gameState.health);
        sm.setFlashColor(msg.isHellhound ? 'rgba(200, 50, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)');
        sm.timerManager.schedule('dmg_flash', sm.configManager.visuals.HIT_FLASH_DURATION * 2, () => sm.setFlashColor(null));

        if (sm.gameState.health > 0 || sm.gameState.isDowned) return;

        const isSolo = sm.gameModeRef.current === 'SOLO';
        const hasQuickRevive = sm.gameState.perkStates['quickRevive'];

        if (isSolo && !hasQuickRevive) {
            sm.setHealth(0);
            sm.setIsGameOver(true);
            return;
        }

        sm.gameState.isDowned = true;
        sm.gameState.downedStartTime = now;
        sm.gameState.downedTimeLimit = sm.configManager.gameplay.DOWNED_BLEED_OUT_TIME;
        sm.setIsDowned(true);
        sm.send({
            type: 'PLAYER_DOWNED',
            playerName: sm.gameState.playerName || 'Unknown',
            position: { x: sm.camera.position.x, y: sm.camera.position.y, z: sm.camera.position.z },
        });
    };

    const handlePerkConfirm = (msg: Extract<GameMessage, { type: 'PERK_CONFIRM' }>): void => {
        sm.gameState.perkStates[msg.perkId] = true;
        sm.setPerks(sm.gameState.perkStates);

        if (msg.perkType === 'juggernog') {
            const juggHealth = sm.configManager.gameplay.PLAYER_JUGG_HEALTH;
            sm.gameState.maxHealth = juggHealth;
            sm.gameState.health = juggHealth;
            sm.setHealth(juggHealth);
        }
    };

    const handlePackAPunchConfirm = (msg: Extract<GameMessage, { type: 'PACK_A_PUNCH_CONFIRM' }>): void => {
        const weapon = sm.gameState.weapons.find(w => w.id === msg.weaponId);
        if (!weapon || !applyPackAPunchUpgrade(weapon, sm.configManager)) return;

        const activeWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        if (activeWeapon === weapon) {
            sm.setAmmo(weapon.currentAmmo);
            sm.setReserveAmmo(weapon.currentReserve);
            sm.setWeaponName(weapon.name);
            sm.setWeaponId(weapon.id);
        }

        sm.setInteractionMsg('WEAPON UPGRADED!');
        sm.timerManager.schedule('pap_msg_clear', sm.configManager.visuals.HUD_MSG_DURATION || 2000, () => sm.setInteractionMsg(null));
    };

    const handleRespawnMessage = (msg: Extract<GameMessage, { type: 'RESPAWN' }>): void => {
        if (!sm.gameState.isSpectating) return;

        actions.updateGame({ round: msg.round });
        sm.eventBus.emit('RESPAWN_REQUEST', { round: msg.round, points: msg.points });
        actions.updateGame({ isSpectating: false });
    };

    const handleMessage = (msg: GameMessage): void => {
        switch (msg.type) {
            case 'READY':
                handleReadyMessage(msg);
                break;

            case 'START_GAME':
                actions.setSelectedMap(msg.mapId);
                actions.startGameLocal('CLIENT', msg.mapId);
                break;

            case 'PING':
                break;

            case 'SHOOT':
                sm.eventBus.emit('REMOTE_SHOOT', msg);
                break;

            case 'CLIENT_ZOMBIE_HIT':
                handleClientZombieHit(msg);
                break;

            case 'CLIENT_EXPLOSION_HIT':
                handleClientExplosionHit(msg);
                break;

            case 'INTERACT_DOOR':
                handleDoorInteraction(msg);
                break;

            case 'INTERACT_PERK':
                handlePerkInteraction(msg);
                break;

            case 'INTERACT_WALL_BUY':
                handleWallBuyInteraction(msg);
                break;

            case 'INTERACT_PACK_A_PUNCH':
                handlePackAPunchInteraction(msg);
                break;

            case 'INTERACT_POWER':
                sm.eventBus.emit('POWER_ON_REQUEST', null);
                break;

            case 'INTERACT_WINDOW':
                handleWindowInteraction(msg);
                break;

            case 'INTERACT_BOX':
            case 'INTERACT_BOX_START':
            case 'INTERACT_BOX_TAKE':
                handleMysteryBoxInteraction(msg);
                break;

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
                sm.powerUpManager?.activatePowerUp(msg.pType as PowerUpType, true);
                break;

            case 'HIT_CONFIRM':
                sm.addPoints(msg.amount);
                break;

            case 'ZOMBIE_DAMAGE':
                handleZombieDamage(msg);
                break;

            case 'POINTS_UPDATE':
                sm.gameState.points = msg.points;
                sm.setPoints(msg.points);
                sm.gameState.totalEarnedPoints = msg.totalEarned;
                sm.setTotalEarnedPoints(msg.totalEarned);
                break;

            case 'INTERACT_REJECT':
                sm.gameState.points = msg.points;
                sm.setPoints(msg.points);
                break;

            case 'WALL_BUY_CONFIRM':
                handleWeaponPickup(sm, msg.weaponId);
                break;

            case 'PERK_CONFIRM':
                handlePerkConfirm(msg);
                break;

            case 'PACK_A_PUNCH_CONFIRM':
                handlePackAPunchConfirm(msg);
                break;

            case 'BOX_TAKE_CONFIRM':
                handleWeaponPickup(sm, msg.weaponId);
                break;

            case 'RESPAWN':
                handleRespawnMessage(msg);
                break;

            case 'PLAYER_DOWNED':
                sm.remote.gameState.isDowned = true;
                actions.setInteractionMsg(`${msg.playerName} IS DOWN!`);
                sm.timerManager.schedule('net_downed_msg_clear', 3000, () => actions.setInteractionMsg(null));
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

            case 'STATE':
                handleStateMessage(msg);
                break;

            case 'INPUT':
                handleInputMessage(msg);
                break;
        }
    };

    return {
        handleMessage,
        dispose: () => {
            sm.eventBus.off('GAME_STARTED', gameStartedHandler);
        },
    };
};
