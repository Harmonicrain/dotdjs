
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createZombieSpawnSystem } from '../../../systems/zombie/ZombieSpawnSystem';
import { createMockContext } from '../../mocks/mockContext';
import { ZombieState } from '../../../types/index';
import { GroundSpawn } from '../../../types/entities';

describe('ZombieSpawnSystem', () => {
    let ctx: any;
    let system: any;

    beforeEach(() => {
        ctx = createMockContext();
        ctx.zombies = [];
        ctx.groundSpawns = [];
        system = createZombieSpawnSystem(ctx);
    });

    it('should NOT update when paused', () => {
        ctx.gameState.isPaused = true;
        const zombie = {
            state: ZombieState.SPAWNING,
            mesh: { position: new BABYLON.Vector3(0, -1, 0) }
        } as any;
        ctx.zombies.push(zombie);

        system.update(0.016, Date.now());

        expect(zombie.mesh.position.y).toBe(-1);
    });

    it('should NOT update when not authority', () => {
        ctx.gameModeRef.current = 'CLIENT';
        const zombie = {
            state: ZombieState.SPAWNING,
            mesh: { position: new BABYLON.Vector3(0, -1, 0) }
        } as any;
        ctx.zombies.push(zombie);

        system.update(0.016, Date.now());

        expect(zombie.mesh.position.y).toBe(-1);
    });

    it('should increment y position and transition to CHASING when spawning', () => {
        const zombie = {
            state: ZombieState.SPAWNING,
            mesh: { position: new BABYLON.Vector3(0, -0.005, 0) },
            spawnHoleId: 'hole1'
        } as any;
        ctx.zombies.push(zombie);

        system.update(0.016, Date.now());

        expect(zombie.mesh.position.y).toBeGreaterThanOrEqual(0);
        expect(zombie.state).toBe(ZombieState.CHASING);
        expect(ctx.zombieManager.releaseGroundSpawnHole).toHaveBeenCalledWith('hole1');
        expect(zombie.spawnHoleId).toBeUndefined();
    });

    it('should bounce the lid and eventually transition to SPAWNING when breaking lid', () => {
        const lidMesh = {
            position: new BABYLON.Vector3(0, 0, 0),
            setEnabled: vi.fn()
        };
        const groundSpawn: GroundSpawn = {
            id: 'lid1',
            position: new BABYLON.Vector3(0, 0, 0),
            lidMesh: lidMesh as any,
            hasLid: true
        } as any;
        ctx.groundSpawns.push(groundSpawn);

        const zombie = {
            state: ZombieState.BREAKING_LID,
            mesh: { position: new BABYLON.Vector3(0, -3.5, 0) },
            targetLidId: 'lid1'
        } as any;
        ctx.zombies.push(zombie);

        // First update: start bouncing
        system.update(1.0, Date.now());
        expect(zombie.lidBreakTimer).toBe(1.0);
        expect(lidMesh.position.y).toBeGreaterThan(0);

        // Advance timer past duration (4.0s)
        system.update(3.1, Date.now());
        expect(groundSpawn.hasLid).toBe(false);
        expect(lidMesh.setEnabled).toHaveBeenCalledWith(false);
        expect(zombie.targetLidId).toBeUndefined();
        
        // Next update should transition to SPAWNING and start moving up
        system.update(0.016, Date.now());
        expect(zombie.state).toBe(ZombieState.SPAWNING);
        expect(zombie.mesh.position.y).toBeCloseTo(-1.492, 3);
    });
});
