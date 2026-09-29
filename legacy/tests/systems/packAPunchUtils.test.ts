import { describe, expect, it } from 'vitest';
import { MapConfigManager } from '../../managers/MapConfigManager';
import { applyPackAPunchUpgrade } from '../../systems/packAPunchUtils';
import { WeaponState } from '../../types';

function createWeapon(id: string): WeaponState {
    return {
        id,
        name: id === 'pistol' ? 'M1911' : id,
        clipSize: 8,
        maxReserve: 80,
        fireRate: 400,
        automatic: false,
        damage: 34,
        scale: 1,
        pellets: 1,
        hipPos: { x: 0, y: 0, z: 0 },
        adsPos: { x: 0, y: 0, z: 0 },
        barrelLength: 0.6,
        reloadTime: 2000,
        currentAmmo: 3,
        currentReserve: 11,
        mesh: null,
        isPacked: false,
    };
}

describe('packAPunchUtils', () => {
    it('applies upgraded weapon stats and refills ammo', () => {
        const configManager = new MapConfigManager();
        const weapon = createWeapon('pistol');

        const upgraded = applyPackAPunchUpgrade(weapon, configManager);

        expect(upgraded).toBe(true);
        expect(weapon.isPacked).toBe(true);
        expect(weapon.name).toBe('PAIN');
        expect(weapon.clipSize).toBe(12);
        expect(weapon.currentAmmo).toBe(12);
        expect(weapon.currentReserve).toBe(100);
    });

    it('returns false when no upgrade exists', () => {
        const configManager = new MapConfigManager();
        const weapon = createWeapon('nonexistent');

        const upgraded = applyPackAPunchUpgrade(weapon, configManager);

        expect(upgraded).toBe(false);
        expect(weapon.isPacked).toBe(false);
        expect(weapon.currentAmmo).toBe(3);
        expect(weapon.currentReserve).toBe(11);
    });
});
