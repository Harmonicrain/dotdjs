
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
        const rBody = BABYLON.MeshBuilder.CreateBox("w_rifleBody", { width: 0.06, height: 0.08, depth: 0.4 }, scene);
        rBody.parent = root; rBody.material = gunMat;
        const rBarrel = BABYLON.MeshBuilder.CreateCylinder("w_rifleBarrel", { diameter: 0.025, height: 0.3 }, scene);
        rBarrel.parent = root; rBarrel.rotation.x = Math.PI / 2; rBarrel.position = new BABYLON.Vector3(0, 0.02, 0.35); rBarrel.material = gunMat;
    }
    else if (weaponId === 'shotgun') {
        const sBarrel1 = BABYLON.MeshBuilder.CreateCylinder("w_sBarrel1", { diameter: 0.035, height: 0.6 }, scene);
        sBarrel1.parent = root; sBarrel1.rotation.x = Math.PI / 2; sBarrel1.position = new BABYLON.Vector3(-0.02, 0.02, 0.3); sBarrel1.material = gunMat;
        const sBarrel2 = BABYLON.MeshBuilder.CreateCylinder("w_sBarrel2", { diameter: 0.035, height: 0.6 }, scene);
        sBarrel2.parent = root; sBarrel2.rotation.x = Math.PI / 2; sBarrel2.position = new BABYLON.Vector3(0.02, 0.02, 0.3); sBarrel2.material = gunMat;
    }
    else if (weaponId === 'famas') {
        const body = BABYLON.MeshBuilder.CreateBox("w_famasBody", { width: 0.055, height: 0.09, depth: 0.45 }, scene);
        body.parent = root; body.material = gunMat;
        
        const carryHandle = BABYLON.MeshBuilder.CreateBox("w_famasCarry", { width: 0.04, height: 0.04, depth: 0.35 }, scene);
        carryHandle.parent = root; carryHandle.position = new BABYLON.Vector3(0, 0.09, 0); carryHandle.material = gunMat;
        
        const grip = BABYLON.MeshBuilder.CreateBox("w_famasGrip", { width: 0.04, height: 0.1, depth: 0.06 }, scene);
        grip.parent = root; grip.position = new BABYLON.Vector3(0, -0.09, 0.05); grip.rotation.x = 0.2; grip.material = gunMat;
        
        const barrel = BABYLON.MeshBuilder.CreateCylinder("w_famasBarrel", { diameter: 0.025, height: 0.15 }, scene);
        barrel.parent = root; barrel.rotation.x = Math.PI / 2; barrel.position = new BABYLON.Vector3(0, 0.02, 0.28); barrel.material = gunMat;
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

    // Rifle
    const rifleRoot = new BABYLON.TransformNode("fps_rifle", scene);
    rifleRoot.parent = camera;
    rifleRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    rifleRoot.setEnabled(false);
    
    const rBody = BABYLON.MeshBuilder.CreateBox("fps_rBody", {width: 0.06, height: 0.08, depth: 0.5}, scene);
    rBody.parent = rifleRoot; rBody.material = gunMat;
    rBody.metadata = { originalMaterial: gunMat };

    const rMag = BABYLON.MeshBuilder.CreateBox("fps_rMag", {width: 0.04, height: 0.2, depth: 0.08}, scene);
    rMag.parent = rifleRoot; rMag.position = new BABYLON.Vector3(0, -0.1, 0.05); rMag.rotation.x = 0.2; rMag.material = gunMat;
    rMag.metadata = { originalMaterial: gunMat };

    const rBarrel = BABYLON.MeshBuilder.CreateCylinder("fps_rBarrel", {diameter: 0.02, height: 0.4}, scene);
    rBarrel.parent = rifleRoot; rBarrel.rotation.x = Math.PI/2; rBarrel.position = new BABYLON.Vector3(0, 0.02, 0.45); rBarrel.material = gunMat;
    rBarrel.metadata = { originalMaterial: gunMat };

    weaponMap['rifle'] = rifleRoot;

    // Shotgun
    const shotRoot = new BABYLON.TransformNode("fps_shotgun", scene);
    shotRoot.parent = camera;
    shotRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    shotRoot.setEnabled(false);

    const sBody = BABYLON.MeshBuilder.CreateBox("fps_sBody", {width: 0.07, height: 0.07, depth: 0.4}, scene);
    sBody.parent = shotRoot; sBody.material = gunMat;
    sBody.metadata = { originalMaterial: gunMat };

    const sBarrelL = BABYLON.MeshBuilder.CreateCylinder("fps_sBarrelL", {diameter: 0.025, height: 0.6}, scene);
    sBarrelL.parent = shotRoot; sBarrelL.rotation.x = Math.PI/2; sBarrelL.position = new BABYLON.Vector3(-0.018, 0.01, 0.5); sBarrelL.material = gunMat;
    sBarrelL.metadata = { originalMaterial: gunMat };

    const sBarrelR = BABYLON.MeshBuilder.CreateCylinder("fps_sBarrelR", {diameter: 0.025, height: 0.6}, scene);
    sBarrelR.parent = shotRoot; sBarrelR.rotation.x = Math.PI/2; sBarrelR.position = new BABYLON.Vector3(0.018, 0.01, 0.5); sBarrelR.material = gunMat;
    sBarrelR.metadata = { originalMaterial: gunMat };

    weaponMap['shotgun'] = shotRoot;

    // Famas
    const famasRoot = new BABYLON.TransformNode("fps_famas", scene);
    famasRoot.parent = camera;
    famasRoot.position = new BABYLON.Vector3(0.25, -0.25, 0.5);
    famasRoot.setEnabled(false);

    const fBody = BABYLON.MeshBuilder.CreateBox("fps_fBody", { width: 0.055, height: 0.09, depth: 0.45 }, scene);
    fBody.parent = famasRoot; fBody.material = gunMat;

    const fStock = BABYLON.MeshBuilder.CreateBox("fps_fStock", { width: 0.06, height: 0.13, depth: 0.15 }, scene);
    fStock.parent = famasRoot; fStock.position = new BABYLON.Vector3(0, -0.02, -0.15); fStock.material = gunMat;

    const fGrip = BABYLON.MeshBuilder.CreateBox("fps_fGrip", { width: 0.04, height: 0.12, depth: 0.06 }, scene);
    fGrip.parent = famasRoot; fGrip.position = new BABYLON.Vector3(0, -0.11, 0.05); fGrip.rotation.x = 0.2; fGrip.material = gunMat;

    const fGuard = BABYLON.MeshBuilder.CreateTorus("fps_fGuard", { diameter: 0.05, thickness: 0.005, tessellation: 16 }, scene);
    fGuard.parent = famasRoot; fGuard.position = new BABYLON.Vector3(0, -0.06, 0.02); fGuard.rotation.y = Math.PI / 2; fGuard.material = gunMat;

    const fHandle = BABYLON.MeshBuilder.CreateBox("fps_fHandle", { width: 0.04, height: 0.04, depth: 0.35 }, scene);
    fHandle.parent = famasRoot; fHandle.position = new BABYLON.Vector3(0, 0.09, 0); fHandle.material = gunMat;

    const fHandleFront = BABYLON.MeshBuilder.CreateBox("fps_fHFront", { width: 0.03, height: 0.06, depth: 0.04 }, scene);
    fHandleFront.parent = famasRoot; fHandleFront.position = new BABYLON.Vector3(0, 0.05, 0.15); fHandleFront.rotation.x = -0.3; fHandleFront.material = gunMat;
    
    const fHandleRear = BABYLON.MeshBuilder.CreateBox("fps_fHRear", { width: 0.03, height: 0.06, depth: 0.04 }, scene);
    fHandleRear.parent = famasRoot; fHandleRear.position = new BABYLON.Vector3(0, 0.05, -0.15); fHandleRear.rotation.x = 0.3; fHandleRear.material = gunMat;

    const fBarrel = BABYLON.MeshBuilder.CreateCylinder("fps_fBarrel", { diameter: 0.025, height: 0.2 }, scene);
    fBarrel.parent = famasRoot; fBarrel.rotation.x = Math.PI / 2; fBarrel.position = new BABYLON.Vector3(0, 0.02, 0.28); fBarrel.material = gunMat;

    const fMag = BABYLON.MeshBuilder.CreateBox("fps_fMag", { width: 0.045, height: 0.15, depth: 0.07 }, scene);
    fMag.parent = famasRoot; fMag.position = new BABYLON.Vector3(0, -0.1, -0.1); fMag.rotation.x = -0.1; fMag.material = gunMat;

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
