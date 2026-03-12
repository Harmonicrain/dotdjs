
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createZombieDamageSystem, applyDamageToZombie } from '../../../systems/zombie/ZombieDamageSystem';
import { createMockContext } from '../../mocks/mockContext';
import { Zombie, PowerUpType } from '../../../types';

describe('ZombieDamageSystem - Gameplay Integration', () => {
    let ctx: any;

    beforeEach(() => {
        ctx = createMockContext();
        // Mock points hit config
        ctx.configManager.gameplay.POINTS_HIT = 10;
        ctx.configManager.gameplay.POINTS_HEADSHOT = 20;
    });

    describe('The Kill Chain', () => {
        it('should reduce zombie health, fire PLAYER_HIT event, and increment points', () => {
            // Mock a zombie with 100 HP
            const zombie: Zombie = {
                id: 'zombie-1',
                mesh: { position: BABYLON.Vector3.Zero() } as any,
                health: 100,
                maxHealth: 100,
                isDead: false,
                type: 'ZOMBIE',
                speed: 0.035,
            } as any;

            const hitEventSpy = vi.fn();
            ctx.eventBus.on('PLAYER_HIT', hitEventSpy);

            // "Shoot" it with 20 damage
            applyDamageToZombie(zombie, 20, ctx);

            // Verify health reduction
            expect(zombie.health).toBe(80);

            // Verify EventBus fires PLAYER_HIT event
            expect(hitEventSpy).toHaveBeenCalledWith({
                zombieId: 'zombie-1',
                damage: 20
            });

            // Verify StateManager increments player points by POINTS_HIT (10)
            expect(ctx.addPoints).toHaveBeenCalledWith(10);
        });
    });

    describe('Insta-Kill Power-up', () => {
        it('should result in immediate death regardless of remaining HP when INSTA_KILL is active', () => {
            // Mock a zombie with 100 HP
            const zombie: Zombie = {
                id: 'zombie-2',
                mesh: { position: BABYLON.Vector3.Zero() } as any,
                health: 100,
                maxHealth: 100,
                isDead: false,
                type: 'ZOMBIE',
                speed: 0.035,
            } as any;

            // Activate Insta-Kill
            ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL] = Date.now() + 30000;

            // Apply minor damage (10)
            applyDamageToZombie(zombie, 10, ctx);

            // Verify immediate health drop to 0 or below (since it sets damage to maxHealth)
            expect(zombie.health).toBeLessThanOrEqual(0);
        });
    });
});
