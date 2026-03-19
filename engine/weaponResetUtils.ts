import { WEAPON_CONFIGS } from '../config';
import { WeaponState } from '../types/index';
import { StateManager } from '../state/StateManager';

/**
 * Shared weapon reset logic.
 * Resets the player's weapon array to the starting pistol, resets ammo,
 * and clears weapon state in the UI store.
 */
export function resetPlayerWeapons(sm: StateManager): void {
    const gs = sm.gameState;
    const pistolConfig = WEAPON_CONFIGS.find(w => w.id === 'pistol');
    
    if (pistolConfig) {
        // 1. Reset the state in gameState
        gs.weapons = [{
            ...pistolConfig,
            currentAmmo:    pistolConfig.clipSize,
            currentReserve: pistolConfig.maxReserve,
            isPacked: false,
            mesh: gs.weaponMeshes['pistol'] || null,
        }] as WeaponState[];

        gs.activeWeaponIndex = 0;

        // 2. Synchronize with UI/Zustand store via StateManager methods
        sm.setActiveWeaponIndex(0);
        sm.setWeaponName(pistolConfig.name);
        sm.setWeaponId(pistolConfig.id);
        sm.setAmmo(pistolConfig.clipSize);
        sm.setReserveAmmo(pistolConfig.maxReserve);

        // 3. Update mesh visibility
        // Ensure all weapons are hidden, then show the new starting weapon
        Object.values(gs.weaponMeshes).forEach(m => {
            if (m) m.setEnabled(false);
        });
        
        const initialWeapon = gs.weapons[0];
        if (initialWeapon?.mesh) {
            initialWeapon.mesh.setEnabled(true);
        }
    }
}
