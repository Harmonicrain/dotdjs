import { StateManager } from '../../state/StateManager';
import { animateDoorMeshToY } from './doorUtils';

/**
 * Power Activation Utilities
 *
 * Handles the power-on sequence: state mutation, switch animation,
 * power door opening, HUD message, and sound playback.
 * Extracted from InteractionSystem so power logic lives alongside PowerHandler.
 */

/**
 * Activates power for the map: flips the switch, opens the power door,
 * updates game state, shows HUD message, and plays sound.
 */
export const activatePower = (ctx: StateManager) => {
    ctx.gameState.powerOn = true;
    if (ctx.mapVisuals.powerSwitchActivate) {
        ctx.mapVisuals.powerSwitchActivate();
    } else if (ctx.mapVisuals.powerSwitchHandle) {
        ctx.mapVisuals.powerSwitchHandle.rotation.x = -Math.PI / 4;
    }
    if (ctx.mapVisuals.powerDoor) {
        animateDoorMeshToY(ctx, ctx.mapVisuals.powerDoor,
            ctx.mapVisuals.powerDoorOpenY ?? 8);
    }
    // Open the power door (zone 1 <-> zone 4 connection)
    if (ctx.gameState.doorStates["powerDoor"]) {
        ctx.gameState.doorStates["powerDoor"].isOpen = true;
    }
    ctx.setInteractionMsg("POWER ACTIVATED!");
    ctx.timerManager.schedule('power_msg', ctx.configManager.visuals.POWER_HUD_MSG_DURATION, () => ctx.setInteractionMsg(null));

    // Play power on sound
    ctx.soundManager?.play('power');
};
