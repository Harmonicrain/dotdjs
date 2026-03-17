import { WeaponState } from '../../types/index';
import { StateManager } from '../../state/StateManager';

/**
 * Weapon Pickup Utilities
 *
 * Handles weapon acquisition and ammo refill logic used by both
 * WallBuyHandler (direct ammo refill) and the WEAPON_PICKUP_REQUEST
 * event (new weapon pickup from wall buys / mystery box).
 *
 * Extracted from InteractionSystem to eliminate duplication and keep
 * weapon inventory logic in a single, findable location.
 */

/**
 * Handles picking up a weapon by ID. If the player already owns the weapon,
 * refills its ammo. Otherwise, acquires it into an empty slot or replaces
 * the active weapon.
 */
export const handleWeaponPickup = (ctx: StateManager, weaponId: string) => {
    const weaponConfig = ctx.configManager.weapons.find(w => w.id === weaponId)!;
    const weapons = ctx.gameState.weapons;
    const existingSlot = weapons.findIndex((w: WeaponState) => w.id === weaponId);

    if (existingSlot !== -1) {
        const w = weapons[existingSlot];
        w.currentAmmo = w.clipSize;
        w.currentReserve = w.maxReserve;
        if (ctx.gameState.activeWeaponIndex === existingSlot) {
            ctx.setAmmo(w.currentAmmo);
            ctx.setReserveAmmo(w.currentReserve);
        }
        ctx.setInteractionMsg("AMMO REFILLED!");
    } else {
        const activeIdx = ctx.gameState.activeWeaponIndex;
        const currentWeapon = weapons[activeIdx];
        const newMesh = ctx.gameState.weaponMeshes[weaponId];

        const newWeaponState = {
            ...weaponConfig,
            currentAmmo: weaponConfig.clipSize,
            currentReserve: weaponConfig.maxReserve,
            mesh: newMesh,
            isPacked: false
        };

        if (currentWeapon.mesh) currentWeapon.mesh.setEnabled(false);

        if (weapons.length < 2) {
            weapons.push(newWeaponState);
            const newIndex = weapons.length - 1;
            ctx.gameState.activeWeaponIndex = newIndex;
            ctx.setActiveWeaponIndex(newIndex);
            ctx.setWeaponName(newWeaponState.name);
            ctx.setWeaponId(newWeaponState.id);
        } else {
            weapons[activeIdx] = newWeaponState;
            ctx.setWeaponName(newWeaponState.name);
            ctx.setWeaponId(newWeaponState.id);
        }

        if (newWeaponState.mesh) newWeaponState.mesh.setEnabled(true);
        ctx.setAmmo(newWeaponState.currentAmmo);
        ctx.setReserveAmmo(newWeaponState.currentReserve);
        ctx.setInteractionMsg(`ACQUIRED ${weaponConfig.name}!`);
    }
    ctx.timerManager.schedule('clear_pickup_msg', ctx.configManager.visuals.HUD_MSG_DURATION, () => ctx.setInteractionMsg(null));
};
