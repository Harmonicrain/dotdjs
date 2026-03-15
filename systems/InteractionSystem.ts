import * as BABYLON from '@babylonjs/core';
import { WeaponState, InteractableMetadata } from '../types/index';
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

    // ── Helper Actions (Animations) ──────────────────────────────────

    /**
     * Animates a door mesh to a target Y position.
     * @param mesh - The mesh to animate
     * @param targetY - Target Y position
     * @param trackObserver - If true, stores observer reference for cleanup (used by regular doors)
     * @param doorId - Optional door ID for observer tracking and special handling
     */
    const animateDoorMeshToY = (
        mesh: BABYLON.AbstractMesh,
        targetY: number,
        trackObserver: boolean = false,
        doorId?: string
    ) => {
        // Handle special door cases that should be disposed instead of animated
        if (doorId === 'door1' || doorId === 'door2') {
            if (mesh) mesh.dispose();
            ctx.mapVisuals.doorMeshes.delete(doorId);
            return;
        }

        // Clean up existing observer if tracked
        if (trackObserver && doorId) {
            const entry = ctx.mapVisuals.doorMeshes.get(doorId);
            if (entry?.observer) {
                ctx.scene.onBeforeRenderObservable.remove(entry.observer);
                entry.observer = null;
            }
        }

        const observer = ctx.scene.onBeforeRenderObservable.add(() => {
            if (!mesh) return;
            const diff = targetY - mesh.position.y;
            if (Math.abs(diff) < 0.05) {
                mesh.position.y = targetY;
                ctx.scene.onBeforeRenderObservable.remove(observer);
                if (trackObserver && doorId) {
                    const entry = ctx.mapVisuals.doorMeshes.get(doorId);
                    if (entry) entry.observer = null;
                }
            } else {
                mesh.position.y += diff * 0.1;
            }
        });

        // Track observer reference if needed
        if (trackObserver && doorId) {
            const entry = ctx.mapVisuals.doorMeshes.get(doorId);
            if (entry) entry.observer = observer;
        }
    };

    const actionOpenDoor = (doorId: string) => {
        const entry = ctx.mapVisuals.doorMeshes.get(doorId);
        if (!entry) return;
        animateDoorMeshToY(entry.mesh, entry.openY, true, doorId);
    };

    const actionTurnOnPower = () => {
        ctx.gameState.powerOn = true;
        if (ctx.mapVisuals.powerSwitchActivate) {
            ctx.mapVisuals.powerSwitchActivate();
        } else if (ctx.mapVisuals.powerSwitchHandle) {
            ctx.mapVisuals.powerSwitchHandle.rotation.x = -Math.PI / 4;
        }
        if (ctx.mapVisuals.powerDoor) {
            animateDoorMeshToY(ctx.mapVisuals.powerDoor,
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

    const handleWeaponPickup = (weaponId: string) => {
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
            } else {
                weapons[activeIdx] = newWeaponState;
                ctx.setWeaponName(newWeaponState.name);
            }

            if (newWeaponState.mesh) newWeaponState.mesh.setEnabled(true);
            ctx.setAmmo(newWeaponState.currentAmmo);
            ctx.setReserveAmmo(newWeaponState.currentReserve);
            ctx.setInteractionMsg(`ACQUIRED ${weaponConfig.name}!`);
        }
        ctx.timerManager.schedule('clear_pickup_msg', ctx.configManager.visuals.HUD_MSG_DURATION, () => ctx.setInteractionMsg(null));
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

    const update = (dt: number, now: number) => {
        if (ctx.inputManager?.justPressed(GameAction.INTERACT)) {
            interact(false);
        } else if (ctx.inputManager?.isDown(GameAction.INTERACT)) {
            interact(true);
        }

        // Throttle hover check to reduce raycast frequency
        if (now - lastHoverCheck > HOVER_CHECK_INTERVAL) {
            lastHoverCheck = now;
            cachedHoverMsg = checkHover();
        }
        ctx.setHoverMsg(cachedHoverMsg);
    };

    const handlers = {
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

            actionOpenDoor(doorId);
        },
        powerOn: () => {
            actionTurnOnPower();
        },
        weaponPickup: (weaponId: string) => {
            handleWeaponPickup(weaponId);
        }
    };

    const init = () => {
        ctx.eventBus.on('DOOR_OPEN_REQUEST', handlers.doorOpen);
        ctx.eventBus.on('POWER_ON_REQUEST', handlers.powerOn);
        ctx.eventBus.on('WEAPON_PICKUP_REQUEST', handlers.weaponPickup);
    };

    const dispose = () => {
        ctx.eventBus.off('DOOR_OPEN_REQUEST', handlers.doorOpen);
        ctx.eventBus.off('POWER_ON_REQUEST', handlers.powerOn);
        ctx.eventBus.off('WEAPON_PICKUP_REQUEST', handlers.weaponPickup);
    };

    return {
        name: 'interaction',
        init,
        update,
        interact,
        checkHover,
        handleWeaponPickup,
        dispose
    };
};
