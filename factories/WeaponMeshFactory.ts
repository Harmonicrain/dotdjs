
import * as BABYLON from '@babylonjs/core';
import { WEAPON_CONFIGS, MODELS } from '../config';
import { resolveModelTransform, ModelTransform } from '../config/modelTransforms';

function loadWeaponModel(
    scene: BABYLON.Scene,
    parentNode: BABYLON.TransformNode,
    modelUrl: string,
    transformKey: string,
    modelOverride: Partial<ModelTransform> | undefined,
    isFps: boolean,
    promises?: Promise<void>[]
): void {
    const p = BABYLON.SceneLoader.ImportMeshAsync("", "", modelUrl, scene).then((result) => {
        if (scene.isDisposed || parentNode.isDisposed()) return;
        const model = result.meshes[0];
        model.parent = parentNode;
        const tx = resolveModelTransform(transformKey, modelOverride);
        if (tx.rotation) model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
        if (tx.scaling) model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);
        if (tx.position) model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
        
        result.meshes.forEach(m => {
            m.checkCollisions = false;
            m.isPickable = false;
            if (isFps) {
                m.renderingGroupId = 1;
                if (m.material) {
                    m.metadata = { ...m.metadata, originalMaterial: m.material };
                }
            }
        });

        if (isFps && result.animationGroups && result.animationGroups.length > 0) {
            result.animationGroups.forEach(ag => {
                ag.stop();
                ag.loopAnimation = false;
            });
            parentNode.metadata = { ...parentNode.metadata, animationGroups: result.animationGroups };
        }
    }).catch(e => {
        if (scene.isDisposed || parentNode.isDisposed()) return;
        console.warn(`Failed to load weapon model ${transformKey}:`, e);
    });
    if (promises) promises.push(p);
}

export const createWorldWeapon = (scene: BABYLON.Scene, weaponId: string, parent: BABYLON.TransformNode, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) => {
    const root = new BABYLON.TransformNode("worldWeapon_" + weaponId, scene);
    root.parent = parent;
    
    let gunMat = scene.getMaterialByName("gunMat") as BABYLON.PBRMaterial;
    if (!gunMat) {
        gunMat = new BABYLON.PBRMaterial("gunMat", scene);
        gunMat.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2); 
        gunMat.metallic = 0.9;
        gunMat.roughness = 0.4;
    }

    if (weaponId === 'pistol') {
        loadWeaponModel(scene, root, MODELS.M1911, 'm1911_world', modelOverride, false, promises);
    } 
    else if (weaponId === 'rifle') {
        loadWeaponModel(scene, root, MODELS.STG44, 'stg44_world', modelOverride, false, promises);
    }
    else if (weaponId === 'shotgun') {
        loadWeaponModel(scene, root, MODELS.SHOTGUN, 'shotgun_world', modelOverride, false, promises);
    }
    else if (weaponId === 'famas') {
        loadWeaponModel(scene, root, MODELS.FAMAS, 'famas_world', modelOverride, false, promises);
    }
    else if (weaponId === 'ray_gun') {
        loadWeaponModel(scene, root, MODELS.RAY_GUN, 'ray_gun_world', modelOverride, false, promises);
    }
    else if (weaponId === 'fn_fal') {
        loadWeaponModel(scene, root, MODELS.FN_FAL, 'fn_fal_world', modelOverride, false, promises);
    }
    else if (weaponId === 'm1_garand') {
        loadWeaponModel(scene, root, MODELS.M1_GARAND, 'm1_garand_world', modelOverride, false, promises);
    }

    return root;
};

export const createWeapons = (scene: BABYLON.Scene, camera: BABYLON.Camera, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) => {
    const weaponMap: { [key: string]: BABYLON.TransformNode } = {};
    
    // FPS Gun Material (Dark Gunmetal PBR)
    const gunMat = new BABYLON.PBRMaterial("gunMatFPS", scene);
    gunMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    gunMat.metallic = 0.9;
    gunMat.roughness = 0.35;
    gunMat.environmentIntensity = 0.6;

    // Pistol
    const pistolRoot = new BABYLON.TransformNode("fps_pistol", scene);
    pistolRoot.parent = camera;
    pistolRoot.scaling = new BABYLON.Vector3(1, 1, 1);
    pistolRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5); 
    pistolRoot.setEnabled(false); 
    
    // Load FPS M1911 Model
    loadWeaponModel(scene, pistolRoot, MODELS.M1911, 'm1911_fps', modelOverride, true, promises);
    weaponMap['pistol'] = pistolRoot;

    // Rifle (STG-44)
    const rifleRoot = new BABYLON.TransformNode("fps_rifle", scene);
    rifleRoot.parent = camera;
    rifleRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    rifleRoot.setEnabled(false);

    loadWeaponModel(scene, rifleRoot, MODELS.STG44, 'stg44_fps', modelOverride, true, promises);
    weaponMap['rifle'] = rifleRoot;

    // Shotgun
    const shotRoot = new BABYLON.TransformNode("fps_shotgun", scene);
    shotRoot.parent = camera;
    shotRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    shotRoot.setEnabled(false);

    loadWeaponModel(scene, shotRoot, MODELS.SHOTGUN, 'shotgun_fps', modelOverride, true, promises);
    weaponMap['shotgun'] = shotRoot;

    // Famas
    const famasRoot = new BABYLON.TransformNode("fps_famas", scene);
    famasRoot.parent = camera;
    famasRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    famasRoot.setEnabled(false);

    loadWeaponModel(scene, famasRoot, MODELS.FAMAS, 'famas_fps', modelOverride, true, promises);
    weaponMap['famas'] = famasRoot;

    // FN FAL
    const fnFalRoot = new BABYLON.TransformNode("fps_fn_fal", scene);
    fnFalRoot.parent = camera;
    fnFalRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    fnFalRoot.setEnabled(false);

    loadWeaponModel(scene, fnFalRoot, MODELS.FN_FAL, 'fn_fal_fps', modelOverride, true, promises);
    weaponMap['fn_fal'] = fnFalRoot;

    // M1 Garand
    const m1GarandRoot = new BABYLON.TransformNode("fps_m1_garand", scene);
    m1GarandRoot.parent = camera;
    m1GarandRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    m1GarandRoot.setEnabled(false);

    loadWeaponModel(scene, m1GarandRoot, MODELS.M1_GARAND, 'm1_garand_fps', modelOverride, true, promises);
    weaponMap['m1_garand'] = m1GarandRoot;

    // Ray Gun
    const rayGunRoot = new BABYLON.TransformNode("fps_ray_gun", scene);
    rayGunRoot.parent = camera;
    rayGunRoot.scaling = new BABYLON.Vector3(1, 1, 1);
    rayGunRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    rayGunRoot.setEnabled(false);
    
    // Load Ray Gun Model
    loadWeaponModel(scene, rayGunRoot, MODELS.RAY_GUN, 'ray_gun_fps', modelOverride, true, promises);
    weaponMap['ray_gun'] = rayGunRoot;

    // Knife
    const knifeRoot = new BABYLON.Mesh("fps_knife", scene);
    knifeRoot.parent = camera;
    knifeRoot.scaling = new BABYLON.Vector3(1, 1, 1);
    knifeRoot.position = new BABYLON.Vector3(0.2, -0.2, 0.5);
    knifeRoot.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);
    
    const kBlade = BABYLON.MeshBuilder.CreateBox("fps_kBlade", {width: 0.02, height: 0.3, depth: 0.05}, scene);
    kBlade.parent = knifeRoot; kBlade.position.y = 0.15;
    
    const kMetal = new BABYLON.PBRMaterial("kMetal", scene);
    kMetal.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.85);
    kMetal.metallic = 0.95;
    kMetal.roughness = 0.2;
    kBlade.material = kMetal;

    const kHandle = BABYLON.MeshBuilder.CreateCylinder("fps_kHandle", {diameter: 0.04, height: 0.12}, scene);
    kHandle.parent = knifeRoot; kHandle.position.y = -0.06;
    
    const kWood = new BABYLON.PBRMaterial("kWood", scene);
    kWood.albedoColor = new BABYLON.Color3(0.4, 0.2, 0.1);
    kWood.metallic = 0.0;
    kWood.roughness = 0.7;
    kHandle.material = kWood;

    knifeRoot.setEnabled(false);
    weaponMap['knife'] = knifeRoot;

    return weaponMap;
};
