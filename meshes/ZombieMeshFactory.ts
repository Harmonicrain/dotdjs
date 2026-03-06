
import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from '../managers/ResourceManager';

export interface ZombieMeshResult {
    mesh: BABYLON.Mesh;
    head: BABYLON.AbstractMesh;
    torso?: BABYLON.AbstractMesh;
    torsoMesh?: BABYLON.AbstractMesh; // Added to match ZombieAnimationSystem usage
    headMesh?: BABYLON.AbstractMesh;  // Added to match ZombieAnimationSystem usage
    limbs: {
        armL: BABYLON.AbstractMesh;
        armR: BABYLON.AbstractMesh;
        legL: BABYLON.AbstractMesh;
        legR: BABYLON.AbstractMesh;
    };
    animOffset?: number;
}

// ── MESH TEMPLATES ─────────────────────────────────────────────────────────
// We create "master" versions of the meshes once. Subsequent spawns use 
// instantiateHierarchy() to clone them, which shares geometry/buffers.
let masterZombie: ZombieMeshResult | null = null;
let masterHellhound: ZombieMeshResult | null = null;

const SKIN_VARIANTS = 5;
const CLOTHES_VARIANTS = 5;

/**
 * Builds the master templates used for cloning.
 * Should be called during map load/pre-warm.
 */
export const preWarmTemplates = (scene: BABYLON.Scene, resourceManager: ResourceManager) => {
    // Pre-create material variations with SLIGHT shade differences
    const skinColors = [
        new BABYLON.Color3(0.25, 0.35, 0.3),  // Pale Green (Base)
        new BABYLON.Color3(0.22, 0.38, 0.28), // Deep Jungle Green
        new BABYLON.Color3(0.28, 0.33, 0.32), // Greyish Green
        new BABYLON.Color3(0.30, 0.40, 0.25), // Sickly Olive
        new BABYLON.Color3(0.24, 0.36, 0.34), // Cold Mint Green
    ];

    const clothesColors = [
        new BABYLON.Color3(0.12, 0.18, 0.12), // Dark Army Green
        new BABYLON.Color3(0.15, 0.15, 0.15), // Charcoal
        new BABYLON.Color3(0.18, 0.22, 0.18), // Faded Olive
        new BABYLON.Color3(0.10, 0.12, 0.10), // Deep Forest
        new BABYLON.Color3(0.20, 0.22, 0.20), // Concrete Grey-Green
    ];

    for (let i = 0; i < SKIN_VARIANTS; i++) {
        resourceManager.getMaterial(`zombieBodyMat_${i}`, () => {
            const mat = new BABYLON.StandardMaterial(`zombieBodyMat_${i}`, scene);
            mat.diffuseColor = skinColors[i];
            mat.emissiveColor = skinColors[i].scale(0.25); // Stronger self-illumination
            mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            mat.maxSimultaneousLights = 12; // Handle complex warehouse lighting
            return mat;
        });
        resourceManager.getMaterial(`zombieHeadMat_${i}`, () => {
            const mat = new BABYLON.StandardMaterial(`zombieHeadMat_${i}`, scene);
            mat.diffuseColor = skinColors[i].scale(1.2); 
            mat.emissiveColor = skinColors[i].scale(0.3);
            mat.maxSimultaneousLights = 12;
            return mat;
        });
    }

    for (let i = 0; i < CLOTHES_VARIANTS; i++) {
        resourceManager.getMaterial(`zombieClothesMat_${i}`, () => {
            const mat = new BABYLON.StandardMaterial(`zombieClothesMat_${i}`, scene);
            mat.diffuseColor = clothesColors[i];
            mat.emissiveColor = clothesColors[i].scale(0.1);
            mat.specularColor = BABYLON.Color3.Black();
            mat.maxSimultaneousLights = 12;
            return mat;
        });
    }

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
    
    // Use variant 0 as the default for the template
    const bodyMat = resourceManager.getMaterial("zombieBodyMat_0", () => {
        const mat = new BABYLON.StandardMaterial("zombieBodyMat_0", scene);
        mat.diffuseColor = new BABYLON.Color3(0.25, 0.35, 0.3);
        mat.emissiveColor = new BABYLON.Color3(0.04, 0.06, 0.04);
        mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        return mat;
    });

    const clothesMat = resourceManager.getMaterial("zombieClothesMat_0", () => {
        const mat = new BABYLON.StandardMaterial("zombieClothesMat_0", scene);
        mat.diffuseColor = new BABYLON.Color3(0.15, 0.22, 0.15);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        return mat;
    });

    // --- REBUILT LEGS WITH JOINTS ---
    const hipL = BABYLON.MeshBuilder.CreateSphere("zombie_leg_l_joint", {diameter: 0.2}, scene);
    hipL.parent = root; hipL.position = new BABYLON.Vector3(-0.15, 0.85, 0); hipL.material = clothesMat;
    
    const legLMesh = BABYLON.MeshBuilder.CreateCylinder("zombie_leg_l_mesh", {diameter: 0.18, height: 0.85, tessellation: 8}, scene);
    legLMesh.parent = hipL; legLMesh.position.y = -0.425; legLMesh.material = bodyMat;
    
    const pantsL = BABYLON.MeshBuilder.CreateCylinder("pants_l", {diameter: 0.2, height: 0.5, tessellation: 8}, scene);
    pantsL.parent = legLMesh; pantsL.position.y = 0.2; pantsL.material = clothesMat;

    const actualFootL = BABYLON.MeshBuilder.CreateBox("zombie_foot_l_mesh", {width: 0.2, height: 0.1, depth: 0.3}, scene);
    actualFootL.parent = legLMesh; actualFootL.position = new BABYLON.Vector3(0, -0.38, 0.08); actualFootL.material = bodyMat;

    const hipR = BABYLON.MeshBuilder.CreateSphere("zombie_leg_r_joint", {diameter: 0.2}, scene);
    hipR.parent = root; hipR.position = new BABYLON.Vector3(0.15, 0.85, 0); hipR.material = clothesMat;

    const legRMesh = BABYLON.MeshBuilder.CreateCylinder("zombie_leg_r_mesh", {diameter: 0.18, height: 0.85, tessellation: 8}, scene);
    legRMesh.parent = hipR; legRMesh.position.y = -0.425; legRMesh.material = bodyMat;

    const pantsR = BABYLON.MeshBuilder.CreateCylinder("pants_r", {diameter: 0.2, height: 0.5, tessellation: 8}, scene);
    pantsR.parent = legRMesh; pantsR.position.y = 0.2; pantsR.material = clothesMat;

    const actualFootR = BABYLON.MeshBuilder.CreateBox("zombie_foot_r_mesh", {width: 0.2, height: 0.1, depth: 0.3}, scene);
    actualFootR.parent = legRMesh; actualFootR.position = new BABYLON.Vector3(0, -0.38, 0.08); actualFootR.material = bodyMat;

    // Pelvis / Hips to connect legs
    const pelvis = BABYLON.MeshBuilder.CreateSphere("zombie_pelvis", {diameterX: 0.42, diameterY: 0.3, diameterZ: 0.28}, scene);
    pelvis.parent = root;
    pelvis.position.y = 0.85;
    pelvis.material = clothesMat;

    const torso = BABYLON.MeshBuilder.CreateCylinder("zombie_body", {diameterTop: 0.45, diameterBottom: 0.4, height: 0.85, tessellation: 8}, scene);
    torso.parent = root; torso.position = new BABYLON.Vector3(0, 1.275, 0); torso.material = clothesMat;
    
    // Shoulders & Arm Joints
    const shoulderL = BABYLON.MeshBuilder.CreateSphere("zombie_arm_l_joint", {diameter: 0.24}, scene);
    shoulderL.parent = torso; shoulderL.position = new BABYLON.Vector3(-0.25, 0.32, 0); shoulderL.material = clothesMat;

    const shoulderR = BABYLON.MeshBuilder.CreateSphere("zombie_arm_r_joint", {diameter: 0.24}, scene);
    shoulderR.parent = torso; shoulderR.position = new BABYLON.Vector3(0.25, 0.32, 0); shoulderR.material = clothesMat;

    // Shirt detail
    const shirtDetail = BABYLON.MeshBuilder.CreateCylinder("shirt_detail", {diameter: 0.46, height: 0.4, tessellation: 8}, scene);
    shirtDetail.parent = torso; shirtDetail.position.y = 0.2; shirtDetail.material = clothesMat;

    const fleshPatch = BABYLON.MeshBuilder.CreatePlane("flesh", {size: 0.2}, scene);
    fleshPatch.parent = torso; fleshPatch.position = new BABYLON.Vector3(0.1, 0.1, -0.22);
    fleshPatch.material = bodyMat;

    // Neck
    const neck = BABYLON.MeshBuilder.CreateCylinder("zombie_neck", {diameter: 0.15, height: 0.2, tessellation: 6}, scene);
    neck.parent = torso;
    neck.position = new BABYLON.Vector3(0, 0.45, 0);
    neck.material = bodyMat;
    
    const headMat = resourceManager.getMaterial("zombieHeadMat_0", () => {
        const mat = new BABYLON.StandardMaterial("zombieHeadMat_0", scene);
        mat.diffuseColor = new BABYLON.Color3(0.3, 0.38, 0.32);
        mat.emissiveColor = new BABYLON.Color3(0.04, 0.06, 0.04);
        return mat;
    });
    
    const head = BABYLON.MeshBuilder.CreateSphere("zombie_head", {diameterX: 0.4, diameterY: 0.5, diameterZ: 0.45}, scene);
    head.parent = neck; 
    head.position = new BABYLON.Vector3(0, 0.15, 0); 
    head.material = headMat;

    // Ears
    const earL = BABYLON.MeshBuilder.CreateSphere("zombie_ear_l", {diameterX: 0.08, diameterY: 0.12, diameterZ: 0.05}, scene);
    earL.parent = head; earL.position = new BABYLON.Vector3(-0.2, 0, 0); earL.rotation.z = 0.2; earL.material = headMat;
    
    const earR = BABYLON.MeshBuilder.CreateSphere("zombie_ear_r", {diameterX: 0.08, diameterY: 0.12, diameterZ: 0.05}, scene);
    earR.parent = head; earR.position = new BABYLON.Vector3(0.2, 0, 0); earR.rotation.z = -0.2; earR.material = headMat;
    
    const jaw = BABYLON.MeshBuilder.CreateBox("jaw", {width: 0.2, height: 0.1, depth: 0.2}, scene);
    jaw.parent = head; jaw.position = new BABYLON.Vector3(0, -0.2, 0.05); 
    jaw.rotation.x = 0.4; 
    jaw.material = headMat;

    const eyeMat = resourceManager.getMaterial("zombieEyeMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieEyeMat", scene);
        mat.emissiveColor = new BABYLON.Color3(1, 1, 0.2); // Sallow yellow glow
        mat.maxSimultaneousLights = 8;
        return mat;
    });
    
    const eyeL = BABYLON.MeshBuilder.CreateSphere("zombie_eye_l", {diameter: 0.08}, scene);
    eyeL.parent = head; eyeL.position = new BABYLON.Vector3(-0.1, 0.05, 0.18); eyeL.material = eyeMat;
    const eyeR = BABYLON.MeshBuilder.CreateSphere("zombie_eye_r", {diameter: 0.08}, scene);
    eyeR.parent = head; eyeR.position = new BABYLON.Vector3(0.1, 0.05, 0.18); eyeR.material = eyeMat;

    // --- ARMS ATTACHED TO JOINTS ---
    const armL = BABYLON.MeshBuilder.CreateCylinder("zombie_arm_l_mesh", {diameter: 0.14, height: 0.8, tessellation: 6}, scene);
    armL.parent = shoulderL; armL.position = new BABYLON.Vector3(0, -0.4, 0.1); 
    armL.rotation.x = -0.2; // Natural slight forward angle
    armL.material = bodyMat;
    
    const handL = BABYLON.MeshBuilder.CreateSphere("zombie_hand_l", {diameter: 0.16}, scene);
    handL.parent = armL; handL.position.y = -0.4; handL.material = bodyMat;
    
    const armR = BABYLON.MeshBuilder.CreateCylinder("zombie_arm_r_mesh", {diameter: 0.14, height: 0.8, tessellation: 6}, scene);
    armR.parent = shoulderR; armR.position = new BABYLON.Vector3(0, -0.4, 0.1);
    armR.rotation.x = -0.2;
    armR.material = bodyMat;
    
    const handR = BABYLON.MeshBuilder.CreateSphere("zombie_hand_r", {diameter: 0.16}, scene);
    handR.parent = armR; handR.position.y = -0.4; handR.material = bodyMat;
    
    root.checkCollisions = true;
    root.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);
    root.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);

    return { 
        mesh: root, 
        head,
        torso, 
        limbs: { armL: shoulderL, armR: shoulderR, legL: hipL, legR: hipR }
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

    const body = BABYLON.MeshBuilder.CreateCylinder("hellhound_body", {diameterTop: 0.6, diameterBottom: 0.5, height: 1.0, tessellation: 8}, scene);
    body.parent = root; 
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.6; 
    body.material = furMat;

    const headPivot = new BABYLON.TransformNode("headPivot", scene);
    headPivot.parent = body;
    headPivot.position = new BABYLON.Vector3(0, 0.5, 0.3); // Adjusted for cylinder rotation
    headPivot.rotation.x = -Math.PI / 2;

    const head = BABYLON.MeshBuilder.CreateSphere("hellhound_head", {diameterX: 0.5, diameterY: 0.6, diameterZ: 0.55}, scene);
    head.parent = headPivot;
    head.position.y = 0.2;
    head.material = furMat;

    const snout = BABYLON.MeshBuilder.CreateCylinder("hellhound_snout", {diameterTop: 0.15, diameterBottom: 0.25, height: 0.3, tessellation: 6}, scene);
    snout.parent = head;
    snout.position = new BABYLON.Vector3(0, -0.05, 0.3);
    snout.rotation.x = Math.PI / 2.2;
    snout.material = darkMat;

    const earL = BABYLON.MeshBuilder.CreateCylinder("hellhound_earL", {diameterTop: 0.02, diameterBottom: 0.15, height: 0.25, tessellation: 3}, scene);
    earL.parent = head; earL.position = new BABYLON.Vector3(-0.15, 0.3, -0.05); earL.material = furMat;
    
    const earR = BABYLON.MeshBuilder.CreateCylinder("hellhound_earR", {diameterTop: 0.02, diameterBottom: 0.15, height: 0.25, tessellation: 3}, scene);
    earR.parent = head; earR.position = new BABYLON.Vector3(0.15, 0.3, -0.05); earR.material = furMat;

    const tail = BABYLON.MeshBuilder.CreateCylinder("hellhound_tail", {diameterTop: 0.05, diameterBottom: 0.15, height: 0.6, tessellation: 6}, scene);
    tail.parent = body;
    tail.position = new BABYLON.Vector3(0, -0.5, -0.2); // Adjusted for cylinder rotation
    tail.rotation.x = Math.PI / 1.2;
    tail.material = furMat;

    const createLeg = (name: string, x: number, z: number) => {
        const leg = BABYLON.MeshBuilder.CreateCylinder("hellhound_" + name, {diameter: 0.15, height: 0.6, tessellation: 6}, scene);
        leg.parent = root;
        leg.position = new BABYLON.Vector3(x, 0.3, z);
        leg.material = darkMat; 

        const paw = BABYLON.MeshBuilder.CreateBox("hellhound_paw_" + name, {width: 0.18, height: 0.08, depth: 0.22}, scene);
        paw.parent = leg;
        paw.position.y = -0.28;
        paw.position.z = 0.05;
        paw.material = darkMat;

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
    
    // Use clone() instead of instantiateHierarchy() to allow independent material assignment
    // while still sharing the underlying geometry (VertexData).
    const instance = masterZombie!.mesh.clone("zombie_" + Date.now(), null, false)!;
    instance.position.copyFrom(position);
    instance.setEnabled(true);
    
    // Wire up the ZombieMeshResult parts by finding them in the cloned hierarchy
    // Use exact names to find the joints (Spheres) instead of the meshes (Cylinders)
    const head = instance.getChildMeshes().find(m => m.name.includes("zombie_head"))!;
    const torso = instance.getChildMeshes().find(m => m.name.includes("zombie_body"))!;
    
    // For limbs, we want the JOINTS (the spheres) so they rotate correctly
    const armL = instance.getChildMeshes().find(m => m.name.includes("zombie_arm_l_joint"))!;
    const armR = instance.getChildMeshes().find(m => m.name.includes("zombie_arm_r_joint"))!;
    const legL = instance.getChildMeshes().find(m => m.name.includes("zombie_leg_l_joint"))!;
    const legR = instance.getChildMeshes().find(m => m.name.includes("zombie_leg_r_joint"))!;

    // --- APPLY RANDOM VISUAL VARIATION ---
    const skinIdx = Math.floor(Math.random() * SKIN_VARIANTS);
    const clothesIdx = Math.floor(Math.random() * CLOTHES_VARIANTS);
    
    const bodyMat = resourceManager.getMaterial(`zombieBodyMat_${skinIdx}`, () => null as any);
    const headMat = resourceManager.getMaterial(`zombieHeadMat_${skinIdx}`, () => null as any);
    const clothesMat = resourceManager.getMaterial(`zombieClothesMat_${clothesIdx}`, () => null as any);

    // Update materials on all parts (Recursive override)
    // We use a more aggressive match to ensure all parts get their materials
    instance.getDescendants(false).forEach(m => {
        if (m instanceof BABYLON.AbstractMesh) {
            const name = m.name.toLowerCase();
            // Important: Check for "eye" first so it doesn't get overwritten by "head" skin
            if (name.includes("eye")) {
                m.material = resourceManager.getMaterial("zombieEyeMat", () => null as any);
            } else if (name.includes("head") || name.includes("jaw") || name.includes("ear") || name.includes("neck")) {
                m.material = headMat;
            } else if (name.includes("body") || name.includes("pants") || name.includes("pelvis") || name.includes("shoulder") || name.includes("shirt") || name.includes("torso")) {
                m.material = clothesMat;
            } else if (name.includes("arm") || name.includes("leg") || name.includes("hand") || name.includes("foot") || name.includes("flesh")) {
                m.material = bodyMat;
            }
        }
    });

    // Randomize scale slightly (0.92x to 1.08x)
    const scale = 0.92 + Math.random() * 0.16;
    instance.scaling.set(scale, scale, scale);

    // Ensure Euler rotation is used for procedural animation
    [armL, armR, legL, legR, head, torso].forEach(m => {
        m.rotationQuaternion = null;
    });

    return {
        mesh: instance,
        head,
        headMesh: head,
        torso,
        torsoMesh: torso,
        limbs: { armL, armR, legL, legR },
        animOffset: Math.random() * Math.PI * 2 // Store it for animation use
    };
};

export const createHellhoundMesh = (scene: BABYLON.Scene, position: BABYLON.Vector3, resourceManager: ResourceManager): ZombieMeshResult => {
    if (!masterHellhound) preWarmTemplates(scene, resourceManager);

    const instance = masterHellhound!.mesh.clone("hellhound_" + Date.now(), null, false)!;
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

