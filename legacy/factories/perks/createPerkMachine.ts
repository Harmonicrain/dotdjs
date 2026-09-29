
import * as BABYLON from '@babylonjs/core';
import { resolveModelTransform, ModelTransform } from '../../config/modelTransforms';
import { configurePerkModel, createPerkFallback } from './perkUtils';

export interface PerkMachineConfig {
    name: string;
    modelUrl: string;
    transformKey: string;
    triggerName: string;
    collisionName: string;
    collisionBox: { height: number; width: number; depth: number };
    collisionY?: number;
    fallbackName: string;
    fallbackColor: BABYLON.Color3;
    fallbackSize?: { height: number; width: number; depth: number };
    fallbackY?: number;
}

export const createPerkMachine = (
    config: PerkMachineConfig,
    scene: BABYLON.Scene,
    shadowCasters: BABYLON.AbstractMesh[],
    position: BABYLON.Vector3,
    rotationY: number = 0,
    modelOverride?: Partial<ModelTransform>,
    promises?: Promise<any>[]
) => {
    const root = new BABYLON.TransformNode(`${config.name}Root`, scene);
    root.position = position;
    root.rotation.y = rotationY;

    // Interaction Trigger
    const trigger = BABYLON.MeshBuilder.CreateBox(config.triggerName, { width: 2, height: 2, depth: 2 }, scene);
    trigger.parent = root;
    trigger.position.y = 1;
    trigger.visibility = 0;
    trigger.checkCollisions = false;

    // Collision Box
    const collisionBox = BABYLON.MeshBuilder.CreateBox(config.collisionName, config.collisionBox, scene);
    collisionBox.parent = root;
    collisionBox.position.y = config.collisionY ?? 1;
    collisionBox.visibility = 0;
    collisionBox.checkCollisions = true;

    // Load 3D Model
    const p = BABYLON.SceneLoader.ImportMeshAsync("", "", config.modelUrl, scene)
        .then((result) => {
            if (scene.isDisposed) return;

            const model = result.meshes[0];
            model.parent = root;

            const tx = resolveModelTransform(config.transformKey, modelOverride);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

            configurePerkModel(result.meshes, shadowCasters);
        })
        .catch((e) => {
            if (scene.isDisposed) return;
            console.error(`Failed to load ${config.name} model:`, e);
            createPerkFallback(scene, root, config.fallbackName, config.fallbackColor,
                config.fallbackSize, config.fallbackY);
        });

    if (promises) promises.push(p);

    return root;
};
