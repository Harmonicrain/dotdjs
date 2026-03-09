import * as BABYLON from '@babylonjs/core';
import { MysteryBoxState, WeaponState } from '../types/index';
import { MysteryBoxSystem } from '../types/systems';
import { StateManager } from '../state/StateManager';

/**
 * MysteryBoxSystem
 *
 * Manages the state and animations of the Mystery Box.
 * Handles opening, weapon rolling, weapon presentation, and relocating (Teddy Bear).
 * Uses MapConfigManager for map-specific tuning.
 */
export const createMysteryBoxSystem = (stateManager: StateManager): MysteryBoxSystem => {

    const transition = (newState: MysteryBoxState, duration: number = 0) => {
        stateManager.mysteryBox.state = newState;
        stateManager.mysteryBox.stateTimer = duration;
    };

    const getActiveInstance = () => {
        const box = stateManager.mysteryBox;
        if (box.instances.length === 0) return null;
        return box.instances[box.activeLocationIndex] || null;
    };

    const updateBoxVisibility = (force: boolean = false) => {
        const box = stateManager.mysteryBox;

        const len = box.instances.length;
        if (len === 0) return;

        // Only show the active box
        const activeIdx = box.activeLocationIndex;
        for (let i = 0; i < len; i++) {
            const inst = box.instances[i];
            const show = i === activeIdx;
            if (inst.mesh) inst.mesh.setEnabled(show);
            if (inst.trigger) inst.trigger.setEnabled(show);
        }
    };

    const updateGlow = (activeInstance: ReturnType<typeof getActiveInstance>, intensity: number) => {
        if (!activeInstance) return;
        if (activeInstance.glowLight) {
            activeInstance.glowLight.intensity = BABYLON.Scalar.Lerp(activeInstance.glowLight.intensity, intensity, 0.1);
        }
        if (activeInstance.beamMesh && activeInstance.beamMesh.material) {
            const mat = activeInstance.beamMesh.material as BABYLON.StandardMaterial;
            activeInstance.beamMesh.visibility = intensity > 0.1 ? 1 : 0;
            mat.alpha = BABYLON.Scalar.Lerp(mat.alpha, Math.min(intensity * 0.1, 0.3), 0.1);
        }
        if (activeInstance.glowPlaneMesh && activeInstance.glowPlaneMesh.material) {
            const mat = activeInstance.glowPlaneMesh.material as BABYLON.StandardMaterial;
            mat.alpha = BABYLON.Scalar.Lerp(mat.alpha, Math.min(intensity * 0.2, 0.8), 0.1);
        }
    };

    /** Updates weapon display during rolling/presentation (shared pattern) */
    const updateWeaponDisplay = (
        anchor: BABYLON.TransformNode | null,
        showIndex: number | null,
        weapons: typeof stateManager.configManager.weapons,
        resultWeaponId: string | null = null,
        animateOptions?: { rotSpeed: number; posY: number; scale: number }
    ) => {
        if (!anchor) return;
        const children = anchor.getChildren();
        children.forEach((node, i) => {
            const c = node as BABYLON.TransformNode;
            if (c.name === "box_teddy") { c.setEnabled(false); return; }

            const isVisible = resultWeaponId
                ? (resultWeaponId === weapons[i]?.id && c.name !== "box_teddy")
                : (i === showIndex);

            c.setEnabled(isVisible);

            if (isVisible && animateOptions) {
                c.rotation.y += animateOptions.rotSpeed;
                c.position.y = animateOptions.posY;
                c.scaling.copyFromFloats(animateOptions.scale, animateOptions.scale, animateOptions.scale);
            }
        });
    };

    // ── State Handlers ───────────────────────────────────────────────────────

    const handleBoxIdle = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>) => {
        box.lidAngle = BABYLON.Scalar.Lerp(box.lidAngle, 0, 0.1);
        updateGlow(activeInstance, 0);
        if (activeInstance?.weaponAnchor) {
            activeInstance.weaponAnchor.getChildren().forEach(c => c.setEnabled(false));
        }
    };

    const handleBoxOpening = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>, isAuthority: boolean) => {
        box.lidAngle = BABYLON.Scalar.Lerp(box.lidAngle, -Math.PI / 2.5, 0.1);
        updateGlow(activeInstance, 5);
        if (isAuthority && box.stateTimer <= 0) {
            transition(MysteryBoxState.BOX_ROLLING, stateManager.configManager.mysteryBox.TIMING.ROLLING);
        }
    };

    const handleBoxRolling = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>, isAuthority: boolean, weapons: typeof stateManager.configManager.weapons) => {
        box.lidAngle = -Math.PI / 2.5;
        const glowPulse = 5 + Math.sin(Date.now() * 0.01) * 1.5;
        updateGlow(activeInstance, glowPulse);

        const cycleSpeed = 100;
        const index = Math.floor(Date.now() / cycleSpeed) % weapons.length;
        box.currentWeaponIndex = index;

        updateWeaponDisplay(activeInstance?.weaponAnchor || null, index, weapons, null, {
            rotSpeed: 0.1,
            posY: 0.5 + Math.sin(Date.now() * 0.01) * 0.1,
            scale: 2
        });

        if (isAuthority && box.stateTimer <= 0) {
            const mbc = stateManager.configManager.mysteryBox;
            const isTeddy = Math.random() < mbc.TEDDY_CHANCE;
            if (isTeddy) {
                transition(MysteryBoxState.BOX_TEDDY_REVEAL, mbc.TIMING.TEDDY_REVEAL);
            } else {
                const currentWeaponIds = stateManager.gameState.weapons.map((w: WeaponState) => w.id);
                const availableWeapons = weapons.filter(w => !currentWeaponIds.includes(w.id));
                const pool = availableWeapons.length > 0 ? availableWeapons : weapons;
                const winWeapon = pool[Math.floor(Math.random() * pool.length)];
                const originalIndex = weapons.findIndex(w => w.id === winWeapon.id);

                box.resultWeaponId = winWeapon.id;
                box.currentWeaponIndex = originalIndex;
                transition(MysteryBoxState.BOX_WEAPON_PRESENT, mbc.TIMING.WEAPON_PRESENT);
            }
        }
    };

    const handleBoxWeaponPresent = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>, isAuthority: boolean, weapons: typeof stateManager.configManager.weapons) => {
        updateWeaponDisplay(activeInstance?.weaponAnchor || null, null, weapons, box.resultWeaponId, {
            rotSpeed: 0.02,
            posY: 0.8,
            scale: 2
        });
        if (isAuthority && box.stateTimer <= 0) {
            transition(MysteryBoxState.BOX_CLOSING_TIMEOUT, stateManager.configManager.mysteryBox.TIMING.CLOSING);
        }
    };

    const handleBoxClosing = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>, isAuthority: boolean) => {
        box.lidAngle = BABYLON.Scalar.Lerp(box.lidAngle, 0, 0.15);
        updateGlow(activeInstance, 0);
        if (activeInstance?.weaponAnchor) {
            const children = activeInstance.weaponAnchor.getChildren();
            children.forEach(node => {
                const c = node as BABYLON.TransformNode;
                if (c.isEnabled()) {
                    c.scaling.scaleInPlace(0.9);
                    if (c.scaling.x < 0.1) c.setEnabled(false);
                }
            });
        }
        if (isAuthority && box.stateTimer <= 0) {
            if (activeInstance?.weaponAnchor) {
                const children = activeInstance.weaponAnchor.getChildren();
                children.forEach(node => {
                    const t = node as BABYLON.TransformNode;
                    t.scaling.copyFromFloats(2, 2, 2);
                    t.setEnabled(false);
                });
            }
            transition(MysteryBoxState.BOX_IDLE);
        }
    };

    const handleBoxTeddyReveal = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>, isAuthority: boolean) => {
        if (activeInstance?.weaponAnchor) {
            const mbc = stateManager.configManager.mysteryBox;
            activeInstance.weaponAnchor.getChildren().forEach((node) => {
                const c = node as BABYLON.TransformNode;
                if (c.name === "box_teddy") {
                    c.setEnabled(true);
                    const progress = 1 - (box.stateTimer / mbc.TIMING.TEDDY_REVEAL);
                    c.position.y = BABYLON.Scalar.Lerp(0, 1.2, progress);
                    c.rotation.y += 0.05;
                    c.scaling.copyFromFloats(1.5, 1.5, 1.5);
                } else {
                    c.setEnabled(false);
                }
            });
        }
        if (isAuthority && box.stateTimer <= 0) {
            transition(MysteryBoxState.BOX_TEDDY_WAIT, stateManager.configManager.mysteryBox.TIMING.TEDDY_WAIT);
        }
    };

    const handleBoxTeddyWait = (box: typeof stateManager.mysteryBox, isAuthority: boolean) => {
        if (box.weaponAnchor && box.teddyMesh) {
            box.teddyMesh.rotation.y += 0.02;
        }
        if (isAuthority && box.stateTimer <= 0) {
            transition(MysteryBoxState.BOX_TELEPORT_OUT, stateManager.configManager.mysteryBox.TIMING.TELEPORT);
        }
    };

    const handleBoxTeleportOut = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>, isAuthority: boolean) => {
        if (activeInstance?.mesh) {
            activeInstance.mesh.scaling.scaleInPlace(0.9);
        }
        if (isAuthority && box.stateTimer <= 0) {
            transition(MysteryBoxState.BOX_RELOCATING);
        }
    };

    const handleBoxRelocating = (box: typeof stateManager.mysteryBox, isAuthority: boolean) => {
        if (isAuthority) {
            let newIndex = Math.floor(Math.random() * stateManager.boxLocations.length);
            if (newIndex === box.activeLocationIndex && stateManager.boxLocations.length > 1) {
                newIndex = (newIndex + 1) % stateManager.boxLocations.length;
            }
            box.activeLocationIndex = newIndex;

            updateBoxVisibility(true);

            // Get the NEW active instance after index change
            const newActiveInstance = box.instances[box.activeLocationIndex];
            if (newActiveInstance?.mesh) {
                newActiveInstance.mesh.position = stateManager.boxLocations[newIndex];
                newActiveInstance.mesh.rotation.y = stateManager.boxRotations[newIndex];
                newActiveInstance.mesh.scaling.copyFromFloats(1, 1, 1);
                box.lidAngle = 0;
            }
            transition(MysteryBoxState.BOX_IDLE);
        } else {
            // Client: get the current active instance (index was updated from host state)
            const currentActiveInstance = box.instances[box.activeLocationIndex];
            if (currentActiveInstance?.mesh) {
                currentActiveInstance.mesh.position = stateManager.boxLocations[box.activeLocationIndex];
                currentActiveInstance.mesh.rotation.y = stateManager.boxRotations[box.activeLocationIndex];
                currentActiveInstance.mesh.scaling.copyFromFloats(1, 1, 1);
            }
        }
    };

    // ── Main Update Loop ─────────────────────────────────────────────────────

    const update = (dt: number) => {
        const box = stateManager.mysteryBox;

        if (box.instances.length === 0) return;

        updateBoxVisibility();

        if (box.stateTimer > 0) {
            box.stateTimer -= dt * 1000;
        }

        const isAuthority = stateManager.gameModeRef.current === 'SOLO' || stateManager.gameModeRef.current === 'HOST';
        const weapons = stateManager.configManager.weapons;
        const activeInstance = box.instances[box.activeLocationIndex];
        if (!activeInstance) return;

        switch (box.state) {
            case MysteryBoxState.BOX_IDLE:
                handleBoxIdle(box, activeInstance);
                break;
            case MysteryBoxState.BOX_OPENING:
                handleBoxOpening(box, activeInstance, isAuthority);
                break;
            case MysteryBoxState.BOX_ROLLING:
                handleBoxRolling(box, activeInstance, isAuthority, weapons);
                break;
            case MysteryBoxState.BOX_WEAPON_PRESENT:
                handleBoxWeaponPresent(box, activeInstance, isAuthority, weapons);
                break;
            case MysteryBoxState.BOX_CLOSING_SUCCESS:
            case MysteryBoxState.BOX_CLOSING_TIMEOUT:
                handleBoxClosing(box, activeInstance, isAuthority);
                break;
            case MysteryBoxState.BOX_TEDDY_REVEAL:
                handleBoxTeddyReveal(box, activeInstance, isAuthority);
                break;
            case MysteryBoxState.BOX_TEDDY_WAIT:
                handleBoxTeddyWait(box, isAuthority);
                break;
            case MysteryBoxState.BOX_TELEPORT_OUT:
                handleBoxTeleportOut(box, activeInstance, isAuthority);
                break;
            case MysteryBoxState.BOX_RELOCATING:
                handleBoxRelocating(box, isAuthority);
                break;
        }

        // Always use the current active instance for lid rotation (may have changed during relocation)
        const currentInstance = box.instances[box.activeLocationIndex];
        if (currentInstance?.lidMesh) {
            currentInstance.lidMesh.rotation.x = box.lidAngle;
        }
    };

    const interact = (remotePlayerName?: string, costOverride?: number) => {
        const box = stateManager.mysteryBox;
        const boxCost = costOverride ?? stateManager.configManager.mysteryBox.COST;

        if (box.state === MysteryBoxState.BOX_IDLE) {
            if (remotePlayerName) {
                transition(MysteryBoxState.BOX_OPENING, stateManager.configManager.mysteryBox.TIMING.OPENING);
                box.ownerName = remotePlayerName;
                return true;
            }
            if (stateManager.gameState.points >= boxCost) {
                stateManager.gameState.points -= boxCost;
                stateManager.setPoints(stateManager.gameState.points);
                transition(MysteryBoxState.BOX_OPENING, stateManager.configManager.mysteryBox.TIMING.OPENING);
                box.ownerName = stateManager.gameState.playerName;
                return true;
            }
            return "NO_POINTS";
        }
        else if (box.state === MysteryBoxState.BOX_WEAPON_PRESENT) {
            const owner = remotePlayerName || stateManager.gameState.playerName;
            if (box.ownerName === owner) {
                transition(MysteryBoxState.BOX_CLOSING_SUCCESS, stateManager.configManager.mysteryBox.TIMING.CLOSING);
                if (box.resultWeaponId) return box.resultWeaponId;
            }
        }
        return false;
    };

    return { update, interact };
};
