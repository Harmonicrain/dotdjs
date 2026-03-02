import { InteractionContext, InteractionHandler } from '../types';
import { WeaponState } from '../../../types/index';
import { getInputPrompt, GameAction } from '../../../engine/InputManager';

export const WallBuyHandler: InteractionHandler = {
    getHoverLabel: ({ stateManager, metadata, inputDevice }) => {
        const weapons = stateManager.gameState.weapons;
        const hasWeapon = weapons.some((w: WeaponState) => w.id === metadata.weapon);
        const isPacked = hasWeapon && weapons.find(w => w.id === metadata.weapon)?.isPacked;
        const papAmmoCostHover = stateManager.configManager.gameplay.PACK_A_PUNCH_AMMO_COST;
        const cost = isPacked ? papAmmoCostHover : metadata.cost;
        const prompt = getInputPrompt(GameAction.INTERACT, inputDevice);
        return `Hold [${prompt}] to Buy ${metadata.weapon?.toUpperCase() || 'WEAPON'} [${cost}]`;
    },
    interact: ({ stateManager, metadata }) => {
        const weaponId = (metadata.weapon || metadata.data?.weaponId) as string;
        const baseCost = metadata.cost as number;
        if (!weaponId || !baseCost) return false;

        const weapons = stateManager.gameState.weapons;
        const hasWeapon = weapons.some((w: WeaponState) => w.id === weaponId);
        const existingSlot = weapons.findIndex((w: WeaponState) => w.id === weaponId);
        const isPacked = hasWeapon && weapons[existingSlot].isPacked;
        const papAmmoCost = stateManager.configManager.gameplay.PACK_A_PUNCH_AMMO_COST;
        const cost = isPacked ? papAmmoCost : baseCost;
        
        if (stateManager.gameState.points >= cost) {
            if (hasWeapon) {
                 const w = weapons[existingSlot];
                 if (w.currentAmmo === w.clipSize && w.currentReserve === w.maxReserve) return false;
                 stateManager.gameState.points -= cost; 
                 stateManager.setPoints(stateManager.gameState.points);
                 w.currentAmmo = w.clipSize; 
                 w.currentReserve = w.maxReserve;
                 if (stateManager.gameState.activeWeaponIndex === existingSlot) {
                     stateManager.setAmmo(w.currentAmmo); 
                     stateManager.setReserveAmmo(w.currentReserve);
                 }
                 stateManager.setInteractionMsg("AMMO REFILLED!"); 
                 stateManager.timerManager.schedule('clear_wallbuy_msg', stateManager.configManager.visuals.HUD_MSG_DURATION, () => stateManager.setInteractionMsg(null));
                 return true;
            } else {
                 stateManager.gameState.points -= cost; 
                 stateManager.setPoints(stateManager.gameState.points);
                 stateManager.eventBus.emit('WEAPON_PICKUP_REQUEST', weaponId);
                 return true;
            }
        }
        return false;
    }
};
