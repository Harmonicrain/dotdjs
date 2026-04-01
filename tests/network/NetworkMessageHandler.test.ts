import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createNetworkMessageHandler } from '../../network/NetworkMessageHandler';
import { StateManager } from '../../state/StateManager';

const createStateManager = () => {
    const scene = new BABYLON.Scene(new BABYLON.NullEngine());
    const camera = new BABYLON.UniversalCamera('camera', BABYLON.Vector3.Zero(), scene);
    const gameEngine = { activeProjectiles: [], releaseProjectile: vi.fn(), spawnProjectile: vi.fn() } as any;
    const resourceManager = {} as any;
    const updatePlayer = vi.fn();
    const updateGame = vi.fn();
    const send = vi.fn();
    const sm = new StateManager(scene, camera, gameEngine, resourceManager, send, updatePlayer, updateGame);
    sm.timerManager.schedule = vi.fn();
    return { sm, updatePlayer, updateGame };
};

const createActions = () => ({
    updateGame: vi.fn(),
    updateRemote: vi.fn(),
    setIsClientReady: vi.fn(),
    setRemotePlayerName: vi.fn(),
    setSelectedMap: vi.fn(),
    startGameLocal: vi.fn(),
    setInteractionMsg: vi.fn(),
});

describe('NetworkMessageHandler', () => {
    let sm: StateManager;
    let actions: ReturnType<typeof createActions>;
    let handler: ReturnType<typeof createNetworkMessageHandler>;

    beforeEach(() => {
        ({ sm } = createStateManager());
        actions = createActions();
        handler = createNetworkMessageHandler(sm, actions);
    });

    it('ignores respawn messages when the local client is healthy', () => {
        const emitSpy = vi.spyOn(sm.eventBus, 'emit');
        sm.gameState.health = 100;
        sm.gameState.isDowned = false;
        sm.gameState.isSpectating = false;

        handler.handleMessage({ type: 'RESPAWN', round: 2, points: 1000 });

        expect(emitSpy).not.toHaveBeenCalledWith('RESPAWN_REQUEST', expect.anything());
        expect(actions.updateGame).not.toHaveBeenCalledWith(expect.objectContaining({ round: 2 }));
    });

    it('ignores respawn messages when the local client is only downed', () => {
        const emitSpy = vi.spyOn(sm.eventBus, 'emit');
        sm.gameState.health = 0;
        sm.gameState.isDowned = true;
        sm.gameState.isSpectating = false;

        handler.handleMessage({ type: 'RESPAWN', round: 2, points: 1000 });

        expect(emitSpy).not.toHaveBeenCalledWith('RESPAWN_REQUEST', expect.anything());
        expect(actions.updateGame).not.toHaveBeenCalledWith(expect.objectContaining({ round: 2 }));
    });

    it('applies respawn messages when the local client is spectating', () => {
        const emitSpy = vi.spyOn(sm.eventBus, 'emit');
        sm.gameState.health = 0;
        sm.gameState.isDowned = false;
        sm.gameState.isSpectating = true;

        handler.handleMessage({ type: 'RESPAWN', round: 2, points: 1000 });

        expect(emitSpy).toHaveBeenCalledWith('RESPAWN_REQUEST', { round: 2, points: 1000 });
        expect(actions.updateGame).toHaveBeenCalledWith({ round: 2 });
    });

    it('applies isGameOver and round progress fields from state packets', () => {
        const emitSpy = vi.spyOn(sm.eventBus, 'emit');

        handler.handleMessage({
            type: 'STATE',
            _seq: 1,
            _full: true,
            hostPos: { x: 1, y: 2, z: 3, rot: 4, pitch: 5 },
            doors: {},
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            hostHealth: 90,
            hostPoints: 1200,
            hostTotalEarned: 1500,
            hostName: 'RemoteHost',
            hostPerks: {},
            hostIsDowned: false,
            hostIsSpectating: false,
            hostKills: 10,
            hostShots: 20,
            zombies: [],
            removedZombieIds: [],
            windowStates: {},
            activeZombiesCount: 5,
            totalRoundZombies: 24,
            zombiesSpawned: 9,
            zombiesKilledInRound: 7,
            round: 3,
            powerOn: true,
            isDogRound: false,
            isGameOver: true,
            activePowerUps: [],
            mysteryBox: { state: 0, locIndex: 0, lidAngle: 0, weaponId: null, rollIndex: 0, owner: null },
        });

        expect(actions.updateGame).toHaveBeenCalledWith({
            round: 3,
            isDogRound: false,
            activeZombiesCount: 5,
            totalRoundZombies: 24,
            zombiesSpawned: 9,
            zombiesKilledInRound: 7,
            zombiesToSpawn: 15,
            powerOn: true,
            isGameOver: true,
        });
        expect(emitSpy).toHaveBeenCalledWith(
            'NET_GAME_STATE_UPDATE',
            expect.objectContaining({
                round: 3,
                zombiesSpawned: 9,
                zombiesKilledInRound: 7,
                isGameOver: true,
            })
        );
    });

    it('ignores gapped host deltas until the next full sync arrives', () => {
        handler.handleMessage({
            type: 'STATE',
            _seq: 1,
            _full: true,
            hostPos: { x: 0, y: 0, z: 0, rot: 0, pitch: 0 },
            doors: {},
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            hostHealth: 100,
            hostPoints: 500,
            hostTotalEarned: 500,
            hostName: 'RemoteHost',
            hostPerks: {},
            hostIsDowned: false,
            hostIsSpectating: false,
            hostKills: 0,
            hostShots: 0,
            zombies: [],
            removedZombieIds: [],
            windowStates: {},
            activeZombiesCount: 0,
            totalRoundZombies: 6,
            zombiesSpawned: 2,
            zombiesKilledInRound: 1,
            round: 1,
            powerOn: false,
            isDogRound: false,
            isGameOver: false,
            activePowerUps: [],
            mysteryBox: { state: 0, locIndex: 0, lidAngle: 0, weaponId: null, rollIndex: 0, owner: null },
        });

        handler.handleMessage({
            type: 'STATE',
            _seq: 3,
            round: 8,
            zombiesSpawned: 99,
            zombiesKilledInRound: 77,
            totalRoundZombies: 100,
            isGameOver: true,
        });

        expect(actions.updateGame).not.toHaveBeenCalledWith(expect.objectContaining({ round: 8 }));

        handler.handleMessage({
            type: 'STATE',
            _seq: 4,
            _full: true,
            hostPos: { x: 10, y: 0, z: 0, rot: 0, pitch: 0 },
            doors: {},
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            hostHealth: 80,
            hostPoints: 900,
            hostTotalEarned: 1100,
            hostName: 'RemoteHost',
            hostPerks: {},
            hostIsDowned: false,
            hostIsSpectating: false,
            hostKills: 4,
            hostShots: 9,
            zombies: [],
            removedZombieIds: [],
            windowStates: {},
            activeZombiesCount: 3,
            totalRoundZombies: 12,
            zombiesSpawned: 5,
            zombiesKilledInRound: 2,
            round: 2,
            powerOn: false,
            isDogRound: false,
            isGameOver: false,
            activePowerUps: [],
            mysteryBox: { state: 0, locIndex: 0, lidAngle: 0, weaponId: null, rollIndex: 0, owner: null },
        });

        expect(actions.updateGame).toHaveBeenLastCalledWith({
            round: 2,
            isDogRound: false,
            activeZombiesCount: 3,
            totalRoundZombies: 12,
            zombiesSpawned: 5,
            zombiesKilledInRound: 2,
            zombiesToSpawn: 7,
            powerOn: false,
            isGameOver: false,
        });
    });

    it('ignores gapped client deltas until the next full sync arrives', () => {
        handler.handleMessage({
            type: 'INPUT',
            _seq: 1,
            _full: true,
            pos: { x: 1, y: 2, z: 3, rot: 4, pitch: 5 },
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            clientHealth: 100,
            clientPoints: 500,
            clientTotalEarned: 500,
            clientPerks: {},
            clientIsDowned: false,
            clientIsSpectating: false,
            clientName: 'RemoteClient',
            clientKills: 0,
            clientShots: 0,
        });

        handler.handleMessage({
            type: 'INPUT',
            _seq: 3,
            clientName: 'CorruptedName',
            clientPoints: 9999,
        });

        expect(actions.updateRemote).not.toHaveBeenCalledWith(expect.objectContaining({ remotePlayerName: 'CorruptedName' }));

        handler.handleMessage({
            type: 'INPUT',
            _seq: 4,
            _full: true,
            pos: { x: 6, y: 7, z: 8, rot: 9, pitch: 10 },
            activeWeaponIndex: 1,
            activeWeaponId: 'rifle',
            clientHealth: 75,
            clientPoints: 1200,
            clientTotalEarned: 1500,
            clientPerks: { juggernog: true },
            clientIsDowned: false,
            clientIsSpectating: false,
            clientName: 'RecoveredClient',
            clientKills: 12,
            clientShots: 30,
        });

        expect(actions.updateRemote).toHaveBeenLastCalledWith({
            remoteHealth: 75,
            remotePoints: 1200,
            remoteTotalEarnedPoints: 1500,
            remoteKills: 12,
            remoteShots: 30,
            remotePerks: { juggernog: true },
            remotePlayerName: 'RecoveredClient',
        });
    });

    it('resets remote state and clears interpolation buffer on GAME_STARTED', () => {
        const pushSpy = vi.spyOn(sm.remote.interpolationBuffer, 'push');
        const clearSpy = vi.spyOn(sm.remote.interpolationBuffer, 'clear');

        handler.handleMessage({
            type: 'INPUT',
            _seq: 1,
            _full: true,
            pos: { x: 1, y: 2, z: 3, rot: 4, pitch: 5 },
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            clientHealth: 70,
            clientPoints: 900,
            clientTotalEarned: 1200,
            clientPerks: { juggernog: true },
            clientIsDowned: true,
            clientIsSpectating: false,
            clientName: 'RemoteClient',
            clientKills: 4,
            clientShots: 11,
        });

        sm.remote.name = 'ExistingRemote';
        sm.gameState.playerName = 'LocalPlayer';
        sm.gameModeRef.current = 'HOST';
        sm.eventBus.emit('GAME_STARTED', { startPoints: 750 });

        expect(clearSpy).toHaveBeenCalled();
        expect(pushSpy).toHaveBeenCalledTimes(1);
        expect(sm.remote.gameState.health).toBe(100);
        expect(sm.remote.gameState.points).toBe(750);
        expect(sm.remote.gameState.isDowned).toBe(false);
        expect(sm.remote.gameState.perks).toEqual({});
        expect(actions.updateRemote).toHaveBeenLastCalledWith({
            remotePoints: 750,
            remoteTotalEarnedPoints: 750,
            remoteHealth: 100,
            remoteKills: 0,
            remoteShots: 0,
            remotePerks: {},
            remotePlayerName: 'ExistingRemote',
        });
    });

    it('stops responding to GAME_STARTED after dispose', () => {
        handler.dispose();

        sm.eventBus.emit('GAME_STARTED', { startPoints: 999 });

        expect(actions.updateRemote).not.toHaveBeenCalled();
    });

    it('validates client perk purchases with shared points logic', () => {
        const sendSpy = vi.spyOn(sm, 'send');

        handler.handleMessage({
            type: 'INPUT',
            _seq: 1,
            _full: true,
            pos: { x: 0, y: 0, z: 0, rot: 0, pitch: 0 },
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            clientHealth: 100,
            clientPoints: 1200,
            clientTotalEarned: 1600,
            clientPerks: {},
            clientIsDowned: false,
            clientIsSpectating: false,
            clientName: 'RemoteClient',
            clientKills: 0,
            clientShots: 0,
        });

        handler.handleMessage({ type: 'INTERACT_PERK', perkId: 'juggernog', perkType: 'juggernog', cost: 1000 });

        expect(sendSpy).toHaveBeenNthCalledWith(1, { type: 'POINTS_UPDATE', points: 200, totalEarned: 1600 });
        expect(sendSpy).toHaveBeenNthCalledWith(2, { type: 'PERK_CONFIRM', perkId: 'juggernog', perkType: 'juggernog' });
    });

    it('rejects unaffordable client perk purchases', () => {
        const sendSpy = vi.spyOn(sm, 'send');

        handler.handleMessage({
            type: 'INPUT',
            _seq: 1,
            _full: true,
            pos: { x: 0, y: 0, z: 0, rot: 0, pitch: 0 },
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            clientHealth: 100,
            clientPoints: 400,
            clientTotalEarned: 900,
            clientPerks: {},
            clientIsDowned: false,
            clientIsSpectating: false,
            clientName: 'RemoteClient',
            clientKills: 0,
            clientShots: 0,
        });

        handler.handleMessage({ type: 'INTERACT_PERK', perkId: 'juggernog', perkType: 'juggernog', cost: 1000 });

        expect(sendSpy).toHaveBeenCalledWith({ type: 'INTERACT_REJECT', interactionType: 'PERK', points: 400 });
        expect(sendSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'PERK_CONFIRM' }));
    });
});
