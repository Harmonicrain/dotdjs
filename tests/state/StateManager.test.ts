
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { StateManager } from '../../state/StateManager';
import { GameEngine } from '../../game/GameEngine';
import { ResourceManager } from '../../managers/ResourceManager';

describe('StateManager', () => {
    let stateManager: StateManager;
    let mockScene: BABYLON.Scene;
    let mockCamera: BABYLON.UniversalCamera;
    let mockGameEngine: GameEngine;
    let mockResourceManager: ResourceManager;
    let mockSend: any;
    let mockUpdatePlayer: any;
    let mockUpdateGame: any;

    beforeEach(() => {
        const engine = new BABYLON.NullEngine();
        mockScene = new BABYLON.Scene(engine);
        mockCamera = new BABYLON.UniversalCamera('camera', BABYLON.Vector3.Zero(), mockScene);
        mockGameEngine = { activeProjectiles: [] } as any;
        mockResourceManager = {} as any;
        mockSend = vi.fn();
        mockUpdatePlayer = vi.fn();
        mockUpdateGame = vi.fn();

        stateManager = new StateManager(
            mockScene,
            mockCamera,
            mockGameEngine,
            mockResourceManager,
            mockSend,
            mockUpdatePlayer,
            mockUpdateGame
        );
    });

    it('should initialize with starting points', () => {
        expect(stateManager.gameState.points).toBe(500); // Default starting points
    });

    it('should add points correctly', () => {
        stateManager.addPoints(100);
        expect(stateManager.gameState.points).toBe(600);
        expect(stateManager.gameState.totalEarnedPoints).toBe(600);
        // UIBridge should be called eventually (throttled)
        // Since we are testing StateManager, we can check if it calls its own setPoints which calls ui.setPoints
    });

    it('should handle damage to local player', () => {
        stateManager.gameModeRef.current = 'SOLO';
        stateManager.gameState.health = 100;
        stateManager.applyDamageToLocalPlayer(30, 'red');
        expect(stateManager.gameState.health).toBe(70);
    });

    it('should trigger game over on death in solo (no quick revive)', () => {
        stateManager.gameModeRef.current = 'SOLO';
        stateManager.gameState.health = 10;
        stateManager.gameState.perkStates['quickRevive'] = false;
        
        stateManager.applyDamageToLocalPlayer(20, 'red');
        
        expect(stateManager.gameState.health).toBe(0);
        expect(stateManager.gameState.isGameOver).toBe(true);
    });

    it('should set downed state instead of game over if player has quick revive in solo', () => {
        stateManager.gameModeRef.current = 'SOLO';
        stateManager.gameState.health = 10;
        stateManager.gameState.perkStates['quickRevive'] = true;
        
        stateManager.applyDamageToLocalPlayer(20, 'red');
        
        expect(stateManager.gameState.health).toBe(0);
        expect(stateManager.gameState.isDowned).toBe(true);
        expect(stateManager.gameState.isGameOver).toBe(false);
    });
});
