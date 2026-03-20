import * as BABYLON from '@babylonjs/core';
import { WeaponState } from '../types/index';
import { createWorldWeapon } from '../factories';
import { StateManager } from '../state/StateManager';

/**
 * PackAPunchSystem
 *
 * Event-driven system that handles the Pack-a-Punch upgrade sequence:
 * animation, procedural texture, material application, and stat upgrade.
 *
 * Listens for PACK_A_PUNCH_REQUEST events emitted by PackAPunchHandler.
 */
export const createPackAPunchSystem = (ctx: StateManager) => {
    const _tempInteractVec = new BABYLON.Vector3();
    const _tempInteractOffset = new BABYLON.Vector3(0, 1.2, 0);
    const _tempPapVec = new BABYLON.Vector3(0, 0, -0.5);

    // Tracks the active PaP animation observer so dispose() can clean it up
    // if the session resets before the 3s timer fires.
    let activePapAnimObs: BABYLON.Observer<BABYLON.Scene> | null = null;
    let activePapAnimMesh: BABYLON.TransformNode | null = null;

    const cleanupPapAnimation = () => {
        if (activePapAnimObs) {
            ctx.scene.onBeforeRenderObservable.remove(activePapAnimObs);
            activePapAnimObs = null;
        }
        if (activePapAnimMesh && !activePapAnimMesh.isDisposed()) {
            activePapAnimMesh.dispose();
            activePapAnimMesh = null;
        }
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

    const setupPackAPunchAnimation = (
        targetMachine: BABYLON.AbstractMesh,
        weapon: WeaponState,
        anchorPos: BABYLON.Vector3,
        scene: BABYLON.Scene
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

    const applyPackAPunchUpgrade = (weapon: WeaponState) => {
        const upgradeConfig = ctx.configManager.upgradedWeapons[weapon.id];
        if (upgradeConfig) {
            Object.assign(weapon, upgradeConfig);
            weapon.currentAmmo = weapon.clipSize;
            weapon.currentReserve = weapon.maxReserve;
            weapon.isPacked = true;
        }
    };

    const createPackAPunchTexture = (): BABYLON.DynamicTexture => {
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
        setupPackAPunchAnimation(targetMachine, weapon, anchorPos, ctx.scene);

        ctx.timerManager.schedule('pap_upgrade', 3000, () => {
            applyPackAPunchUpgrade(weapon);

            const papCamoTex = ctx.resourceManager.getTexture("papCamoTex", () => {
                return createPackAPunchTexture();
            }) as BABYLON.DynamicTexture;

            applyPackAPunchMaterial(weapon, papCamoTex);

            ctx.setAmmo(weapon.currentAmmo);
            ctx.setReserveAmmo(weapon.currentReserve);
            ctx.setWeaponName(weapon.name);
            ctx.setWeaponId(weapon.id);

            ctx.gameState.isPackAPunching = false;
            ctx.setInteractionMsg("WEAPON UPGRADED!");

            ctx.timerManager.schedule('pap_msg_clear', ctx.configManager.visuals.HUD_MSG_DURATION || 2000, () => ctx.setInteractionMsg(null));
        });
    };

    const handler = (mesh: BABYLON.AbstractMesh) => {
        performPackAPunch(mesh);
    };

    const init = () => {
        ctx.eventBus.on('PACK_A_PUNCH_REQUEST', handler);
    };

    const dispose = () => {
        ctx.eventBus.off('PACK_A_PUNCH_REQUEST', handler);
        cleanupPapAnimation();
    };

    return { init, dispose };
};
