import { WeaponState } from '../types';
import { MapConfigManager } from '../managers/MapConfigManager';

export const applyPackAPunchUpgrade = (
    weapon: WeaponState,
    configManager: MapConfigManager,
): boolean => {
    if (weapon.isPacked) return false;

    const upgradeConfig = configManager.upgradedWeapons[weapon.id];
    if (!upgradeConfig) return false;

    Object.assign(weapon, upgradeConfig);
    weapon.currentAmmo = weapon.clipSize;
    weapon.currentReserve = weapon.maxReserve;
    weapon.isPacked = true;

    return true;
};
