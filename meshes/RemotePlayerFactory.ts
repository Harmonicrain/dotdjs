
import * as BABYLON from '@babylonjs/core';
import { WEAPON_CONFIGS } from '../config';
import { createWorldWeapon } from './WeaponMeshFactory';
import { RemotePlayerVisuals } from '../types/systems';

export const createRemotePlayer = (scene: BABYLON.Scene): RemotePlayerVisuals => {
    const root = new BABYLON.TransformNode("remotePlayerRoot", scene);
    
    // Simple visual representation
    const bodyMat = new BABYLON.StandardMaterial("remoteBodyMat", scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.3, 0.4, 0.6);

    const body = BABYLON.MeshBuilder.CreateBox("remoteBody", { width: 0.6, height: 1.8, depth: 0.4 }, scene);
    body.parent = root;
    body.position.y = 0.9;
    body.material = bodyMat;

    const head = BABYLON.MeshBuilder.CreateBox("remoteHead", { size: 0.3 }, scene);
    head.parent = body;
    head.position.y = 0.95; // On top of body
    head.material = bodyMat;

    // Arms Container for pitch rotation
    const armsContainer = new BABYLON.TransformNode("remoteArmsContainer", scene);
    armsContainer.parent = root;
    armsContainer.position.y = 1.5;

    const armMat = new BABYLON.StandardMaterial("remoteArmMat", scene);
    armMat.diffuseColor = new BABYLON.Color3(0.25, 0.35, 0.55);

    const armL = BABYLON.MeshBuilder.CreateBox("remoteArmL", { width: 0.15, height: 0.6, depth: 0.15 }, scene);
    armL.parent = armsContainer;
    armL.position.x = -0.4;
    armL.position.y = -0.2;
    armL.material = armMat;

    const armR = BABYLON.MeshBuilder.CreateBox("remoteArmR", { width: 0.15, height: 0.6, depth: 0.15 }, scene);
    armR.parent = armsContainer;
    armR.position.x = 0.4;
    armR.position.y = -0.2;
    armR.material = armMat;

    // Weapons
    // We reuse createWorldWeapon but scale it appropriately for held weapon
    // Or just create simple representations.
    // The GameScene code expects `weapons` array in return object.
    
    const weapons: BABYLON.TransformNode[] = [];
    const weaponAnchor = new BABYLON.TransformNode("remoteWeaponAnchor", scene);
    weaponAnchor.parent = armsContainer;
    weaponAnchor.position = new BABYLON.Vector3(0.2, -0.2, 0.4);

    WEAPON_CONFIGS.forEach(w => {
        const weaponMesh = createWorldWeapon(scene, w.id, weaponAnchor);
        weaponMesh.setEnabled(false);
        // Adjust orientation for holding
        weaponMesh.rotation.y = Math.PI; 
        weapons.push(weaponMesh);
    });

    // Muzzle flash
    const muzzleFlash = new BABYLON.PointLight("remoteMuzzleFlash", new BABYLON.Vector3(0, 0, 1), scene);
    muzzleFlash.parent = weaponAnchor;
    muzzleFlash.intensity = 0;
    
    // Name Tag
    const namePlane = BABYLON.MeshBuilder.CreatePlane("remoteNameTag", { width: 2, height: 0.5 }, scene);
    namePlane.parent = root;
    namePlane.position.y = 2.2;
    namePlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    
    const nameTex = new BABYLON.DynamicTexture("remoteNameTex", { width: 256, height: 64 }, scene, true);
    const updateName = (name: string) => {
        const ctx = nameTex.getContext() as unknown as CanvasRenderingContext2D;
        if (!ctx) return;
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0,0,256,64);
        ctx.font = "bold 40px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name, 128, 32);
        nameTex.update();
    };
    updateName("Unknown");
    
    const nameMat = new BABYLON.StandardMaterial("remoteNameMat", scene);
    nameMat.diffuseTexture = nameTex;
    nameMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    nameMat.disableLighting = true;
    nameMat.backFaceCulling = false;
    nameMat.useAlphaFromDiffuseTexture = true;
    namePlane.material = nameMat;

    return { root, armsContainer, weapons, muzzleFlash, updateName };
};
