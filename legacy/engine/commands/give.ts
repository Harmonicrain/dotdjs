import { WEAPON_CONFIGS } from '../../config';
import { CommandDefinition } from './types';

export const giveCommand: CommandDefinition = {
    name: 'give',
    handler: (args, sm) => {
        if (args.length < 1) return 'Usage: /give <weapon_id>';
        const id = args[0].toLowerCase();
        const config = WEAPON_CONFIGS.find((w) => w.id === id);
        if (!config) return `Unknown weapon: ${id}`;

        const weaponMesh = sm.gameState.weaponMeshes[id] || null;

        const existingIdx = sm.gameState.weapons.findIndex((w) => w.id === id);
        if (existingIdx !== -1) {
            sm.gameState.activeWeaponIndex = existingIdx;
        } else {
            const newState = {
                ...config,
                currentAmmo: config.clipSize,
                currentReserve: config.maxReserve,
                isPacked: false,
                mesh: weaponMesh,
            };

            const oldWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
            if (oldWeapon?.mesh) oldWeapon.mesh.setEnabled(false);

            const hasMuleKick = !!sm.gameState.perkStates.muleKick;
            const weaponLimit = hasMuleKick ? 3 : 2;
            if (sm.gameState.weapons.length >= weaponLimit) {
                sm.gameState.weapons[sm.gameState.activeWeaponIndex] = newState;
            } else {
                sm.gameState.weapons.push(newState);
                sm.gameState.activeWeaponIndex = sm.gameState.weapons.length - 1;
            }
        }

        const activeWeapon = sm.gameState.weapons[sm.gameState.activeWeaponIndex];
        if (activeWeapon?.mesh) activeWeapon.mesh.setEnabled(true);

        sm.setActiveWeaponIndex(sm.gameState.activeWeaponIndex);
        sm.setWeaponName(config.name);
        sm.setWeaponId(config.id);
        sm.setAmmo(config.clipSize);
        sm.setReserveAmmo(config.maxReserve);

        return `Gave ${config.name}`;
    },
};
