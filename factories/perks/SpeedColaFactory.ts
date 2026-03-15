
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { resolveModelTransform, ModelTransform } from '../../config/modelTransforms';
import { configurePerkModel, createPerkFallback } from './perkUtils';

export const createSpeedCola = (scene: BABYLON.Scene, shadowCasters: BABYLON.AbstractMesh[], position: BABYLON.Vector3, rotationY: number = 0, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) => {
    const root = new BABYLON.TransformNode("speedColaRoot", scene);
    root.position = position;
    root.rotation.y = rotationY;

    // Interaction Trigger
    const trigger = BABYLON.MeshBuilder.CreateBox("speedColaTrigger", {width: 2, height: 2, depth: 2}, scene);
    trigger.parent = root; 
    trigger.position.y = 1; 
    trigger.visibility = 0; 
    trigger.checkCollisions = false;

    // Collision Box
    const collisionBox = BABYLON.MeshBuilder.CreateBox("scCollision", {height: 2.4, width: 1.8, depth: 1.4}, scene);
    collisionBox.parent = root;
    collisionBox.position.y = 1.1;
    collisionBox.visibility = 0;
    collisionBox.checkCollisions = true;

    // Load 3D Model
    const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.SPEED_COLA, scene)
        .then((result) => {
            if (scene.isDisposed) return;

            const model = result.meshes[0];
            model.parent = root;
            
            // Reset transforms relative to root
            const tx = resolveModelTransform('speed_cola', modelOverride);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

            configurePerkModel(result.meshes, shadowCasters);
        })
        .catch((e) => {
            if (scene.isDisposed) return;
            console.error("Failed to load Speed Cola model:", e);
            createPerkFallback(scene, root, "scFallback", new BABYLON.Color3(0.2, 0.8, 0.2),
                { height: 2.2, width: 1.2, depth: 0.8 }, 1.1);
        });

    if (promises) promises.push(p);

    return root;
};
