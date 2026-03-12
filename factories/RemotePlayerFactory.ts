
import * as BABYLON from '@babylonjs/core';
import { WEAPON_CONFIGS } from '../config';
import { createWorldWeapon } from './WeaponMeshFactory';
import { RemotePlayerVisuals } from '../types/systems';

const createPlayerMaterial = (scene: BABYLON.Scene, name: string, color: BABYLON.Color3): BABYLON.StandardMaterial => {
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = color;
    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    mat.maxSimultaneousLights = 8;
    return mat;
};

export const createRemotePlayer = (scene: BABYLON.Scene): RemotePlayerVisuals => {
    const root = new BABYLON.TransformNode("remotePlayerRoot", scene);
    
    const skinMat = createPlayerMaterial(scene, "remoteSkinMat", new BABYLON.Color3(0.85, 0.72, 0.6));
    const shirtMat = createPlayerMaterial(scene, "remoteShirtMat", new BABYLON.Color3(0.3, 0.4, 0.6));
    const pantsMat = createPlayerMaterial(scene, "remotePantsMat", new BABYLON.Color3(0.15, 0.18, 0.25));
    const hairMat = createPlayerMaterial(scene, "remoteHairMat", new BABYLON.Color3(0.2, 0.15, 0.1));

    const legL = BABYLON.MeshBuilder.CreateBox("remoteLegL", { width: 0.18, height: 0.85, depth: 0.18 }, scene);
    legL.parent = root;
    legL.position = new BABYLON.Vector3(-0.12, 0.425, 0);
    legL.material = pantsMat;

    const legR = BABYLON.MeshBuilder.CreateBox("remoteLegR", { width: 0.18, height: 0.85, depth: 0.18 }, scene);
    legR.parent = root;
    legR.position = new BABYLON.Vector3(0.12, 0.425, 0);
    legR.material = pantsMat;

    const torso = BABYLON.MeshBuilder.CreateBox("remoteTorso", { width: 0.45, height: 0.7, depth: 0.25 }, scene);
    torso.parent = root;
    torso.position = new BABYLON.Vector3(0, 1.2, 0);
    torso.material = shirtMat;

    const head = BABYLON.MeshBuilder.CreateSphere("remoteHead", { diameter: 0.35 }, scene);
    head.parent = torso;
    head.position = new BABYLON.Vector3(0, 0.52, 0);
    head.material = skinMat;

    const hair = BABYLON.MeshBuilder.CreateSphere("remoteHair", { diameter: 0.36 }, scene);
    hair.parent = head;
    hair.position.y = 0.05;
    hair.scaling = new BABYLON.Vector3(1, 0.6, 1);
    hair.material = hairMat;

    const armL = BABYLON.MeshBuilder.CreateBox("remoteArmL", { width: 0.14, height: 0.55, depth: 0.14 }, scene);
    armL.parent = torso;
    armL.position = new BABYLON.Vector3(-0.32, 0.1, 0);
    armL.material = shirtMat;

    const armR = BABYLON.MeshBuilder.CreateBox("remoteArmR", { width: 0.14, height: 0.55, depth: 0.14 }, scene);
    armR.parent = torso;
    armR.position = new BABYLON.Vector3(0.32, 0.1, 0);
    armR.material = shirtMat;

    const handL = BABYLON.MeshBuilder.CreateSphere("remoteHandL", { diameter: 0.12 }, scene);
    handL.parent = armL;
    handL.position.y = -0.32;
    handL.material = skinMat;

    const handR = BABYLON.MeshBuilder.CreateSphere("remoteHandR", { diameter: 0.12 }, scene);
    handR.parent = armR;
    handR.position.y = -0.32;
    handR.material = skinMat;

    const armsContainer = new BABYLON.TransformNode("remoteArmsContainer", scene);
    armsContainer.parent = root;
    armsContainer.position = new BABYLON.Vector3(0, 1.4, 0.15);

    const weaponAnchor = new BABYLON.TransformNode("remoteWeaponAnchor", scene);
    weaponAnchor.parent = armsContainer;
    weaponAnchor.position = new BABYLON.Vector3(0.3, -0.25, 0.25);

    const weapons: BABYLON.TransformNode[] = [];
    WEAPON_CONFIGS.forEach(w => {
        let displayOverride: { rotation: [number, number, number] } | undefined;
        if (w.id === 'pistol') displayOverride = { rotation: [0, Math.PI / 2, 0] };
        else if (w.id === 'ray_gun') displayOverride = { rotation: [0, Math.PI, 0] };
        
        const weaponMesh = createWorldWeapon(scene, w.id, weaponAnchor, displayOverride);
        weaponMesh.setEnabled(false);
        weaponMesh.scaling = new BABYLON.Vector3(2, 2, 2);
        weapons.push(weaponMesh);
    });

    const muzzleFlash = new BABYLON.PointLight("remoteMuzzleFlash", new BABYLON.Vector3(0, 0, 0.5), scene);
    muzzleFlash.parent = weaponAnchor;
    muzzleFlash.intensity = 0;
    
    const namePlane = BABYLON.MeshBuilder.CreatePlane("remoteNameTag", { width: 2, height: 0.5 }, scene);
    namePlane.parent = root;
    namePlane.position.y = 2.3;
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
