
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { resolveModelTransform, ModelTransform } from '../../config/modelTransforms';

export const createPowerSwitch = (scene: BABYLON.Scene, position: BABYLON.Vector3, rotationY: number, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) => {
    const root = new BABYLON.TransformNode("powerSwitch", scene);
    root.position = position; 
    root.rotation.y = rotationY;

    // Pivot used for manual rotation fallback when GLB animation is absent
    const handlePivot = new BABYLON.TransformNode("handlePivot", scene);
    handlePivot.parent = root;
    handlePivot.rotation.x = Math.PI / 4; // Initial State: Up/Off

    // Interaction Trigger
    const trigger = BABYLON.MeshBuilder.CreateBox("powerSwitchTrigger", {width: 1, height: 2, depth: 1}, scene);
    trigger.parent = root; 
    trigger.position.y = 0; 
    trigger.visibility = 0; 
    trigger.checkCollisions = false;

    // Will be resolved after async load
    let switchAnimationGroup: BABYLON.AnimationGroup | null = null;

    // Load Model
    const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.POWER_SWITCH, scene).then((result) => {
        if (scene.isDisposed || root.isDisposed()) return;
        const model = result.meshes[0];
        model.parent = root;
        
        const tx = resolveModelTransform('power_switch', modelOverride);
        model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
        model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
        model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

        result.meshes.forEach(m => {
            m.checkCollisions = false;
            m.isPickable = false;
            if (m.material instanceof BABYLON.PBRMaterial) {
                m.material.unlit = false;
                (m.material as any).maxSimultaneousLights = 4;
            }
        });

        // Grab the switch animation from the GLB (named "Po_Bo|Level_Down")
        if (result.animationGroups && result.animationGroups.length > 0) {
            switchAnimationGroup = result.animationGroups[0];
            // Stop it immediately — we'll play it on demand
            switchAnimationGroup.stop();
            switchAnimationGroup.reset();
            switchAnimationGroup.loopAnimation = false;
        } else {
            // Fallback: find handle mesh and attach to legacy pivot
            const handleMesh = result.meshes.find(m => m.name.toLowerCase().includes("handle"));
            if (handleMesh) {
                handleMesh.parent = handlePivot;
                handleMesh.rotation = BABYLON.Vector3.Zero();
                handleMesh.rotationQuaternion = null;
            }
        }

    }).catch((e) => {
        if (scene.isDisposed || root.isDisposed()) return; // expected during map transitions
        console.warn("Power Switch model failed to load", e);
        // Fallback procedural
        const box = BABYLON.MeshBuilder.CreateBox("powerBox", {width: 0.5, height: 0.8, depth: 0.2}, scene);
        box.parent = root;
        const handle = BABYLON.MeshBuilder.CreateBox("powerHandle", {width: 0.1, height: 0.4, depth: 0.1}, scene);
        handle.parent = handlePivot; handle.position.y = 0.2;
        const handleMat = new BABYLON.PBRMaterial("handleMat", scene);
        handleMat.albedoColor = new BABYLON.Color3(0.8, 0, 0);
        handleMat.metallic = 0.5; handleMat.roughness = 0.5;
        handle.material = handleMat;
    });

    if (promises) promises.push(p);

    /**
     * Call this when the player activates the switch.
     * Plays the GLB animation once and holds the final frame (on = activated/down state).
     */
    const activate = () => {
        if (switchAnimationGroup) {
            switchAnimationGroup.reset();
            switchAnimationGroup.loopAnimation = false;
            switchAnimationGroup.start(
                false,  // don't loop
                1.0,    // speed ratio
                switchAnimationGroup.from,
                switchAnimationGroup.to,
                false
            );
            // Hold last frame when animation finishes
            switchAnimationGroup.onAnimationGroupEndObservable.addOnce(() => {
                switchAnimationGroup!.pause();
                switchAnimationGroup!.goToFrame(switchAnimationGroup!.to);
            });
        } else {
            // Fallback: snap legacy pivot to "on" angle
            handlePivot.rotation.x = -Math.PI / 4;
        }
    };

    return { root, handle: handlePivot, activate };
};
