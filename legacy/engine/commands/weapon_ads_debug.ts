import { CommandDefinition } from './types';

export const weaponAdsDebugCommand: CommandDefinition = {
    name: 'weapon_ads_debug',
    handler: (args, sm) => {
        sm.weaponAdsDebug.isActive = !sm.weaponAdsDebug.isActive;

        if (sm.weaponAdsDebug.isActive) {
            const activeWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
            if (!activeWeapon) {
                sm.weaponAdsDebug.isActive = false;
                return 'No active weapon found.';
            }

            const ads = activeWeapon.adsPos;
            sm.weaponAdsDebug.adsPos = { x: ads.x, y: ads.y, z: ads.z };
            sm.weaponAdsDebug.originalAdsPos = { x: ads.x, y: ads.y, z: ads.z };
            sm.debugSelection.isActive = true;
            sm.gameState.isAiming = true;
            sm.ui.setWeaponAdsDebugInfo({
                x: ads.x,
                y: ads.y,
                z: ads.z,
                weaponName: activeWeapon.name,
                weaponId: activeWeapon.id,
                step: 0.005,
            });
            return 'Weapon ADS Debug: ON — Logic frozen.\nA/D — move left/right (x)\nW/S — move up/down (y)\nE/Q — move forward/back (z)\nShift — fine mode (0.001)\nValues update live in overlay.';
        }

        const activeWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        if (activeWeapon && sm.weaponAdsDebug.originalAdsPos) {
            const orig = sm.weaponAdsDebug.originalAdsPos;
            activeWeapon.adsPos = { x: orig.x, y: orig.y, z: orig.z };
        }
        sm.weaponAdsDebug.originalAdsPos = null;
        sm.debugSelection.isActive = false;
        sm.debugSelection.selectedMesh = null;
        sm.ui.setWeaponAdsDebugInfo(null);
        return 'Weapon ADS Debug: OFF. Original adsPos restored. Logic resumed.';
    },
};
