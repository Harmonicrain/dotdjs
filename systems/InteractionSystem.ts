import * as BABYLON from '@babylonjs/core';
import { GameStateData, GameMessage, WindowBarrier, DoorMeshEntry, MapGameplay, MysteryBox, WeaponState, InteractableMetadata } from '../types/index';
import { InputManager, GameAction, InputDevice } from '../engine/InputManager';
import { IInteractionSystem, MysteryBoxSystem } from '../types/systems';
import { createWorldWeapon } from '../factories';
import { EventBus } from '../engine/EventBus';
import { TimerManager } from '../engine/TimerManager';
import { ResourceManager } from '../managers/ResourceManager';
import { MapConfigManager } from '../managers/MapConfigManager';

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
    const _tempInteractVec = new BABYLON.Vector3();
    const _tempInteractOffset = new BABYLON.Vector3(0, 1.2, 0);
    const _tempPapVec = new BABYLON.Vector3(0, 0, -0.5);

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

    const findPapAnchorPosition = (
        targetMachine: BABYLON.AbstractMesh
    ): BABYLON.Vector3 => {
        _tempInteractVec.copyFrom(targetMachine.absolutePosition).addInPlace(_tempInteractOffset);
        let anchorPos = _tempInteractVec;
        let rootNode = targetMachine;

        while (rootNode.parent && rootNode.parent instanceof BABYLON.TransformNode && rootNode.parent.name !== 'levelRoot') {
            rootNode = rootNode.parent as BABYLON.AbstractMesh;
        }

        const children = rootNode.getChildTransformNodes(false);
        const anchorNode = children.find(c => c.name === 'papWeaponAnchor');
        if (anchorNode) anchorPos.copyFrom(anchorNode.absolutePosition);

        return anchorPos;
    };

    // Tracks the active PaP animation observer so dispose() can clean it up
    // if the session resets before the 3s timer fires.
    let activePapAnimObs: BABYLON.Observer<BABYLON.Scene> | null = null;
    let activePapAnimMesh: BABYLON.TransformNode | null = null;

    const cleanupPapAnimation = () => {
        if (activePapAnimObs) {
            ctx.scene.onBeforeRenderObservable.remove(activePapAnimObs);
            activePapAnimObs = null;
        }
        if (activePapAnimMesh) {
            activePapAnimMesh.dispose();
            activePapAnimMesh = null;
        }
    };

    const setupPackAPunchAnimation = (
        targetMachine: BABYLON.AbstractMesh,
        weapon: WeaponState,
        anchorPos: BABYLON.Vector3,
        scene: BABYLON.Scene,
        ctx: StateManager
    ) => {
        const oldMesh = weapon.mesh;
        if (oldMesh) oldMesh.setEnabled(false);

        // Clean up any in-progress PaP animation before starting a new one
        cleanupPapAnimation();

        let rootNode = targetMachine;
        while (rootNode.parent && rootNode.parent instanceof BABYLON.TransformNode && rootNode.parent.name !== 'levelRoot') {
            rootNode = rootNode.parent as BABYLON.AbstractMesh;
        }
        const children = rootNode.getChildTransformNodes(false);
        const anchorNode = children.find(c => c.name === 'papWeaponAnchor');

        if (scene) {
            // GLB weapons need upright orientation for PAP display; _world transforms are for ground pickup
            let papOverride: { rotation: [number, number, number] } | undefined;
            if (weapon.id === 'pistol') papOverride = { rotation: [0, Math.PI / 2, 0] };
            else if (weapon.id === 'ray_gun') papOverride = { rotation: [0, Math.PI, 0] };
            const animMesh = createWorldWeapon(scene, weapon.id, rootNode as BABYLON.TransformNode, papOverride);
            animMesh.parent = null;
            animMesh.position.copyFrom(anchorPos).addInPlace(_tempPapVec);
            if (anchorNode) {
                animMesh.parent = anchorNode;
                animMesh.position.copyFromFloats(0, 0, -0.5);
                animMesh.rotation.copyFromFloats(0, Math.PI / 2, 0);
            }
            activePapAnimMesh = animMesh;

            let t = 0;
            activePapAnimObs = scene.onBeforeRenderObservable.add(() => {
                t += scene.getEngine().getDeltaTime() / 1000;
                if (!activePapAnimMesh) return;
                activePapAnimMesh.rotation.y += 0.1;
                if (t < 1.0) {
                    activePapAnimMesh.position.z = BABYLON.Scalar.Lerp(-0.5, 0.2, t);
                } else if (t < 2.5) {
                    activePapAnimMesh.position.y = Math.sin(t * 5) * 0.05;
                } else if (t < 3.0) {
                    activePapAnimMesh.scaling.scaleInPlace(0.9);
                }
            });

            ctx.timerManager.schedule('pap_anim_cleanup', 3000, () => {
                cleanupPapAnimation();
            });
        }
    };

    const applyPackAPunchUpgrade = (weapon: WeaponState, ctx: StateManager) => {
        const upgradeConfig = ctx.configManager.upgradedWeapons[weapon.id];
        if (upgradeConfig) {
            Object.assign(weapon, upgradeConfig);
            weapon.currentAmmo = weapon.clipSize;
            weapon.currentReserve = weapon.maxReserve;
            weapon.isPacked = true;
        }
    };

    const createPackAPunchTexture = (ctx: StateManager): BABYLON.DynamicTexture => {
        const texSize = 512;
        const dynamicTexture = new BABYLON.DynamicTexture("papCamoTex", texSize, ctx.scene, true);
        const ctx2d = dynamicTexture.getContext();

        // 1. Dark obsidian background
        ctx2d.fillStyle = "#08080b";
        ctx2d.fillRect(0, 0, texSize, texSize);

        // 2. Helper to draw seamless waves
        // We render at Y - texSize, Y, and Y + texSize to guarantee perfectly seamless vertical wrapping
        const drawSeamlessWave = (
            color: string,
            thickness: number,
            blur: number,
            amplitude: number,
            frequency: number,
            phaseOffset: number,
            verticalSpacing: number
        ) => {
            ctx2d.shadowColor = color;
            ctx2d.shadowBlur = blur;
            ctx2d.strokeStyle = color;
            ctx2d.lineWidth = thickness;
            ctx2d.lineJoin = "round";
            (ctx2d as CanvasRenderingContext2D).lineCap = "round"; // Fix LSP error: cast to CanvasRenderingContext2D

            // Draw multiple parallel waves
            for (let baseY = 0; baseY < texSize; baseY += verticalSpacing) {
                // To ensure seamless tiling horizontally, the wave must complete a full cycle exactly at texSize
                // frequency determines how many full waves fit across the width

                for (let yOffset of [-texSize, 0, texSize]) {
                    ctx2d.beginPath();
                    for (let x = 0; x <= texSize; x += 4) { // 4px step for smooth curves
                        // Use exact Math.PI * 2 multiples to guarantee seamless horizontal tiling
                        const angle = (x / texSize) * Math.PI * 2 * frequency + phaseOffset;

                        // Add some organic "wobble" that also perfectly loops
                        const wobbleAngle = (x / texSize) * Math.PI * 2 * (frequency * 2.5);
                        const organicY = baseY + Math.sin(angle) * amplitude + Math.sin(wobbleAngle) * (amplitude * 0.3) + yOffset;

                        if (x === 0) {
                            ctx2d.moveTo(x, organicY);
                        } else {
                            ctx2d.lineTo(x, organicY);
                        }
                    }
                    ctx2d.stroke();
                }
            }

            // Reset blur so we don't bleed into other operations accidentally
            ctx2d.shadowBlur = 0;
        };

        // 3. Draw Topography Layers (Damascus / Dark Matter style)

        // Base Layer: Deep thick purple traces
        drawSeamlessWave("rgba(80, 0, 255, 0.4)", 8, 15, 60, 2, 0, 100);

        // Mid Layer: Neon pink energy
        drawSeamlessWave("rgba(255, 0, 180, 0.6)", 4, 10, 40, 3, Math.PI / 4, 80);

        // Top Layer: Thin, sharp, bright cyan electrical lines
        drawSeamlessWave("rgba(0, 255, 255, 0.9)", 2, 5, 20, 5, Math.PI, 60);

        // Optional: Very thin white core lines for intensity
        drawSeamlessWave("rgba(255, 255, 255, 0.8)", 1, 2, 20, 5, Math.PI, 60);

        dynamicTexture.update();
        dynamicTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
        dynamicTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
        dynamicTexture.hasAlpha = false; // We use a solid background now

        const obs = ctx.scene.onBeforeRenderObservable.add(() => {
            const dt = ctx.scene.getEngine().getDeltaTime() / 1000;
            dynamicTexture.uOffset += dt * 0.15;
            dynamicTexture.vOffset += dt * 0.1;
        });

        dynamicTexture.onDisposeObservable.add(() => {
            ctx.scene.onBeforeRenderObservable.remove(obs);
        });

        return dynamicTexture;
    };

    const applyPackAPunchMaterial = (
        ctx: StateManager,
        weapon: WeaponState,
        papCamoTex: BABYLON.DynamicTexture
    ) => {
        if (!weapon.mesh) return;

        weapon.mesh.setEnabled(true);

        const newPapMats: (BABYLON.PBRMaterial | BABYLON.StandardMaterial)[] = [];

        weapon.mesh.getChildMeshes().forEach((c: BABYLON.AbstractMesh) => {
            if (c instanceof BABYLON.Mesh && c.material) {
                const matName = c.material.name.toLowerCase();
                if (matName.includes("glass") || matName.includes("lens") || matName.includes("glow") || matName.includes("effect")) {
                    return;
                }

                if (!c.metadata?.originalMaterial) {
                    c.metadata = { ...c.metadata, originalMaterial: c.material };
                } else if (c.material && c.material !== c.metadata.originalMaterial) {
                    // Dispose the previous upgraded material to prevent observer leaks
                    c.material.dispose();
                }

                const papMat = c.metadata.originalMaterial.clone(c.metadata.originalMaterial.name + "_pap") as BABYLON.PBRMaterial | BABYLON.StandardMaterial;


                if (papMat instanceof BABYLON.PBRMaterial) {
                    papMat.metallic = 1.0;
                    papMat.roughness = Math.min(papMat.roughness ?? 0.5, 0.2);
                    papMat.emissiveTexture = papCamoTex;
                    papMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
                    newPapMats.push(papMat);
                } else if (papMat instanceof BABYLON.StandardMaterial) {
                    papMat.emissiveTexture = papCamoTex;
                    papMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
                }

                c.material = papMat;
            }
        });

        if (newPapMats.length > 0) {
            const timeObs = ctx.scene.onBeforeRenderObservable.add(() => {
                const time = Date.now() / 1000;
                const intensity = 1.0 + Math.sin(time * 4) * 0.4;
                for (let i = 0; i < newPapMats.length; i++) {
                    (newPapMats[i] as BABYLON.PBRMaterial).emissiveIntensity = intensity;
                }
            });

            // Cleanup the shared observer when ANY of the upgraded materials are disposed.
            // (They are all disposed together when the weapon is swapped or re-packed).
            newPapMats[0].onDisposeObservable.add(() => {
                ctx.scene.onBeforeRenderObservable.remove(timeObs);
            });
        }
    };

    const performPackAPunch = (targetMachine: BABYLON.AbstractMesh) => {
        if (ctx.gameState.isPackAPunching) return;
        const weapon = ctx.gameState.weapons[ctx.gameState.activeWeaponIndex];
        if (weapon.isPacked) return;

        ctx.gameState.isPackAPunching = true;
        const anchorPos = findPapAnchorPosition(targetMachine);
        setupPackAPunchAnimation(targetMachine, weapon, anchorPos, ctx.scene, ctx);

        ctx.timerManager.schedule('pap_upgrade', 3000, () => {
            applyPackAPunchUpgrade(weapon, ctx);

            const papCamoTex = ctx.resourceManager.getTexture("papCamoTex", () => {
                return createPackAPunchTexture(ctx);
            }) as BABYLON.DynamicTexture;

            applyPackAPunchMaterial(ctx, weapon, papCamoTex);

            ctx.setAmmo(weapon.currentAmmo);
            ctx.setReserveAmmo(weapon.currentReserve);
            ctx.setWeaponName(weapon.name);

            ctx.gameState.isPackAPunching = false;
            ctx.setInteractionMsg("WEAPON UPGRADED!");

            ctx.timerManager.schedule('pap_msg_clear', ctx.configManager.visuals.HUD_MSG_DURATION || 2000, () => ctx.setInteractionMsg(null));
        });
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
        },
        packAPunch: (mesh: BABYLON.AbstractMesh) => {
            performPackAPunch(mesh);
        }
    };

    const init = () => {
        ctx.eventBus.on('DOOR_OPEN_REQUEST', handlers.doorOpen);
        ctx.eventBus.on('POWER_ON_REQUEST', handlers.powerOn);
        ctx.eventBus.on('WEAPON_PICKUP_REQUEST', handlers.weaponPickup);
        ctx.eventBus.on('PACK_A_PUNCH_REQUEST', handlers.packAPunch);
    };

    const dispose = () => {
        ctx.eventBus.off('DOOR_OPEN_REQUEST', handlers.doorOpen);
        ctx.eventBus.off('POWER_ON_REQUEST', handlers.powerOn);
        ctx.eventBus.off('WEAPON_PICKUP_REQUEST', handlers.weaponPickup);
        ctx.eventBus.off('PACK_A_PUNCH_REQUEST', handlers.packAPunch);
        cleanupPapAnimation();
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
