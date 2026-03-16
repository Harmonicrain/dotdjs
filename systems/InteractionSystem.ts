import { InteractableMetadata } from '../types/index';
import { GameAction } from '../engine/InputManager';
import { IInteractionSystem } from '../types/systems';

// Decomposed Handlers
import { InteractionHandler } from './interaction/types';
import { DoorHandler } from './interaction/handlers/DoorHandler';
import { PerkHandler } from './interaction/handlers/PerkHandler';
import { WallBuyHandler } from './interaction/handlers/WallBuyHandler';
import { PowerHandler } from './interaction/handlers/PowerHandler';
import { PackAPunchHandler } from './interaction/handlers/PackAPunchHandler';
import { MysteryBoxHandler } from './interaction/handlers/MysteryBoxHandler';
import { WindowHandler } from './interaction/handlers/WindowHandler';
import { SpawnHoleLidHandler } from './interaction/handlers/SpawnHoleLidHandler';

// Extracted action utilities
import { openDoor } from './interaction/doorUtils';
import { activatePower } from './interaction/powerUtils';
import { handleWeaponPickup } from './interaction/weaponPickupUtils';

import { StateManager } from '../state/StateManager';

/**
 * InteractionSystem
 *
 * Dispatcher for player interactions with the world (doors, perks, mystery box, etc.).
 * Uses specialized handlers for each interaction type.
 * Uses MapConfigManager for map-specific tuning.
 */
export const createInteractionSystem = (ctx: StateManager): IInteractionSystem => {
    const HANDLERS: Record<string, InteractionHandler> = {
        'DOOR': DoorHandler,
        'PERK': PerkHandler,
        'WALLBUY': WallBuyHandler,
        'POWER': PowerHandler,
        'PAP': PackAPunchHandler,
        'MYSTERY_BOX': MysteryBoxHandler
    };

    // ── Proximity Detection ──────────────────────────────────────────

    const getInteractableAtCrosshair = () => {
        if (!ctx.camera || !ctx.scene) return null;
        const ray = ctx.camera.getForwardRay(3);
        const hit = ctx.scene.pickWithRay(ray);

        if (hit && hit.hit && hit.pickedMesh) {
            return { mesh: hit.pickedMesh, metadata: hit.pickedMesh.metadata as InteractableMetadata };
        }
        return null;
    };

    const interact = (isContinuous: boolean = false): boolean => {
        const target = getInteractableAtCrosshair();
        if (!target) return false;

        const { mesh, metadata } = target;
        const now = Date.now();

        // Window Handler - allow continuous interaction but keep standard cooldown
        if (WindowHandler.interact({ stateManager: ctx, mesh, metadata, inputDevice: ctx.inputDevice })) {
            ctx.gameState.lastRepairTime = now;
            return true;
        }

        // Spawn hole lid handler - same pattern as windows
        if (SpawnHoleLidHandler.interact({ stateManager: ctx, mesh, metadata, inputDevice: ctx.inputDevice })) {
            ctx.gameState.lastRepairTime = now;
            return true;
        }

        // Metadata Based Handlers
        if (!metadata || !metadata.type) return false;

        // For other interactions, use standard cooldown unless continuous
        const cooldown = isContinuous ? 200 : 500;
        if (now - ctx.gameState.lastRepairTime < cooldown) return false;

        const handler = HANDLERS[metadata.type];
        if (handler && handler.interact({ stateManager: ctx, mesh, metadata, inputDevice: ctx.inputDevice })) {
            ctx.gameState.lastRepairTime = now;
            return true;
        }

        return false;
    };

    const checkHover = (): string | null => {
        const target = getInteractableAtCrosshair();
        if (!target) return null;

        const { mesh, metadata } = target;

        // Window Hover
        const winHover = WindowHandler.getHoverLabel({ stateManager: ctx, mesh, metadata, inputDevice: ctx.inputDevice });
        if (winHover) return winHover;

        // Spawn hole lid hover
        const lidHover = SpawnHoleLidHandler.getHoverLabel({ stateManager: ctx, mesh, metadata, inputDevice: ctx.inputDevice });
        if (lidHover) return lidHover;

        // Metadata Based Hover
        if (!metadata || !metadata.type) return null;
        const handler = HANDLERS[metadata.type];
        return handler ? handler.getHoverLabel({ stateManager: ctx, mesh, metadata, inputDevice: ctx.inputDevice }) : null;
    };

    // ── Throttled hover check (raycasting is expensive) ──────────────
    let lastHoverCheck = 0;
    let cachedHoverMsg: string | null = null;
    const HOVER_CHECK_INTERVAL = 100; // ms

    // Throttle continuous interact raycasts (matches existing 200ms success cooldown)
    let lastContinuousInteractCheck = 0;
    const CONTINUOUS_INTERACT_INTERVAL = 200; // ms

    const update = (dt: number, now: number) => {
        if (ctx.inputManager?.justPressed(GameAction.INTERACT)) {
            interact(false);
        } else if (ctx.inputManager?.isDown(GameAction.INTERACT)) {
            if (now - lastContinuousInteractCheck >= CONTINUOUS_INTERACT_INTERVAL) {
                lastContinuousInteractCheck = now;
                interact(true);
            }
        }

        // Throttle hover check to reduce raycast frequency
        if (now - lastHoverCheck > HOVER_CHECK_INTERVAL) {
            lastHoverCheck = now;
            cachedHoverMsg = checkHover();
        }
        ctx.setHoverMsg(cachedHoverMsg);
    };

    const eventHandlers = {
        doorOpen: (doorId: string) => {
            if (ctx.gameState.doorStates[doorId]) {
                ctx.gameState.doorStates[doorId].isOpen = true;
            }

            // Remove NavMesh obstacle if it exists
            const entry = ctx.mapVisuals.doorMeshes.get(doorId);
            if (entry && entry.obstacle && ctx.navPlugin) {
                try {
                    ctx.navPlugin.removeObstacle(entry.obstacle);
                    entry.obstacle = null;
                } catch (e) {
                    console.error(`Failed to remove nav obstacle for door ${doorId}:`, e);
                }
            }

            openDoor(ctx, doorId);
        },
        powerOn: () => {
            activatePower(ctx);
        },
        weaponPickup: (weaponId: string) => {
            handleWeaponPickup(ctx, weaponId);
        }
    };

    const init = () => {
        ctx.eventBus.on('DOOR_OPEN_REQUEST', eventHandlers.doorOpen);
        ctx.eventBus.on('POWER_ON_REQUEST', eventHandlers.powerOn);
        ctx.eventBus.on('WEAPON_PICKUP_REQUEST', eventHandlers.weaponPickup);
    };

    const dispose = () => {
        ctx.eventBus.off('DOOR_OPEN_REQUEST', eventHandlers.doorOpen);
        ctx.eventBus.off('POWER_ON_REQUEST', eventHandlers.powerOn);
        ctx.eventBus.off('WEAPON_PICKUP_REQUEST', eventHandlers.weaponPickup);
    };

    return {
        name: 'interaction',
        init,
        update,
        interact,
        checkHover,
        dispose
    };
};
