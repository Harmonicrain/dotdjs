import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { applyExplosionHit, applyProjectileHit } from '../../../systems/zombie/zombieDamageUtils';
import { createMockContext } from '../../mocks/mockContext';
import { Zombie, PowerUpType } from '../../../types';

describe('zombieDamageUtils', () => {
    let ctx: any;
    let zombie: Zombie;

    beforeEach(() => {
        ctx = createMockContext();
        zombie = {
            id: 'zombie-1',
            type: 'ZOMBIE',
            mesh: { position: new BABYLON.Vector3(0, 0, 0) } as any,
            headMesh: { absolutePosition: new BABYLON.Vector3(0, 1, 0) } as any,
            health: 100,
            maxHealth: 100,
            speed: 0.035,
            lastAttackTime: 0,
            isDead: false,
            state: 0 as any,
            targetWindowId: null,
            barrierAttackTimer: 0,
            missingLimbs: { legL: false, legR: false, armL: false, armR: false },
            spawnTime: Date.now(),
        } as Zombie;
    });

    it('applies projectile hit damage, awards host points, and creates crawlers on leg hits', () => {
        applyProjectileHit(ctx, {
            zombie,
            damage: 60,
            owner: 'HOST',
            isHeadshot: false,
            isLegHit: true,
            hitMeshName: 'zombie_leg_l',
            hitDirection: BABYLON.Vector3.Forward(),
        });

        expect(zombie.health).toBe(58);
        expect(zombie.isCrawling).toBe(true);
        expect(zombie.speed).toBe(0.015);
        expect(zombie.missingLimbs.legL).toBe(true);
        expect(ctx.addPoints).toHaveBeenCalledWith(10);
        expect(ctx.zombieManager.onZombieDeath).not.toHaveBeenCalled();
    });

    it('uses client hit-confirm flow for remote projectile hits', () => {
        applyProjectileHit(ctx, {
            zombie,
            damage: 50,
            owner: 'CLIENT',
            isHeadshot: true,
            isLegHit: false,
        });

        expect(ctx.send).toHaveBeenCalledWith({ type: 'HIT_CONFIRM', amount: 20 });
        expect(ctx.addPoints).not.toHaveBeenCalled();
    });

    it('kills via explosion and mirrors explosion kill point awards for the owner', () => {
        zombie.health = 20;

        applyExplosionHit(ctx, {
            zombie,
            impactPoint: new BABYLON.Vector3(0, 0, 0),
            splashRadius: 6,
            splashDamage: 100,
            owner: 'HOST',
        });

        expect(ctx.zombieManager.onZombieDeath).toHaveBeenCalled();
        expect(ctx.addPoints).toHaveBeenCalledWith(30);
    });

    it('still respects insta-kill when resolving shared projectile hits', () => {
        ctx.gameState.activePowerUps[PowerUpType.INSTA_KILL] = Date.now() + 30000;

        applyProjectileHit(ctx, {
            zombie,
            damage: 1,
            owner: 'HOST',
            isHeadshot: false,
            isLegHit: false,
        });

        expect(ctx.zombieManager.onZombieDeath).toHaveBeenCalled();
        expect(zombie.health).toBeLessThanOrEqual(0);
    });
});
