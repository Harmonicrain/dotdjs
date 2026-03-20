
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { resolveModelTransform, ModelTransform } from '../../config/modelTransforms';
import { configurePerkModel, createPerkFallback } from './perkUtils';

export const createMuleKick = (scene: BABYLON.Scene, shadowCasters: BABYLON.AbstractMesh[], position: BABYLON.Vector3, rotationY: number = 0, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) => {
    const root = new BABYLON.TransformNode("muleKickRoot", scene);
    root.position = position;
    root.rotation.y = rotationY;

    // Interaction Trigger
    const trigger = BABYLON.MeshBuilder.CreateBox("muleKickTrigger", { width: 2, height: 2, depth: 2 }, scene);
    trigger.parent = root;
    trigger.position.y = 1;
    trigger.visibility = 0;
    trigger.checkCollisions = false;

    // Collision Box
    const collisionBox = BABYLON.MeshBuilder.CreateBox("mkCollision", { height: 2.2, width: 1.3, depth: 1.3 }, scene);
    collisionBox.parent = root;
    collisionBox.position.y = 1;
    collisionBox.visibility = 0;
    collisionBox.checkCollisions = true;

    // Load 3D Model
    const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.MULE_KICK, scene)
        .then((result) => {
            if (scene.isDisposed) return;

            const model = result.meshes[0];
            model.parent = root;

            // Reset transforms relative to root
            const tx = resolveModelTransform('mule_kick', modelOverride);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

            configurePerkModel(result.meshes, shadowCasters);
        })
        .catch((e) => {
            if (scene.isDisposed) return;
            console.error("Failed to load Mule Kick model:", e);
            createPerkFallback(scene, root, "mkFallback", new BABYLON.Color3(0.5, 0.1, 0.8));
        });

    if (promises) promises.push(p);

    return root;
};
