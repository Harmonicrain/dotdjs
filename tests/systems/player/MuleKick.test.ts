
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleWeaponPickup } from '../../../systems/interaction/weaponPickupUtils';
import { createMockContext } from '../../mocks/mockContext';

/**
 * Mule Kick perk tests.
 * Verifies that the weapon carry limit increases from 2 to 3 when muleKick is active,
 * and that the default 2-weapon cap is preserved without it.
 */
describe('Mule Kick — weapon carry limit', () => {
    let ctx: any;

    const makeWeapon = (id: string) => ({
        id,
        name: id.toUpperCase(),
        clipSize: 30,
        maxReserve: 90,
        fireRate: 100,
        automatic: true,
        damage: 20,
        scale: 1,
        pellets: 1,
        hipPos: { x: 0, y: 0, z: 0 },
        adsPos: { x: 0, y: 0, z: 0 },
        barrelLength: 1,
        reloadTime: 2000,
        currentAmmo: 30,
        currentReserve: 90,
        mesh: null,
        isPacked: false,
    });

    beforeEach(() => {
        ctx = createMockContext();

        // Provide a minimal StateManager-like object that handleWeaponPickup expects
        ctx.configManager.weapons = [
            { id: 'shotgun', name: 'SHOTGUN', clipSize: 8, maxReserve: 40, fireRate: 60, automatic: false, damage: 70, scale: 1, pellets: 8, hipPos: { x: 0, y: 0, z: 0 }, adsPos: { x: 0, y: 0, z: 0 }, barrelLength: 1, reloadTime: 2500 },
            { id: 'famas',   name: 'FAMAS',   clipSize: 30, maxReserve: 90, fireRate: 600, automatic: true, damage: 30, scale: 1, pellets: 1, hipPos: { x: 0, y: 0, z: 0 }, adsPos: { x: 0, y: 0, z: 0 }, barrelLength: 1, reloadTime: 2000 },
            { id: 'stg44',   name: 'STG44',   clipSize: 30, maxReserve: 90, fireRate: 500, automatic: true, damage: 35, scale: 1, pellets: 1, hipPos: { x: 0, y: 0, z: 0 }, adsPos: { x: 0, y: 0, z: 0 }, barrelLength: 1, reloadTime: 2200 },
        ];

        ctx.setAmmo = vi.fn();
        ctx.setReserveAmmo = vi.fn();
        ctx.setInteractionMsg = vi.fn();
        ctx.setActiveWeaponIndex = vi.fn();
        ctx.setWeaponName = vi.fn();
        ctx.setWeaponId = vi.fn();

        // Bind functions that handleWeaponPickup calls on the StateManager shape
        ctx.gameState.weaponMeshes = { shotgun: null, famas: null, stg44: null };
    });

    it('WITHOUT Mule Kick: picking up a 3rd weapon replaces the active slot (cap = 2)', () => {
        ctx.gameState.weapons = [makeWeapon('pistol'), makeWeapon('shotgun')];
        ctx.gameState.activeWeaponIndex = 0;
        ctx.gameState.perkStates = {};  // no Mule Kick

        handleWeaponPickup(ctx, 'famas');

        // Still only 2 weapons — active slot was replaced
        expect(ctx.gameState.weapons.length).toBe(2);
        expect(ctx.gameState.weapons[0].id).toBe('famas');
    });

    it('WITH Mule Kick: picking up a 3rd weapon fills the new slot (cap = 3)', () => {
        ctx.gameState.weapons = [makeWeapon('pistol'), makeWeapon('shotgun')];
        ctx.gameState.activeWeaponIndex = 0;
        ctx.gameState.perkStates = { muleKick: true };

        handleWeaponPickup(ctx, 'famas');

        // Now 3 weapons — new slot added
        expect(ctx.gameState.weapons.length).toBe(3);
        expect(ctx.gameState.weapons[2].id).toBe('famas');
    });

    it('WITH Mule Kick: picking up a 4th weapon still replaces active slot (cap stays 3)', () => {
        ctx.gameState.weapons = [makeWeapon('pistol'), makeWeapon('shotgun'), makeWeapon('famas')];
        ctx.gameState.activeWeaponIndex = 0;
        ctx.gameState.perkStates = { muleKick: true };

        handleWeaponPickup(ctx, 'stg44');

        // Still 3 — slot 0 (pistol) was replaced
        expect(ctx.gameState.weapons.length).toBe(3);
        expect(ctx.gameState.weapons[0].id).toBe('stg44');
    });

    it('refills ammo when picking up an already-owned weapon regardless of Mule Kick', () => {
        ctx.gameState.weapons = [makeWeapon('pistol'), makeWeapon('shotgun')];
        ctx.gameState.weapons[1].currentAmmo = 0;
        ctx.gameState.weapons[1].currentReserve = 0;
        ctx.gameState.activeWeaponIndex = 0;
        ctx.gameState.perkStates = { muleKick: true };

        handleWeaponPickup(ctx, 'shotgun');

        expect(ctx.gameState.weapons[1].currentAmmo).toBe(30);   // clipSize from makeWeapon
        expect(ctx.gameState.weapons[1].currentReserve).toBe(90); // maxReserve from makeWeapon
        expect(ctx.setInteractionMsg).toHaveBeenCalledWith('AMMO REFILLED!');
    });
});
