import { CommandDefinition } from './types';

export const ammoCommand: CommandDefinition = {
    name: 'ammo',
    handler: (args, sm) => {
        sm.gameState.weapons.forEach((w) => {
            w.currentAmmo = w.clipSize;
            w.currentReserve = w.maxReserve;
        });
        const current = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        sm.setAmmo(current.currentAmmo);
        sm.setReserveAmmo(current.currentReserve);
        return 'Ammo refilled.';
    },
};
