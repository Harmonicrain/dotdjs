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
    updatePlayer: vi.fn(),
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

        handler({ type: 'RESPAWN', round: 2, points: 1000 });

        expect(emitSpy).not.toHaveBeenCalledWith('RESPAWN_REQUEST', expect.anything());
        expect(actions.updateGame).not.toHaveBeenCalledWith(expect.objectContaining({ round: 2 }));
    });

    it('applies respawn messages when the local client is downed', () => {
        const emitSpy = vi.spyOn(sm.eventBus, 'emit');
        sm.gameState.health = 0;
        sm.gameState.isDowned = true;

        handler({ type: 'RESPAWN', round: 2, points: 1000 });

        expect(emitSpy).toHaveBeenCalledWith('RESPAWN_REQUEST', { round: 2, points: 1000 });
        expect(actions.updateGame).toHaveBeenCalledWith({ round: 2 });
    });
});
