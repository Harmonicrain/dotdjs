
import * as BABYLON from '@babylonjs/core';
import { WEAPON_CONFIGS, MODELS } from '../config';
import { resolveModelTransform, ModelTransform } from '../config/modelTransforms';

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
        const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.M1911, scene).then((result) => {
            if (scene.isDisposed || root.isDisposed()) return;
            const model = result.meshes[0];
            model.parent = root;
            
            // Align orientation for world pickup (flat)
            const tx = resolveModelTransform('m1911_world', modelOverride);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
            
            result.meshes.forEach(m => {
                m.checkCollisions = false;
                m.isPickable = false;
            });
        }).catch(e => {
            if (scene.isDisposed || root.isDisposed()) return; // expected during map transitions
            console.warn("M1911 load failed", e);
        });
        if (promises) promises.push(p);
    } 
    else if (weaponId === 'rifle') {
        const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.STG44, scene).then((result) => {
            if (scene.isDisposed || root.isDisposed()) return;
            const model = result.meshes[0];
            model.parent = root;

            const tx = resolveModelTransform('stg44_world', modelOverride);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);

            result.meshes.forEach(m => {
                m.checkCollisions = false;
                m.isPickable = false;
            });
        }).catch(e => {
            if (scene.isDisposed || root.isDisposed()) return;
            console.warn("STG-44 world load failed", e);
        });
        if (promises) promises.push(p);
    }
    else if (weaponId === 'shotgun') {
        const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.SHOTGUN, scene).then((result) => {
            if (scene.isDisposed || root.isDisposed()) return;
            const model = result.meshes[0];
            model.parent = root;

            const tx = resolveModelTransform('shotgun_world', modelOverride);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);

            result.meshes.forEach(m => {
                m.checkCollisions = false;
                m.isPickable = false;
            });
        }).catch(e => {
            if (scene.isDisposed || root.isDisposed()) return;
            console.warn("Shotgun world load failed", e);
        });
        if (promises) promises.push(p);
    }
    else if (weaponId === 'famas') {
        const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.FAMAS, scene).then((result) => {
            if (scene.isDisposed || root.isDisposed()) return;
            const model = result.meshes[0];
            model.parent = root;

            const tx = resolveModelTransform('famas_world', modelOverride);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);

            result.meshes.forEach(m => {
                m.checkCollisions = false;
                m.isPickable = false;
            });
        }).catch(e => {
            if (scene.isDisposed || root.isDisposed()) return;
            console.warn("FAMAS load failed", e);
        });
        if (promises) promises.push(p);
    }
    else if (weaponId === 'ray_gun') {
        const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.RAY_GUN, scene).then((result) => {
            if (scene.isDisposed || root.isDisposed()) return;
            const model = result.meshes[0];
            model.parent = root;
            
            const tx = resolveModelTransform('ray_gun_world', modelOverride);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
            
            result.meshes.forEach(m => {
                m.checkCollisions = false;
                m.isPickable = false;
            });
        }).catch(e => {
            if (scene.isDisposed || root.isDisposed()) return;
            console.warn("Ray Gun load failed", e);
        });
        if (promises) promises.push(p);
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
    const p1 = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.M1911, scene).then((result) => {
        if (scene.isDisposed || pistolRoot.isDisposed()) return;
        const model = result.meshes[0];
        model.parent = pistolRoot;
        
        const tx = resolveModelTransform('m1911_fps', modelOverride);
        model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
        model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
        model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);
        
        result.meshes.forEach(m => {
            m.renderingGroupId = 1; // Render on top of world geometry
            m.isPickable = false;
            m.checkCollisions = false;
            // Store original material for restoration on reset
            if (m.material) {
                m.metadata = { ...m.metadata, originalMaterial: m.material };
            }
        });

        // Store Animation Groups if present
        if (result.animationGroups && result.animationGroups.length > 0) {
            result.animationGroups.forEach(ag => {
                ag.stop(); // Stop autoplay
                ag.loopAnimation = false;
            });
            pistolRoot.metadata = { ...pistolRoot.metadata, animationGroups: result.animationGroups };
        }
    }).catch(e => {
        if (scene.isDisposed || pistolRoot.isDisposed()) return; // expected during map transitions
        console.warn("FPS M1911 load failed", e);
    });
    if (promises) promises.push(p1);
    
    weaponMap['pistol'] = pistolRoot;

    // Rifle (STG-44)
    const rifleRoot = new BABYLON.TransformNode("fps_rifle", scene);
    rifleRoot.parent = camera;
    rifleRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    rifleRoot.setEnabled(false);

    const pRifle = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.STG44, scene).then((result) => {
        if (scene.isDisposed || rifleRoot.isDisposed()) return;
        const model = result.meshes[0];
        model.parent = rifleRoot;

        const tx = resolveModelTransform('stg44_fps', modelOverride);
        model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
        model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
        model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

        result.meshes.forEach(m => {
            m.renderingGroupId = 1;
            m.isPickable = false;
            m.checkCollisions = false;
            if (m.material) {
                m.metadata = { ...m.metadata, originalMaterial: m.material };
            }
        });

        if (result.animationGroups && result.animationGroups.length > 0) {
            result.animationGroups.forEach(ag => { ag.stop(); ag.loopAnimation = false; });
            rifleRoot.metadata = { ...rifleRoot.metadata, animationGroups: result.animationGroups };
        }
    }).catch(e => {
        if (scene.isDisposed || rifleRoot.isDisposed()) return;
        console.warn("FPS STG-44 load failed", e);
    });
    if (promises) promises.push(pRifle);

    weaponMap['rifle'] = rifleRoot;

    // Shotgun
    const shotRoot = new BABYLON.TransformNode("fps_shotgun", scene);
    shotRoot.parent = camera;
    shotRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    shotRoot.setEnabled(false);

    const pShot = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.SHOTGUN, scene).then((result) => {
        if (scene.isDisposed || shotRoot.isDisposed()) return;
        const model = result.meshes[0];
        model.parent = shotRoot;

        const tx = resolveModelTransform('shotgun_fps', modelOverride);
        model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
        model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
        model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

        result.meshes.forEach(m => {
            m.renderingGroupId = 1;
            m.isPickable = false;
            m.checkCollisions = false;
            if (m.material) {
                m.metadata = { ...m.metadata, originalMaterial: m.material };
            }
        });

        if (result.animationGroups && result.animationGroups.length > 0) {
            result.animationGroups.forEach(ag => { ag.stop(); ag.loopAnimation = false; });
            shotRoot.metadata = { ...shotRoot.metadata, animationGroups: result.animationGroups };
        }
    }).catch(e => {
        if (scene.isDisposed || shotRoot.isDisposed()) return;
        console.warn("FPS Shotgun load failed", e);
    });
    if (promises) promises.push(pShot);

    weaponMap['shotgun'] = shotRoot;

    // Famas
    const famasRoot = new BABYLON.TransformNode("fps_famas", scene);
    famasRoot.parent = camera;
    famasRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    famasRoot.setEnabled(false);

    const pFamas = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.FAMAS, scene).then((result) => {
        if (scene.isDisposed || famasRoot.isDisposed()) return;
        const model = result.meshes[0];
        model.parent = famasRoot;

        const tx = resolveModelTransform('famas_fps', modelOverride);
        model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
        model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
        model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

        result.meshes.forEach(m => {
            m.renderingGroupId = 1;
            m.isPickable = false;
            m.checkCollisions = false;
            if (m.material) {
                m.metadata = { ...m.metadata, originalMaterial: m.material };
            }
        });

        if (result.animationGroups && result.animationGroups.length > 0) {
            result.animationGroups.forEach(ag => { ag.stop(); ag.loopAnimation = false; });
            famasRoot.metadata = { ...famasRoot.metadata, animationGroups: result.animationGroups };
        }
    }).catch(e => {
        if (scene.isDisposed || famasRoot.isDisposed()) return;
        console.warn("FPS FAMAS load failed", e);
    });
    if (promises) promises.push(pFamas);

    weaponMap['famas'] = famasRoot;

    // Ray Gun
    const rayGunRoot = new BABYLON.TransformNode("fps_ray_gun", scene);
    rayGunRoot.parent = camera;
    rayGunRoot.scaling = new BABYLON.Vector3(1, 1, 1);
    rayGunRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    rayGunRoot.setEnabled(false);
    
    // Load Ray Gun Model
    const p2 = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.RAY_GUN, scene).then((result) => {
        if (scene.isDisposed || rayGunRoot.isDisposed()) return;
        const model = result.meshes[0];
        model.parent = rayGunRoot;
        
        const tx = resolveModelTransform('ray_gun_fps', modelOverride);
        model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
        model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
        model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);
        
        result.meshes.forEach(m => {
            m.renderingGroupId = 1;
            m.isPickable = false;
            m.checkCollisions = false;
            // Store original material for restoration on reset
            if (m.material) {
                m.metadata = { ...m.metadata, originalMaterial: m.material };
            }
        });
        
        if (result.animationGroups && result.animationGroups.length > 0) {
            result.animationGroups.forEach(ag => {
                ag.stop();
                ag.loopAnimation = false;
            });
            rayGunRoot.metadata = { ...rayGunRoot.metadata, animationGroups: result.animationGroups };
        }
    }).catch(e => {
        if (scene.isDisposed || rayGunRoot.isDisposed()) return;
        console.warn("FPS Ray Gun load failed", e);
    });
    if (promises) promises.push(p2);
    
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
