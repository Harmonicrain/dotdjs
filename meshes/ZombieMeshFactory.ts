
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

// ── MESH TEMPLATES ─────────────────────────────────────────────────────────
// We create "master" versions of the meshes once. Subsequent spawns use 
// instantiateHierarchy() to clone them, which shares geometry/buffers.
let masterZombie: ZombieMeshResult | null = null;
let masterHellhound: ZombieMeshResult | null = null;

/**
 * Builds the master templates used for cloning.
 * Should be called during map load/pre-warm.
 */
export const preWarmTemplates = (scene: BABYLON.Scene, resourceManager: ResourceManager) => {
    if (!masterZombie) {
        masterZombie = buildZombieTemplate(scene, resourceManager);
        masterZombie.mesh.setEnabled(false); // Hide the template
        masterZombie.mesh.name = "MASTER_ZOMBIE_TEMPLATE";
    }
    if (!masterHellhound) {
        masterHellhound = buildHellhoundTemplate(scene, resourceManager);
        masterHellhound.mesh.setEnabled(false); // Hide the template
        masterHellhound.mesh.name = "MASTER_HELLHOUND_TEMPLATE";
    }
};

const buildZombieTemplate = (scene: BABYLON.Scene, resourceManager: ResourceManager): ZombieMeshResult => {
    const root = new BABYLON.Mesh("zombieRoot", scene);
    
    const bodyMat = resourceManager.getMaterial("zombieBodyMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieBodyMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.1, 0.18, 0.12);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.02); 
        mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    const clothesMat = resourceManager.getMaterial("zombieClothesMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieClothesMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.05, 0.08, 0.05);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        return mat;
    });

    const legL = BABYLON.MeshBuilder.CreateBox("zombie_leg_l", {width: 0.18, height: 0.85, depth: 0.2}, scene);
    legL.parent = root; legL.position = new BABYLON.Vector3(-0.15, 0.425, 0); legL.material = bodyMat;
    
    const pantsL = BABYLON.MeshBuilder.CreateBox("pants_l", {width: 0.2, height: 0.5, depth: 0.22}, scene);
    pantsL.parent = legL; pantsL.position.y = 0.2; pantsL.material = clothesMat;

    const legR = BABYLON.MeshBuilder.CreateBox("zombie_leg_r", {width: 0.18, height: 0.85, depth: 0.2}, scene);
    legR.parent = root; legR.position = new BABYLON.Vector3(0.15, 0.425, 0); legR.material = bodyMat;

    const pantsR = BABYLON.MeshBuilder.CreateBox("pants_r", {width: 0.2, height: 0.5, depth: 0.22}, scene);
    pantsR.parent = legR; pantsR.position.y = 0.2; pantsR.material = clothesMat;

    const torso = BABYLON.MeshBuilder.CreateBox("zombie_body", {width: 0.45, height: 0.85, depth: 0.3}, scene);
    torso.parent = root; torso.position = new BABYLON.Vector3(0, 1.275, 0); torso.material = clothesMat;
    
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
    head.parent = torso; 
    head.position = new BABYLON.Vector3(0, 0.575, 0); 
    head.material = headMat;
    
    const jaw = BABYLON.MeshBuilder.CreateBox("jaw", {width: 0.25, height: 0.1, depth: 0.2}, scene);
    jaw.parent = head; jaw.position = new BABYLON.Vector3(0, -0.15, 0.05); 
    jaw.rotation.x = 0.3; 
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
    root.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);

    return { 
        mesh: root, 
        head,
        torso, 
        limbs: { armL, armR, legL, legR }
    };
};

const buildHellhoundTemplate = (scene: BABYLON.Scene, resourceManager: ResourceManager): ZombieMeshResult => {
    const root = new BABYLON.Mesh("hellhoundRoot", scene);

    const furMat = resourceManager.getMaterial("houndMat", () => {
        const mat = new BABYLON.StandardMaterial("houndMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45); 
        mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05); 
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    const darkMat = resourceManager.getMaterial("houndDarkMat", () => {
        const mat = new BABYLON.StandardMaterial("houndDarkMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2); 
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    const body = BABYLON.MeshBuilder.CreateBox("hellhound_body", {width: 0.6, height: 0.6, depth: 1.0}, scene);
    body.parent = root; 
    body.position.y = 0.6; 
    body.material = furMat;

    const headPivot = new BABYLON.TransformNode("headPivot", scene);
    headPivot.parent = body;
    headPivot.position = new BABYLON.Vector3(0, 0.3, 0.5); 

    const head = BABYLON.MeshBuilder.CreateBox("hellhound_head", {size: 0.5}, scene);
    head.parent = headPivot;
    head.position.y = 0.25;
    head.material = furMat;

    const snout = BABYLON.MeshBuilder.CreateBox("hellhound_snout", {width: 0.25, height: 0.2, depth: 0.3}, scene);
    snout.parent = head;
    snout.position = new BABYLON.Vector3(0, -0.1, 0.35);
    snout.material = darkMat;

    const earL = BABYLON.MeshBuilder.CreateBox("hellhound_earL", {width: 0.15, height: 0.15, depth: 0.1}, scene);
    earL.parent = head; earL.position = new BABYLON.Vector3(-0.15, 0.3, 0); earL.material = furMat;
    
    const earR = BABYLON.MeshBuilder.CreateBox("hellhound_earR", {width: 0.15, height: 0.15, depth: 0.1}, scene);
    earR.parent = head; earR.position = new BABYLON.Vector3(0.15, 0.3, 0); earR.material = furMat;

    const tail = BABYLON.MeshBuilder.CreateBox("hellhound_tail", {width: 0.2, height: 0.2, depth: 0.6}, scene);
    tail.parent = body;
    tail.position = new BABYLON.Vector3(0, 0.2, -0.6);
    tail.rotation.x = -Math.PI / 6;
    tail.material = furMat;

    const createLeg = (name: string, x: number, z: number) => {
        const leg = BABYLON.MeshBuilder.CreateBox("hellhound_" + name, {width: 0.2, height: 0.6, depth: 0.2}, scene);
        leg.parent = root;
        leg.setPivotPoint(new BABYLON.Vector3(0, 0.3, 0)); 
        leg.position = new BABYLON.Vector3(x, 0.3, z);
        leg.material = darkMat; 
        return leg;
    };

    const legFL = createLeg("legFL", -0.2, 0.3); 
    const legFR = createLeg("legFR", 0.2, 0.3); 
    const legBL = createLeg("legBL", -0.2, -0.4); 
    const legBR = createLeg("legBR", 0.2, -0.4); 

    root.checkCollisions = true;
    root.ellipsoid = new BABYLON.Vector3(0.4, 0.5, 0.6);
    root.ellipsoidOffset = new BABYLON.Vector3(0, 0.5, 0);
    
    return { 
        mesh: root, 
        head: head, 
        limbs: {
            armL: legFL, 
            armR: legFR, 
            legL: legBL, 
            legR: legBR  
        }
    };
};

export const createZombieMesh = (scene: BABYLON.Scene, position: BABYLON.Vector3, resourceManager: ResourceManager): ZombieMeshResult => {
    if (!masterZombie) preWarmTemplates(scene, resourceManager);
    
    const instance = masterZombie!.mesh.instantiateHierarchy() as BABYLON.Mesh;
    instance.name = "zombie_" + Date.now();
    instance.position.copyFrom(position);
    instance.setEnabled(true);
    
    // Wire up the ZombieMeshResult parts by finding them in the cloned hierarchy
    const head = instance.getChildMeshes().find(m => m.name.includes("zombie_head"))!;
    const torso = instance.getChildMeshes().find(m => m.name.includes("zombie_body"))!;
    const armL = instance.getChildMeshes().find(m => m.name.includes("zombie_arm_l"))!;
    const armR = instance.getChildMeshes().find(m => m.name.includes("zombie_arm_r"))!;
    const legL = instance.getChildMeshes().find(m => m.name.includes("zombie_leg_l"))!;
    const legR = instance.getChildMeshes().find(m => m.name.includes("zombie_leg_r"))!;

    return {
        mesh: instance,
        head,
        torso,
        limbs: { armL, armR, legL, legR }
    };
};

export const createHellhoundMesh = (scene: BABYLON.Scene, position: BABYLON.Vector3, resourceManager: ResourceManager): ZombieMeshResult => {
    if (!masterHellhound) preWarmTemplates(scene, resourceManager);

    const instance = masterHellhound!.mesh.instantiateHierarchy() as BABYLON.Mesh;
    instance.name = "hellhound_" + Date.now();
    instance.position.copyFrom(position);
    instance.setEnabled(true);

    const head = instance.getChildMeshes().find(m => m.name.includes("hellhound_head"))!;
    const legFL = instance.getChildMeshes().find(m => m.name.includes("hellhound_legFL"))!;
    const legFR = instance.getChildMeshes().find(m => m.name.includes("hellhound_legFR"))!;
    const legBL = instance.getChildMeshes().find(m => m.name.includes("hellhound_legBL"))!;
    const legBR = instance.getChildMeshes().find(m => m.name.includes("hellhound_legBR"))!;

    return { 
        mesh: instance, 
        head: head, 
        limbs: {
            armL: legFL, 
            armR: legFR, 
            legL: legBL, 
            legR: legBR  
        }
    };
};

