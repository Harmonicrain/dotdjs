
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createZombieAISystem } from './ZombieAISystem';
import { createMockContext } from '../../tests/mocks/mockContext';
import { ZombieState } from '../../types/index';

describe('ZombieAISystem', () => {
    let ctx: any;
    let system: any;
    let mockCrowd: any;

    beforeEach(() => {
        ctx = createMockContext();
        ctx.zombies = [];
        ctx.crowdRef = { current: undefined };
        ctx.getIsPathfindingActive = vi.fn(() => false);
        ctx.connectionStatusRef = { current: 'DISCONNECTED' };
        ctx.remote = { pos: new BABYLON.Vector3(10, 0, 10), gameState: { health: 100, isDowned: false } };
        
        mockCrowd = {
            addAgent: vi.fn(() => 0),
            removeAgent: vi.fn(),
            agentGoto: vi.fn(),
            updateAgentParameters: vi.fn(),
            getAgentVelocityToRef: vi.fn((idx, ref) => ref.set(1, 0, 0)),
            dispose: vi.fn()
        };

        ctx.navPlugin = {
            createCrowd: vi.fn(() => mockCrowd)
        };

        system = createZombieAISystem(ctx);
    });

    it('should NOT update when paused', () => {
        ctx.gameState.isPaused = true;
        system.update(16, Date.now());
        expect(ctx.navPlugin.createCrowd).not.toHaveBeenCalled();
    });

    it('should initialize crowd and add chasing zombies', () => {
        const zombie = {
            id: 'z1',
            type: 'ZOMBIE',
            state: ZombieState.CHASING,
            mesh: { 
                position: new BABYLON.Vector3(5, 0, 5),
                rotation: new BABYLON.Vector3(0, 0, 0)
            },
            speed: 0.05
        } as any;
        ctx.zombies.push(zombie);

        system.update(16, Date.now());

        expect(ctx.navPlugin.createCrowd).toHaveBeenCalled();
        expect(mockCrowd.addAgent).toHaveBeenCalled();
        expect(zombie.crowdAgentIndex).toBe(0);
        expect(ctx.crowdRef.current).toBe(mockCrowd);
    });

    it('should target the remote player if closer in HOST mode', () => {
        ctx.gameModeRef.current = 'HOST';
        ctx.connectionStatusRef.current = 'CONNECTED';
        
        const zombie = {
            id: 'z1',
            type: 'ZOMBIE',
            state: ZombieState.CHASING,
            mesh: { 
                position: new BABYLON.Vector3(8, 0, 8),
                rotation: new BABYLON.Vector3(0, 0, 0)
            },
            speed: 0.05,
            crowdAgentIndex: 0
        } as any;
        ctx.zombies.push(zombie);

        // Remote is at (10, 0, 10), Local (Camera) is at (0, 0, 0)
        // Zombie is at (8, 0, 8). Dist to Remote = sqrt(8), Dist to Local = sqrt(128).
        // Should target Remote.

        system.update(16, Date.now());

        // agentGoto is called with targetPos.y = 0
        expect(mockCrowd.agentGoto).toHaveBeenCalledWith(0, expect.objectContaining({ x: 10, z: 10 }));
    });

    it('should stop and rotate when in attack range', () => {
        const zombie = {
            id: 'z1',
            type: 'ZOMBIE',
            state: ZombieState.CHASING,
            mesh: { 
                position: new BABYLON.Vector3(1, 0, 0),
                rotation: new BABYLON.Vector3(0, 0, 0)
            },
            speed: 0.05,
            crowdAgentIndex: 0,
            pathUpdateTimer: 0
        } as any;
        ctx.zombies.push(zombie);

        // Player (Camera) is at (0, 0, 0). Dist is 1.0.
        // ATTACK_RANGE is 1.5. 1.5 * 0.9 = 1.35. 1.0 < 1.35. Should be in range.

        system.update(16, Date.now());

        expect(mockCrowd.updateAgentParameters).toHaveBeenCalledWith(0, expect.objectContaining({ maxSpeed: 0 }));
        expect(zombie.wasInAttackRange).toBe(true);
    });

    it('should handle solo downed wander', () => {
        ctx.gameModeRef.current = 'SOLO';
        ctx.gameState.isDowned = true;
        
        const moveWithCollisions = vi.fn();
        const zombie = {
            id: 'z1',
            type: 'ZOMBIE',
            state: ZombieState.CHASING,
            mesh: { 
                position: new BABYLON.Vector3(5, 0, 5),
                rotation: new BABYLON.Vector3(0, 0, 0),
                moveWithCollisions
            },
            speed: 0.05
        } as any;
        ctx.zombies.push(zombie);

        system.update(16, Date.now());

        expect(zombie.wander).toBeDefined();
        expect(moveWithCollisions).toHaveBeenCalled();
    });

    it('should remove dead zombies from crowd', () => {
        const zombie = {
            id: 'z1',
            type: 'ZOMBIE',
            state: ZombieState.CHASING,
            isDead: true,
            mesh: { position: new BABYLON.Vector3(5, 0, 5) },
            crowdAgentIndex: 0
        } as any;
        ctx.zombies.push(zombie);

        // Trigger crowd init first
        system.update(16, Date.now()); 
        
        expect(mockCrowd.removeAgent).toHaveBeenCalledWith(0);
        expect(zombie.crowdAgentIndex).toBeUndefined();
    });
});
