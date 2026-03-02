
import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from '../managers/ResourceManager';

export interface ZombieMeshResult {
    mesh: BABYLON.Mesh;
    head: BABYLON.AbstractMesh;
    torso?: BABYLON.AbstractMesh;
    limbs: {
        armL: BABYLON.AbstractMesh;
        armR: BABYLON.AbstractMesh;
        legL: BABYLON.AbstractMesh;
        legR: BABYLON.AbstractMesh;
    };
}

export const createZombieMesh = (scene: BABYLON.Scene, position: BABYLON.Vector3, resourceManager: ResourceManager): ZombieMeshResult => {
    const root = new BABYLON.Mesh("zombieRoot", scene);
    root.position = position;
    
    const bodyMat = resourceManager.getMaterial("zombieBodyMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieBodyMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.1, 0.18, 0.12);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.02); 
        mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    // Clothing Material (Darker/Tattered)
    const clothesMat = resourceManager.getMaterial("zombieClothesMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieClothesMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.05, 0.08, 0.05);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        return mat;
    });

    // Legs
    const legL = BABYLON.MeshBuilder.CreateBox("zombie_leg_l", {width: 0.18, height: 0.85, depth: 0.2}, scene);
    legL.parent = root; legL.position = new BABYLON.Vector3(-0.15, 0.425, 0); legL.material = bodyMat;
    
    // Tattered Pants Left
    const pantsL = BABYLON.MeshBuilder.CreateBox("pants_l", {width: 0.2, height: 0.5, depth: 0.22}, scene);
    pantsL.parent = legL; pantsL.position.y = 0.2; pantsL.material = clothesMat;

    const legR = BABYLON.MeshBuilder.CreateBox("zombie_leg_r", {width: 0.18, height: 0.85, depth: 0.2}, scene);
    legR.parent = root; legR.position = new BABYLON.Vector3(0.15, 0.425, 0); legR.material = bodyMat;

    // Tattered Pants Right
    const pantsR = BABYLON.MeshBuilder.CreateBox("pants_r", {width: 0.2, height: 0.5, depth: 0.22}, scene);
    pantsR.parent = legR; pantsR.position.y = 0.2; pantsR.material = clothesMat;

    // Torso
    const torso = BABYLON.MeshBuilder.CreateBox("zombie_body", {width: 0.45, height: 0.85, depth: 0.3}, scene);
    torso.parent = root; torso.position = new BABYLON.Vector3(0, 1.275, 0); torso.material = clothesMat; // Torso is shirt
    
    // Exposed Ribs/Flesh patch
    const fleshPatch = BABYLON.MeshBuilder.CreatePlane("flesh", {size: 0.2}, scene);
    fleshPatch.parent = torso; fleshPatch.position = new BABYLON.Vector3(0.1, 0.1, -0.16);
    fleshPatch.material = bodyMat;
    
    const headMat = resourceManager.getMaterial("zombieHeadMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieHeadMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.15, 0.2, 0.15);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.02);
        mat.maxSimultaneousLights = 8;
        return mat;
    });
    
    const head = BABYLON.MeshBuilder.CreateSphere("zombie_head", {diameter: 0.4}, scene);
    head.parent = root; head.position = new BABYLON.Vector3(0, 1.85, 0); head.material = headMat;
    
    // Parenting head to torso so it moves with it during crawling animation
    head.parent = torso; 
    head.position = new BABYLON.Vector3(0, 0.575, 0); 

    // Jaw (Hanging open)
    const jaw = BABYLON.MeshBuilder.CreateBox("jaw", {width: 0.25, height: 0.1, depth: 0.2}, scene);
    jaw.parent = head; jaw.position = new BABYLON.Vector3(0, -0.15, 0.05); 
    jaw.rotation.x = 0.3; // Hanging open
    jaw.material = headMat;

    const eyeMat = resourceManager.getMaterial("zombieEyeMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieEyeMat", scene);
        mat.emissiveColor = new BABYLON.Color3(1, 1, 0.5);
        mat.maxSimultaneousLights = 8;
        return mat;
    });
    
    const eyeL = BABYLON.MeshBuilder.CreateSphere("zombie_eye_l", {diameter: 0.08}, scene);
    eyeL.parent = head; eyeL.position = new BABYLON.Vector3(-0.1, 0.05, 0.15); eyeL.material = eyeMat;
    const eyeR = BABYLON.MeshBuilder.CreateSphere("zombie_eye_r", {diameter: 0.08}, scene);
    eyeR.parent = head; eyeR.position = new BABYLON.Vector3(0.1, 0.05, 0.15); eyeR.material = eyeMat;

    const armL = BABYLON.MeshBuilder.CreateBox("zombie_arm_l", {width: 0.14, height: 0.8, depth: 0.14}, scene);
    armL.parent = torso; armL.position = new BABYLON.Vector3(-0.32, -0.1, 0.2);
    armL.rotation.x = -Math.PI/2.5; armL.material = bodyMat;
    
    const armR = BABYLON.MeshBuilder.CreateBox("zombie_arm_r", {width: 0.14, height: 0.8, depth: 0.14}, scene);
    armR.parent = torso; armR.position = new BABYLON.Vector3(0.32, -0.1, 0.2);
    armR.rotation.x = -Math.PI/2.5; armR.material = bodyMat;
    
    root.checkCollisions = true;
    root.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);
    // Offset ellipsoid up so the bottom aligns with mesh origin (0,0,0)
    root.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);

    return { 
        mesh: root, 
        head,
        torso, // Return Torso
        limbs: { armL, armR, legL, legR }
    };
};

export const createHellhoundMesh = (scene: BABYLON.Scene, position: BABYLON.Vector3, resourceManager: ResourceManager): ZombieMeshResult => {
    const root = new BABYLON.Mesh("hellhoundRoot", scene);
    root.position = position;

    const furMat = resourceManager.getMaterial("houndMat", () => {
        const mat = new BABYLON.StandardMaterial("houndMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45); // Dark Grey
        mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05); 
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    const darkMat = resourceManager.getMaterial("houndDarkMat", () => {
        const mat = new BABYLON.StandardMaterial("houndDarkMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2); // Very dark patches
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    // Body (Horizontal box)
    const body = BABYLON.MeshBuilder.CreateBox("hellhound_body", {width: 0.6, height: 0.6, depth: 1.0}, scene);
    body.parent = root; 
    body.position.y = 0.6; // Legs height
    body.material = furMat;

    // Head Group
    const headPivot = new BABYLON.TransformNode("headPivot", scene);
    headPivot.parent = body;
    headPivot.position = new BABYLON.Vector3(0, 0.3, 0.5); // Front of body

    const head = BABYLON.MeshBuilder.CreateBox("hellhound_head", {size: 0.5}, scene);
    head.parent = headPivot;
    head.position.y = 0.25;
    head.material = furMat;

    // Snout
    const snout = BABYLON.MeshBuilder.CreateBox("hellhound_snout", {width: 0.25, height: 0.2, depth: 0.3}, scene);
    snout.parent = head;
    snout.position = new BABYLON.Vector3(0, -0.1, 0.35);
    snout.material = darkMat;

    // Ears
    const earL = BABYLON.MeshBuilder.CreateBox("hellhound_earL", {width: 0.15, height: 0.15, depth: 0.1}, scene);
    earL.parent = head; earL.position = new BABYLON.Vector3(-0.15, 0.3, 0); earL.material = furMat;
    
    const earR = BABYLON.MeshBuilder.CreateBox("hellhound_earR", {width: 0.15, height: 0.15, depth: 0.1}, scene);
    earR.parent = head; earR.position = new BABYLON.Vector3(0.15, 0.3, 0); earR.material = furMat;

    // Tail
    const tail = BABYLON.MeshBuilder.CreateBox("hellhound_tail", {width: 0.2, height: 0.2, depth: 0.6}, scene);
    tail.parent = body;
    tail.position = new BABYLON.Vector3(0, 0.2, -0.6);
    tail.rotation.x = -Math.PI / 6;
    tail.material = tail.material = furMat;

    // Legs
    const createLeg = (name: string, x: number, z: number) => {
        const leg = BABYLON.MeshBuilder.CreateBox("hellhound_" + name, {width: 0.2, height: 0.6, depth: 0.2}, scene);
        leg.parent = root;
        // Pivot at top of leg
        leg.setPivotPoint(new BABYLON.Vector3(0, 0.3, 0)); 
        leg.position = new BABYLON.Vector3(x, 0.3, z);
        leg.material = darkMat; 
        return leg;
    };

    // Body Y=0.6. Front Legs Z approx 0.3 (relative to root). Back Legs Z approx -0.4.
    const legFL = createLeg("legFL", -0.2, 0.3); // Front Left
    const legFR = createLeg("legFR", 0.2, 0.3); // Front Right
    const legBL = createLeg("legBL", -0.2, -0.4); // Back Left
    const legBR = createLeg("legBR", 0.2, -0.4); // Back Right

    root.checkCollisions = true;
    root.ellipsoid = new BABYLON.Vector3(0.4, 0.5, 0.6);
    root.ellipsoidOffset = new BABYLON.Vector3(0, 0.5, 0);
    
    return { 
        mesh: root, 
        head: head, 
        limbs: {
            armL: legFL, // Map Front Left to armL
            armR: legFR, // Map Front Right to armR
            legL: legBL, // Map Back Left to legL
            legR: legBR  // Map Back Right to legR
        }
    };
};
