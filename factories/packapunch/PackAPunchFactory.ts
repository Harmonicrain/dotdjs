
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { resolveModelTransform, ModelTransform } from '../../config/modelTransforms';

export const createPackAPunchMachine = (scene: BABYLON.Scene, position: BABYLON.Vector3, rotationY: number, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) => {
    const root = new BABYLON.TransformNode("papRoot", scene);
    root.position = position;
    root.rotation.y = rotationY;

    // Interaction Trigger
    const trigger = BABYLON.MeshBuilder.CreateBox("papTrigger", { width: 2.5, height: 2.5, depth: 2.5 }, scene);
    trigger.parent = root;
    trigger.position.y = 1;
    trigger.visibility = 0;
    trigger.checkCollisions = false;

    // Weapon Animation Anchor (Critical for InteractionSystem animations)
    // This node represents where the weapon floats during the upgrade sequence.
    const anchor = new BABYLON.TransformNode("papWeaponAnchor", scene);
    anchor.parent = root;
    anchor.position = new BABYLON.Vector3(-0.7, 1.4, 0.3); // Positioned slightly front and up

    // Load 3D Model
    const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.PACK_A_PUNCH, scene)
        .then((result) => {
            if (scene.isDisposed) return;

            const model = result.meshes[0];
            model.parent = root;
            
            // Reset transforms relative to root
            const tx = resolveModelTransform('pack_a_punch', modelOverride);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

            // Register shadow casters & collisions
            result.meshes.forEach(m => {
                if (m instanceof BABYLON.Mesh) {
                    m.checkCollisions = true;
                    // Limit lights to prevent shader overflow
                    if (m.material) {
                        (m.material as any).maxSimultaneousLights = 4;
                    }
                }
            });
        })
        .catch((e) => {
            if (scene.isDisposed) return;
            console.error("Failed to load Pack-a-Punch model:", e);
            
            // Fallback visual (Blue/Metal Box)
            const fallback = BABYLON.MeshBuilder.CreateBox("papFallback", {width: 1.8, height: 1.5, depth: 1}, scene);
            fallback.parent = root;
            fallback.position.y = 0.75;
            
            const mat = new BABYLON.StandardMaterial("errMatPAP", scene);
            mat.diffuseColor = new BABYLON.Color3(0.4, 0.5, 0.6);
            fallback.material = mat;
        });

    if (promises) promises.push(p);

    return root;
};
