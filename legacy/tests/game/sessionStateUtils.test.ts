import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { StateManager } from '../../state/StateManager';
import { GameEngine } from '../../game/GameEngine';
import { ResourceManager } from '../../managers/ResourceManager';
import {
    createMenuStoreState,
    createSessionStartStoreState,
    getSessionStartPoints,
    resetEngineSessionState,
    startEngineSessionState,
} from '../../game/sessionStateUtils';

describe('sessionStateUtils', () => {
    let stateManager: StateManager;

    beforeEach(() => {
        const engine = new BABYLON.NullEngine();
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.UniversalCamera('camera', BABYLON.Vector3.Zero(), scene);

        stateManager = new StateManager(
            scene,
            camera,
            { activeProjectiles: [] } as unknown as GameEngine,
            {} as ResourceManager,
            vi.fn(),
            vi.fn(),
            vi.fn(),
        );
    });

    it('uses map-specific starting points when present', () => {
        expect(getSessionStartPoints('map_test')).toBe(20000);
        expect(getSessionStartPoints('warehouse')).toBe(500);
    });

    it('builds consistent menu store defaults', () => {
        const state = createMenuStoreState();

        expect(state.player.points).toBe(500);
        expect(state.player.health).toBe(100);
        expect(state.player.weaponName).toBe('M1911');
        expect(state.game.round).toBe(1);
        expect(state.game.showFade).toBe(false);
        expect(state.remote.remotePoints).toBe(500);
    });

    it('builds consistent start-of-session store state', () => {
        const state = createSessionStartStoreState('map_test', 'HOST', 'Tester');

        expect(state.player.playerName).toBe('Tester');
        expect(state.player.points).toBe(20000);
        expect(state.player.totalEarnedPoints).toBe(20000);
        expect(state.game.gameMode).toBe('HOST');
        expect(state.game.round).toBe(0);
        expect(state.game.showFade).toBe(true);
        expect(state.remote?.remotePoints).toBe(20000);
    });

    it('resets engine session state back to menu defaults', () => {
        stateManager.gameState.hasStarted = true;
        stateManager.gameState.playerName = 'Runner';
        stateManager.gameState.points = 1234;
        stateManager.gameState.totalEarnedPoints = 5678;
        stateManager.gameState.round = 9;
        stateManager.gameState.isGameOver = true;
        stateManager.gameState.perkStates = { juggernog: true };
        stateManager.gameState.doorStates = { a: { isOpen: true, cost: 10, connectsZones: [1, 2] } };

        resetEngineSessionState(stateManager);

        expect(stateManager.gameState.hasStarted).toBe(false);
        expect(stateManager.gameState.round).toBe(1);
        expect(stateManager.gameState.points).toBe(500);
        expect(stateManager.gameState.totalEarnedPoints).toBe(500);
        expect(stateManager.gameState.isGameOver).toBe(false);
        expect(stateManager.gameState.perkStates).toEqual({});
        expect(stateManager.gameState.doorStates).toEqual({});
        expect(stateManager.gameState.weapons).toHaveLength(1);
        expect(stateManager.gameState.weapons[0].id).toBe('pistol');
    });

    it('applies start-of-session engine state with map-derived points', () => {
        startEngineSessionState(stateManager, 'Tester', 20000, 1000);

        expect(stateManager.gameState.hasStarted).toBe(true);
        expect(stateManager.gameState.startTime).toBe(1000);
        expect(stateManager.gameState.isIntermission).toBe(true);
        expect(stateManager.gameState.nextRoundTime).toBe(9000);
        expect(stateManager.gameState.round).toBe(0);
        expect(stateManager.gameState.playerName).toBe('Tester');
        expect(stateManager.gameState.points).toBe(20000);
        expect(stateManager.gameState.totalEarnedPoints).toBe(20000);
        expect(stateManager.gameState.weapons[0].id).toBe('pistol');
    });
});
