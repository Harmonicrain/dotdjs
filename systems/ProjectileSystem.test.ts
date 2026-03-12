
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createProjectileSystem } from './ProjectileSystem';
import { createMockContext } from '../tests/mocks/mockContext';

describe('ProjectileSystem', () => {
    let ctx: any;
    let system: any;

    beforeEach(() => {
        ctx = createMockContext();
        system = createProjectileSystem(ctx);
    });

    it('should NOT update projectiles when game is paused', () => {
        ctx.gameState.isPaused = true;
        const projectile = {
            mesh: { position: BABYLON.Vector3.Zero() },
            direction: BABYLON.Vector3.Forward(),
            speed: 1,
            life: 100,
            isRemote: false
        };
        ctx.gameEngine.activeProjectiles = [projectile];
        
        system.update(16, Date.now());
        
        expect(projectile.mesh.position.z).toBe(0);
    });

    it('should update projectiles when game is NOT paused', () => {
        ctx.gameState.isPaused = false;
        ctx.gameState.hasStarted = true;
        const initialPos = new BABYLON.Vector3(0, 0, 0);
        const projectile = {
            mesh: { position: initialPos.clone() },
            direction: new BABYLON.Vector3(0, 0, 1),
            speed: 1,
            life: 100,
            isRemote: false
        };
        ctx.gameEngine.activeProjectiles = [projectile];
        
        system.update(16, Date.now());
        
        expect(projectile.mesh.position.z).toBeGreaterThan(0);
    });

    it('should allow updates in debug mode even if paused', () => {
        ctx.gameState.isPaused = true;
        ctx.debugSelection.isActive = true;
        ctx.gameState.hasStarted = true;
        
        const initialPos = new BABYLON.Vector3(0, 0, 0);
        const projectile = {
            mesh: { position: initialPos.clone() },
            direction: new BABYLON.Vector3(0, 0, 1),
            speed: 1,
            life: 100,
            isRemote: false
        };
        ctx.gameEngine.activeProjectiles = [projectile];
        
        system.update(16, Date.now());
        
        expect(projectile.mesh.position.z).toBeGreaterThan(0);
    });
});
