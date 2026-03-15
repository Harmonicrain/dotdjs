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

    // Cache to skip redundant setEnabled calls when nothing relevant has changed
    let _visCache = { isFireSale: false, activeIdx: -1, boxState: '' as MysteryBoxState | '' };

    const updateBoxVisibility = (isFireSale: boolean) => {
        const box = stateManager.mysteryBox;

        const len = box.instances.length;
        if (len === 0) return;

        // Skip if the three inputs that drive visibility haven't changed
        if (
            _visCache.isFireSale === isFireSale &&
            _visCache.activeIdx === box.activeLocationIndex &&
            _visCache.boxState === box.state
        ) return;
        _visCache.isFireSale = isFireSale;
        _visCache.activeIdx = box.activeLocationIndex;
        _visCache.boxState = box.state;

        // Only show the active box, OR all boxes if fire sale is active
        const activeIdx = box.activeLocationIndex;
        for (let i = 0; i < len; i++) {
            const inst = box.instances[i];
            const show = i === activeIdx || isFireSale;

            if (inst.mesh && inst.mesh.isEnabled() !== show) {
                inst.mesh.setEnabled(show);
            }

            // During fire sale, non-active boxes can be interacted with as long as the global state is IDLE
            // (meaning no box is currently rolling/opening). The active box should always be interactable.
            const triggerShow = show && (box.state === MysteryBoxState.BOX_IDLE || i === activeIdx);
            if (inst.trigger && inst.trigger.isEnabled() !== triggerShow) {
                inst.trigger.setEnabled(triggerShow);
            }

            // Prevent EXTREME LAG: Ensure we don't enable multiple PointLights at once during Fire Sale
            // Enabling multiple lights suddenly forces BabylonJS to recompile all PBR materials
            if (inst.glowLight) {
                const lightShow = i === activeIdx && box.state !== MysteryBoxState.BOX_IDLE;
                if (inst.glowLight.isEnabled() !== lightShow) {
                    inst.glowLight.setEnabled(lightShow);
                }
            }
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
            if (c.name === "box_teddy") {
                if (c.isEnabled()) c.setEnabled(false);
                return;
            }

            const isVisible = resultWeaponId
                ? (resultWeaponId === weapons[i]?.id && c.name !== "box_teddy")
                : (i === showIndex);

            if (c.isEnabled() !== isVisible) {
                c.setEnabled(isVisible);
            }

            if (isVisible && animateOptions) {
                c.rotation.y += animateOptions.rotSpeed;
                c.position.y = animateOptions.posY;
                c.scaling.copyFromFloats(animateOptions.scale, animateOptions.scale, animateOptions.scale);
            }
        });
    };

    // ── State Handler constants ──────────────────────────────────────────────
    const ROLL_SINE_FREQ = 0.01; // frequency of glow pulse and weapon bob during rolling

    // ── State Handlers ───────────────────────────────────────────────────────

    const handleBoxIdle = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>) => {
        box.lidAngle = BABYLON.Scalar.Lerp(box.lidAngle, 0, 0.1);
        updateGlow(activeInstance, 0);

        // Ensure all instances are fully reset to idle state
        // This acts as a fallback for clients who might miss the instantaneous BOX_RELOCATING state sync
        for (let i = 0; i < box.instances.length; i++) {
            const inst = box.instances[i];
            if (inst.weaponAnchor) {
                inst.weaponAnchor.getChildren().forEach(c => {
                    const child = c as BABYLON.TransformNode;
                    if (child.isEnabled()) {
                        child.setEnabled(false);
                    }
                });
            }
            if (i !== box.activeLocationIndex) {
                if (inst.lidMesh && inst.lidMesh.rotation.x !== 0) inst.lidMesh.rotation.x = 0;
                if (inst.glowLight && inst.glowLight.intensity > 0) inst.glowLight.intensity = 0;
            }
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
        const glowPulse = 5 + Math.sin(Date.now() * ROLL_SINE_FREQ) * 1.5;
        updateGlow(activeInstance, glowPulse);

        const cycleSpeed = 100;
        const index = Math.floor(Date.now() / cycleSpeed) % weapons.length;
        box.currentWeaponIndex = index;

        updateWeaponDisplay(activeInstance?.weaponAnchor || null, index, weapons, null, {
            rotSpeed: 0.1,
            posY: 0.5 + Math.sin(Date.now() * ROLL_SINE_FREQ) * 0.1,
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
                    if (t.isEnabled()) t.setEnabled(false);
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
                    if (!c.isEnabled()) c.setEnabled(true);
                    const progress = 1 - (box.stateTimer / mbc.TIMING.TEDDY_REVEAL);
                    c.position.y = BABYLON.Scalar.Lerp(0, 1.2, progress);
                    c.rotation.y += 0.05;
                    c.scaling.copyFromFloats(1.5, 1.5, 1.5);
                } else {
                    if (c.isEnabled()) c.setEnabled(false);
                }
            });
        }
        if (isAuthority && box.stateTimer <= 0) {
            transition(MysteryBoxState.BOX_TEDDY_WAIT, stateManager.configManager.mysteryBox.TIMING.TEDDY_WAIT);
        }
    };

    const handleBoxTeddyWait = (box: typeof stateManager.mysteryBox, activeInstance: ReturnType<typeof getActiveInstance>, isAuthority: boolean, isFireSale: boolean) => {
        if (activeInstance?.weaponAnchor) {
            activeInstance.weaponAnchor.getChildren().forEach((node) => {
                const c = node as BABYLON.TransformNode;
                if (c.name === "box_teddy") {
                    c.rotation.y += 0.02;
                }
            });
        }
        if (isAuthority && box.stateTimer <= 0) {
            if (isFireSale) {
                transition(MysteryBoxState.BOX_CLOSING_SUCCESS, stateManager.configManager.mysteryBox.TIMING.CLOSING);
            } else {
                transition(MysteryBoxState.BOX_TELEPORT_OUT, stateManager.configManager.mysteryBox.TIMING.TELEPORT);
            }
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

    const handleBoxRelocating = (box: typeof stateManager.mysteryBox, isAuthority: boolean, isFireSale: boolean) => {
        if (isAuthority) {
            let newIndex = Math.floor(Math.random() * stateManager.boxLocations.length);
            if (newIndex === box.activeLocationIndex && stateManager.boxLocations.length > 1) {
                newIndex = (newIndex + 1) % stateManager.boxLocations.length;
            }
            box.activeLocationIndex = newIndex;

            updateBoxVisibility(isFireSale);
            transition(MysteryBoxState.BOX_IDLE);
        }

        // Host & Client: Cleanly reset ALL boxes to their stable state so the
        // old box has no leftover teddy bears or tiny scales during fire sales.
        box.lidAngle = 0;
        for (let i = 0; i < box.instances.length; i++) {
            const inst = box.instances[i];
            if (inst.mesh) {
                inst.mesh.position = stateManager.boxLocations[i];
                inst.mesh.rotation.y = stateManager.boxRotations[i];
                inst.mesh.scaling.copyFromFloats(1, 1, 1);
            }
            if (inst.lidMesh) {
                inst.lidMesh.rotation.x = 0;
            }
            if (inst.weaponAnchor) {
                inst.weaponAnchor.getChildren().forEach(c => {
                    const child = c as BABYLON.TransformNode;
                    if (child.isEnabled()) child.setEnabled(false);
                });
            }
            if (inst.glowLight) inst.glowLight.intensity = 0;
            if (inst.beamMesh && inst.beamMesh.material) {
                inst.beamMesh.visibility = 0;
                (inst.beamMesh.material as BABYLON.StandardMaterial).alpha = 0;
            }
            if (inst.glowPlaneMesh && inst.glowPlaneMesh.material) {
                (inst.glowPlaneMesh.material as BABYLON.StandardMaterial).alpha = 0;
            }
        }
    };

    // ── Main Update Loop ─────────────────────────────────────────────────────

    const update = (dt: number) => {
        const box = stateManager.mysteryBox;

        if (box.instances.length === 0) return;

        const isFireSale = stateManager.isFireSaleActive();

        if (isFireSale && box.originalLocationIndex === -1) {
            box.originalLocationIndex = box.activeLocationIndex;
        } else if (!isFireSale && box.originalLocationIndex !== -1) {
            if (box.state === MysteryBoxState.BOX_IDLE) {
                box.activeLocationIndex = box.originalLocationIndex;
                box.originalLocationIndex = -1;
            }
        }

        updateBoxVisibility(isFireSale);

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
                handleBoxTeddyWait(box, activeInstance, isAuthority, isFireSale);
                break;
            case MysteryBoxState.BOX_TELEPORT_OUT:
                handleBoxTeleportOut(box, activeInstance, isAuthority);
                break;
            case MysteryBoxState.BOX_RELOCATING:
                handleBoxRelocating(box, isAuthority, isFireSale);
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
