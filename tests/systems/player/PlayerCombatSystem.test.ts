
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createPlayerCombatSystem } from '../../../systems/player/PlayerCombatSystem';
import { createMockContext } from '../../mocks/mockContext';
import { GameAction } from '../../../engine/InputManager';

describe('PlayerCombatSystem', () => {
    let ctx: any;
    let system: any;

    beforeEach(() => {
        ctx = createMockContext();
        ctx.setActiveWeaponIndex = vi.fn();
        ctx.setWeaponName = vi.fn();
        ctx.setAmmo = vi.fn();
        ctx.setReserveAmmo = vi.fn();
        ctx.setMaxClip = vi.fn();
        ctx.setShotsFired = vi.fn();
        
        // Mock camera directions
        ctx.camera.getDirectionToRef = vi.fn((dir, ref) => ref.copyFrom(dir));
        
        // Mock scene pick
        ctx.scene.pickWithRay = vi.fn(() => ({ hit: false }));

        system = createPlayerCombatSystem(ctx);
    });

    it('should NOT update when game is paused', () => {
        ctx.gameState.isPaused = true;
        ctx.gameState.weapons[0].currentAmmo = 30;
        ctx.inputManager.isDown.mockReturnValue(true);

        system.update(16, Date.now());

        expect(ctx.gameState.weapons[0].currentAmmo).toBe(30);
    });

    it('should consume ammo when shooting', () => {
        ctx.gameState.hasStarted = true;
        const weapon = ctx.gameState.weapons[0];
        weapon.currentAmmo = 30;
        weapon.automatic = true;
        ctx.inputManager.isFireInputActive.mockReturnValue(true);

        system.update(16, Date.now());

        expect(weapon.currentAmmo).toBe(29);
        expect(ctx.setAmmo).toHaveBeenCalledWith(29);
        expect(ctx.gameEngine.spawnProjectile).toHaveBeenCalled();
    });

    it('should NOT shoot faster than fire rate', () => {
        ctx.gameState.hasStarted = true;
        const weapon = ctx.gameState.weapons[0];
        weapon.fireRate = 600; // 100ms delay
        weapon.currentAmmo = 30;
        weapon.automatic = true;
        ctx.inputManager.isFireInputActive.mockReturnValue(true);

        const now = Date.now();
        system.update(16, now);
        expect(weapon.currentAmmo).toBe(29);

        // Update immediately again
        system.update(16, now + 10);
        expect(weapon.currentAmmo).toBe(29); // Still 29

        // Update after fire delay
        system.update(16, now + 110);
        expect(weapon.currentAmmo).toBe(28);
    });

    it('should require trigger release for semi-auto weapons', () => {
        ctx.gameState.hasStarted = true;
        const weapon = ctx.gameState.weapons[0];
        weapon.automatic = false;
        weapon.currentAmmo = 30;
        ctx.inputManager.isDown.mockImplementation((action: GameAction) => action === GameAction.FIRE);

        system.update(16, Date.now());
        expect(weapon.currentAmmo).toBe(29);

        // Still holding trigger
        system.update(16, Date.now() + 500);
        expect(weapon.currentAmmo).toBe(29);

        // Release trigger
        ctx.inputManager.isDown.mockReturnValue(false);
        system.update(16, Date.now() + 600);
        
        // Press again
        ctx.inputManager.isDown.mockImplementation((action: GameAction) => action === GameAction.FIRE);
        system.update(16, Date.now() + 700);
        expect(weapon.currentAmmo).toBe(28);
    });

    it('should start reloading when reload is pressed', () => {
        ctx.gameState.hasStarted = true;
        const weapon = ctx.gameState.weapons[0];
        weapon.currentAmmo = 10;
        weapon.clipSize = 30;
        weapon.currentReserve = 60;
        ctx.inputManager.justPressed.mockImplementation((action: GameAction) => action === GameAction.RELOAD);

        system.update(16, Date.now());

        expect(ctx.gameState.isReloading).toBe(true);
        expect(ctx.timerManager.has('reload')).toBe(true);
    });

    it('should complete reloading after timer', () => {
        ctx.gameState.hasStarted = true;
        const weapon = ctx.gameState.weapons[0];
        weapon.currentAmmo = 10;
        weapon.clipSize = 30;
        weapon.currentReserve = 60;
        weapon.reloadTime = 1000;
        ctx.inputManager.justPressed.mockImplementation((action: GameAction) => action === GameAction.RELOAD);

        system.update(16, Date.now());
        
        // Fast forward timer
        ctx.timerManager.update(1100);

        expect(weapon.currentAmmo).toBe(30);
        expect(weapon.currentReserve).toBe(40);
        expect(ctx.gameState.isReloading).toBe(false);
    });

    it('should switch weapons and cancel reload', () => {
        ctx.gameState.hasStarted = true;
        ctx.gameState.weapons.push({ ...ctx.gameState.weapons[0], id: 'shotgun', name: 'SHOTGUN' });
        ctx.gameState.isReloading = true;
        
        ctx.inputManager.justPressed.mockImplementation((action: GameAction) => action === GameAction.WEAPON_2);

        system.update(16, Date.now());

        expect(ctx.gameState.activeWeaponIndex).toBe(1);
        expect(ctx.gameState.isReloading).toBe(false);
        expect(ctx.setActiveWeaponIndex).toHaveBeenCalledWith(1);
    });

    it('should handle knifing logic', () => {
        ctx.gameState.hasStarted = true;
        ctx.gameState.knifeMesh = { setEnabled: vi.fn(), position: new BABYLON.Vector3(), rotation: new BABYLON.Vector3() };
        ctx.inputManager.justPressed.mockImplementation((action: GameAction) => action === GameAction.KNIFE);

        system.update(16, Date.now());

        expect(ctx.gameState.isKnifing).toBe(true);
        expect(ctx.gameState.knifeMesh.setEnabled).toHaveBeenCalledWith(true);
        expect(ctx.timerManager.has('knife_hit')).toBe(true);
    });

    it('should allow shooting while downed if weapon is available', () => {
        ctx.gameState.hasStarted = true;
        ctx.gameState.isDowned = true;
        const weapon = ctx.gameState.weapons[0];
        weapon.currentAmmo = 30;
        weapon.automatic = true;
        ctx.inputManager.isFireInputActive.mockReturnValue(true);

        system.update(16, Date.now());

        expect(weapon.currentAmmo).toBe(29);
    });
});
