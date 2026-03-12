import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from '../managers/ResourceManager';
import { ObjectPool } from '../engine/ObjectPool';

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

// ── MESH TEMPLATES & POOLS ─────────────────────────────────────────────────
// We create "master" versions of the meshes once. Subsequent spawns use 
// the object pools which internally clone from the master template.
let masterZombie: ZombieMeshResult | null = null;
let masterHellhound: ZombieMeshResult | null = null;

let zombiePool: ObjectPool<ZombieMeshResult> | null = null;
let hellhoundPool: ObjectPool<ZombieMeshResult> | null = null;

/**
 * Builds the master templates used for cloning.
 * Should be called during map load/pre-warm.
 */
export const preWarmTemplates = (scene: BABYLON.Scene, resourceManager: ResourceManager) => {
    if (!masterZombie) {
        masterZombie = buildZombieTemplate(scene, resourceManager);
        masterZombie.mesh.setEnabled(false); // Hide the template
        masterZombie.mesh.name = "MASTER_ZOMBIE_TEMPLATE";
        
        zombiePool = new ObjectPool<ZombieMeshResult>(
            () => {
                let head: BABYLON.AbstractMesh | undefined;
                let torso: BABYLON.AbstractMesh | undefined;
                let armL: BABYLON.AbstractMesh | undefined;
                let armR: BABYLON.AbstractMesh | undefined;
                let legL: BABYLON.AbstractMesh | undefined;
                let legR: BABYLON.AbstractMesh | undefined;
                const instance = masterZombie!.mesh.instantiateHierarchy(undefined, undefined, (source, clone) => {
                    if (source === masterZombie!.head) head = clone as BABYLON.AbstractMesh;
                    else if (source === masterZombie!.torso) torso = clone as BABYLON.AbstractMesh;
                    else if (source === masterZombie!.limbs.armL) armL = clone as BABYLON.AbstractMesh;
                    else if (source === masterZombie!.limbs.armR) armR = clone as BABYLON.AbstractMesh;
                    else if (source === masterZombie!.limbs.legL) legL = clone as BABYLON.AbstractMesh;
                    else if (source === masterZombie!.limbs.legR) legR = clone as BABYLON.AbstractMesh;
                }) as BABYLON.Mesh;
                
                instance.name = "zombie_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                instance.setEnabled(false);
                
                return {
                    mesh: instance,
                    head: head!,
                    torso,
                    limbs: { armL: armL!, armR: armR!, legL: legL!, legR: legR! }
                };
            },
            (zmr) => {
                // Reset root transform — clear stale position/rotation from previous life
                zmr.mesh.position.setAll(0);
                zmr.mesh.rotation.setAll(0);
                zmr.mesh.rotationQuaternion = null;

                // Clear metadata to avoid stale zombie references
                zmr.mesh.metadata = null;
                const children = zmr.mesh.getChildMeshes(false);
                for (let i = 0; i < children.length; i++) {
                    children[i].metadata = null;
                }

                // Reset limb rotations to idle pose
                zmr.limbs.armL.rotation.set(-Math.PI / 2.5, 0, 0);
                zmr.limbs.armR.rotation.set(-Math.PI / 2.5, 0, 0);
                zmr.limbs.legL.rotation.setAll(0);
                zmr.limbs.legR.rotation.setAll(0);

                // Reset torso bob offset
                if (zmr.torso) zmr.torso.position.y = 1.275;

                // Do NOT enable yet — caller sets position first, then enables
            },
            (zmr) => {
                zmr.mesh.dispose();
            },
            50 // Pre-warm 50 zombies
        );
    }
    
    if (!masterHellhound) {
        masterHellhound = buildHellhoundTemplate(scene, resourceManager);
        masterHellhound.mesh.setEnabled(false); // Hide the template
        masterHellhound.mesh.name = "MASTER_HELLHOUND_TEMPLATE";
        
        hellhoundPool = new ObjectPool<ZombieMeshResult>(
            () => {
                let head: BABYLON.AbstractMesh | undefined;
                let legFL: BABYLON.AbstractMesh | undefined;
                let legFR: BABYLON.AbstractMesh | undefined;
                let legBL: BABYLON.AbstractMesh | undefined;
                let legBR: BABYLON.AbstractMesh | undefined;
                const instance = masterHellhound!.mesh.instantiateHierarchy(undefined, undefined, (source, clone) => {
                    if (source === masterHellhound!.head) head = clone as BABYLON.AbstractMesh;
                    else if (source === masterHellhound!.limbs.armL) legFL = clone as BABYLON.AbstractMesh;
                    else if (source === masterHellhound!.limbs.armR) legFR = clone as BABYLON.AbstractMesh;
                    else if (source === masterHellhound!.limbs.legL) legBL = clone as BABYLON.AbstractMesh;
                    else if (source === masterHellhound!.limbs.legR) legBR = clone as BABYLON.AbstractMesh;
                }) as BABYLON.Mesh;
                
                instance.name = "hellhound_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                instance.setEnabled(false);
                
                return {
                    mesh: instance,
                    head: head!,
                    limbs: {
                        armL: legFL!,
                        armR: legFR!,
                        legL: legBL!,
                        legR: legBR!
                    }
                };
            },
            (zmr) => {
                // Reset root transform — clear stale position/rotation from previous life
                zmr.mesh.position.setAll(0);
                zmr.mesh.rotation.setAll(0);
                zmr.mesh.rotationQuaternion = null;

                // Clear metadata to avoid stale zombie references
                zmr.mesh.metadata = null;
                const children = zmr.mesh.getChildMeshes(false);
                for (let i = 0; i < children.length; i++) {
                    children[i].metadata = null;
                }

                // Reset leg rotations to neutral
                zmr.limbs.armL.rotation.setAll(0);
                zmr.limbs.armR.rotation.setAll(0);
                zmr.limbs.legL.rotation.setAll(0);
                zmr.limbs.legR.rotation.setAll(0);

                // Do NOT enable yet — caller sets position first, then enables
            },
            (zmr) => {
                zmr.mesh.dispose();
            },
            10 // Pre-warm 10 hounds
        );
    }
};

// ── PROCEDURAL TEXTURE HELPERS ─────────────────────────────────────────────

const createSkinTexture = (scene: BABYLON.Scene): BABYLON.DynamicTexture => {
    const tex = new BABYLON.DynamicTexture("zombieSkinTex", 128, scene, false);
    const ctx2d = tex.getContext();
    ctx2d.fillStyle = "#3a4a32";
    ctx2d.fillRect(0, 0, 128, 128);

    const patchColors = ["#2e3b28", "#4d5940", "#28332a", "#506048", "#1e2a1a", "#5a6350"];
    for (let i = 0; i < 90; i++) {
        ctx2d.fillStyle = patchColors[i % patchColors.length];
        ctx2d.globalAlpha = 0.3 + Math.random() * 0.5;
        ctx2d.fillRect(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 14, 4 + Math.random() * 14);
    }

    ctx2d.globalAlpha = 0.6;
    for (let i = 0; i < 12; i++) {
        ctx2d.fillStyle = i % 2 === 0 ? "#1a1210" : "#2a1815";
        ctx2d.beginPath();
        ctx2d.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 6, 0, Math.PI * 2);
        ctx2d.fill();
    }

    ctx2d.globalAlpha = 0.85;
    for (let i = 0; i < 25; i++) {
        ctx2d.fillStyle = "#6e0d0d"; // blood splatters
        ctx2d.beginPath();
        ctx2d.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 5, 0, Math.PI * 2);
        ctx2d.fill();
    }
    ctx2d.globalAlpha = 1.0;
    tex.update();
    return tex;
};

const createClothingTexture = (scene: BABYLON.Scene): BABYLON.DynamicTexture => {
    const tex = new BABYLON.DynamicTexture("zombieClothesTex", 128, scene, false);
    const ctx2d = tex.getContext();
    ctx2d.fillStyle = "#1e2220";
    ctx2d.fillRect(0, 0, 128, 128);

    const tones = ["#252a28", "#1a1f1d", "#2a302c", "#161b19", "#303835"];
    for (let i = 0; i < 70; i++) {
        ctx2d.fillStyle = tones[i % tones.length];
        ctx2d.globalAlpha = 0.3 + Math.random() * 0.4;
        ctx2d.fillRect(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 18, 2 + Math.random() * 6);
    }

    ctx2d.globalAlpha = 0.6;
    for (let i = 0; i < 15; i++) {
        ctx2d.fillStyle = "#4a0b0b";
        ctx2d.beginPath();
        ctx2d.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 12, 0, Math.PI * 2);
        ctx2d.fill();
    }
    ctx2d.globalAlpha = 1.0;
    tex.update();
    return tex;
};

const createZombieRimFresnel = (): BABYLON.FresnelParameters => {
    const fp = new BABYLON.FresnelParameters();
    fp.isEnabled = true;
    fp.leftColor = new BABYLON.Color3(0.15, 0.35, 0.1);
    fp.rightColor = new BABYLON.Color3(0, 0, 0);
    fp.power = 2.5;
    fp.bias = 0.1;
    return fp;
};

const buildZombieTemplate = (scene: BABYLON.Scene, resourceManager: ResourceManager): ZombieMeshResult => {
    const root = new BABYLON.Mesh("zombieRoot", scene);

    const skinTex = createSkinTexture(scene);
    const clothesTex = createClothingTexture(scene);
    const rimFresnel = createZombieRimFresnel();

    const bodyMat = resourceManager.getMaterial("zombieBodyMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieBodyMat", scene);
        mat.diffuseTexture = skinTex;
        mat.diffuseColor = new BABYLON.Color3(0.55, 0.6, 0.45);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.04, 0.02);
        mat.emissiveFresnelParameters = rimFresnel;
        mat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
        mat.specularPower = 32;
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    const clothesMat = resourceManager.getMaterial("zombieClothesMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieClothesMat", scene);
        mat.diffuseTexture = clothesTex;
        mat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.48);
        mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
        mat.specularPower = 64;
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    const boneMat = resourceManager.getMaterial("zombieBoneMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieBoneMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.6);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    // Legs — tapered cylinders, height 0.85 so tops sit at y=0.85 flush with torso bottom
    const legL = BABYLON.MeshBuilder.CreateCylinder("zombie_leg_l", {
        diameterTop: 0.22, diameterBottom: 0.13, height: 0.85, tessellation: 8
    }, scene);
    legL.parent = root;
    legL.setPivotPoint(new BABYLON.Vector3(0, 0.425, 0));
    legL.position = new BABYLON.Vector3(-0.11, 0.425, 0);
    legL.material = bodyMat;

    // Pants overlay on left leg
    const pantsL = BABYLON.MeshBuilder.CreateCylinder("pants_l", {
        diameterTop: 0.25, diameterBottom: 0.18, height: 0.48, tessellation: 8
    }, scene);
    pantsL.parent = legL; pantsL.position.y = 0.20; pantsL.material = clothesMat;

    // Left foot
    const footL = BABYLON.MeshBuilder.CreateBox("foot_l", { width: 0.16, height: 0.06, depth: 0.22 }, scene);
    footL.parent = legL;
    footL.position = new BABYLON.Vector3(0, -0.425, 0.04);
    footL.material = bodyMat;

    const legR = BABYLON.MeshBuilder.CreateCylinder("zombie_leg_r", {
        diameterTop: 0.22, diameterBottom: 0.13, height: 0.85, tessellation: 8
    }, scene);
    legR.parent = root;
    legR.setPivotPoint(new BABYLON.Vector3(0, 0.425, 0));
    legR.position = new BABYLON.Vector3(0.11, 0.425, 0);
    legR.material = bodyMat;

    // Pants overlay on right leg
    const pantsR = BABYLON.MeshBuilder.CreateCylinder("pants_r", {
        diameterTop: 0.25, diameterBottom: 0.18, height: 0.48, tessellation: 8
    }, scene);
    pantsR.parent = legR; pantsR.position.y = 0.20; pantsR.material = clothesMat;

    // Right foot
    const footR = BABYLON.MeshBuilder.CreateBox("foot_r", { width: 0.16, height: 0.06, depth: 0.22 }, scene);
    footR.parent = legR;
    footR.position = new BABYLON.Vector3(0, -0.425, 0.04);
    footR.material = bodyMat;

    // Torso — tapered cylinder, bottom diameter wide enough to cover leg tops
    const torso = BABYLON.MeshBuilder.CreateCylinder("zombie_body", {
        diameterTop: 0.48, diameterBottom: 0.38, height: 0.85, tessellation: 10
    }, scene);
    torso.parent = root;
    torso.position = new BABYLON.Vector3(0, 1.275, 0);
    torso.rotation.x = Math.PI / 16; // Lean forward
    torso.material = clothesMat;

    // Hip joints — sit right at the torso-leg junction (torso bottom = -0.425 local)
    const hipL = BABYLON.MeshBuilder.CreateSphere("hipL", { diameter: 0.20, segments: 6 }, scene);
    hipL.parent = torso;
    hipL.position = new BABYLON.Vector3(-0.10, -0.44, 0);
    hipL.material = clothesMat;

    const hipR = BABYLON.MeshBuilder.CreateSphere("hipR", { diameter: 0.20, segments: 6 }, scene);
    hipR.parent = torso;
    hipR.position = new BABYLON.Vector3(0.10, -0.44, 0);
    hipR.material = clothesMat;

    const fleshPatch = BABYLON.MeshBuilder.CreatePlane("flesh", { size: 0.2 }, scene);
    fleshPatch.parent = torso; fleshPatch.position = new BABYLON.Vector3(0.1, 0.1, 0.16); // Front of torso
    fleshPatch.material = bodyMat;

    for (let i = 0; i < 3; i++) {
        const rib = BABYLON.MeshBuilder.CreateBox("rib_" + i, { width: 0.12, height: 0.02, depth: 0.02 }, scene);
        rib.parent = torso;
        rib.position = new BABYLON.Vector3(0.08, 0.15 - i * 0.05, 0.16); // Front of torso
        rib.material = boneMat;
    }

    // Head
    const headMat = resourceManager.getMaterial("zombieHeadMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieHeadMat", scene);
        mat.diffuseTexture = skinTex;
        mat.diffuseColor = new BABYLON.Color3(0.6, 0.65, 0.5);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.04, 0.02);
        mat.emissiveFresnelParameters = rimFresnel;
        mat.specularColor = new BABYLON.Color3(0.1, 0.08, 0.06);
        mat.specularPower = 20;
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    const headBase = BABYLON.MeshBuilder.CreateSphere("zombie_head_base", { diameter: 0.4 }, scene);
    headBase.material = headMat;

    const brow = BABYLON.MeshBuilder.CreateBox("brow", { width: 0.32, height: 0.06, depth: 0.14 }, scene);
    brow.parent = headBase; brow.position = new BABYLON.Vector3(0, 0.1, 0.12); brow.material = headMat;

    const jaw = BABYLON.MeshBuilder.CreateBox("jaw", { width: 0.25, height: 0.1, depth: 0.2 }, scene);
    jaw.parent = headBase; jaw.position = new BABYLON.Vector3(0, -0.15, 0.05);
    jaw.rotation.x = 0.3;
    jaw.material = headMat;

    const teeth = BABYLON.MeshBuilder.CreateBox("teeth", { width: 0.18, height: 0.03, depth: 0.02 }, scene);
    teeth.parent = jaw;
    teeth.position = new BABYLON.Vector3(0, 0.04, 0.08);
    teeth.material = boneMat;

    const eyeMat = resourceManager.getMaterial("zombieEyeMat", () => {
        const mat = new BABYLON.StandardMaterial("zombieEyeMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
        mat.emissiveColor = new BABYLON.Color3(1.0, 0.2, 0.1); // eerie red
        mat.specularColor = BABYLON.Color3.Black();
        mat.maxSimultaneousLights = 8;
        return mat;
    });

    const eyeL = BABYLON.MeshBuilder.CreateSphere("zombie_eye_l", { diameter: 0.05 }, scene);
    eyeL.parent = headBase; eyeL.position = new BABYLON.Vector3(-0.1, 0.03, 0.16); eyeL.material = eyeMat;

    const eyeR = BABYLON.MeshBuilder.CreateSphere("zombie_eye_r", { diameter: 0.08 }, scene);
    eyeR.parent = headBase; eyeR.position = new BABYLON.Vector3(0.1, 0.06, 0.15); eyeR.material = eyeMat;

    // Merge Head
    headBase.computeWorldMatrix(true);
    brow.computeWorldMatrix(true);
    jaw.computeWorldMatrix(true);
    teeth.computeWorldMatrix(true);
    eyeL.computeWorldMatrix(true);
    eyeR.computeWorldMatrix(true);
    const head = BABYLON.Mesh.MergeMeshes([headBase, brow, jaw, teeth, eyeL, eyeR], true, true, undefined, false, true) as BABYLON.Mesh;
    head.name = "zombie_head";
    head.parent = torso;
    head.position = new BABYLON.Vector3(0, 0.575, 0);
    head.rotation.x = -Math.PI / 12; // Tilt up to compensate for torso lean


    // Arms — built at origin, merged, then positioned
    const armLBase = BABYLON.MeshBuilder.CreateCylinder("zombie_arm_l_base", {
        diameterTop: 0.14, diameterBottom: 0.09, height: 0.75, tessellation: 8
    }, scene);
    armLBase.material = bodyMat;

    const handL = BABYLON.MeshBuilder.CreateSphere("hand_l", { diameter: 0.12, segments: 6 }, scene);
    handL.parent = armLBase;
    handL.position = new BABYLON.Vector3(0, -0.375, 0);
    handL.material = bodyMat;

    // Merge Left Arm
    armLBase.computeWorldMatrix(true);
    handL.computeWorldMatrix(true);
    const armL = BABYLON.Mesh.MergeMeshes([armLBase, handL], true, true, undefined, false, true) as BABYLON.Mesh;
    armL.name = "zombie_arm_l";
    armL.parent = torso;
    armL.setPivotPoint(new BABYLON.Vector3(0, 0.375, 0));
    armL.position = new BABYLON.Vector3(-0.28, -0.10, 0.05);
    armL.rotation.x = -Math.PI / 2.5;


    const armRBase = BABYLON.MeshBuilder.CreateCylinder("zombie_arm_r_base", {
        diameterTop: 0.14, diameterBottom: 0.09, height: 0.75, tessellation: 8
    }, scene);
    armRBase.material = bodyMat;

    const handR = BABYLON.MeshBuilder.CreateSphere("hand_r", { diameter: 0.12, segments: 6 }, scene);
    handR.parent = armRBase;
    handR.position = new BABYLON.Vector3(0, -0.375, 0);
    handR.material = bodyMat;

    // Merge Right Arm
    armRBase.computeWorldMatrix(true);
    handR.computeWorldMatrix(true);
    const armR = BABYLON.Mesh.MergeMeshes([armRBase, handR], true, true, undefined, false, true) as BABYLON.Mesh;
    armR.name = "zombie_arm_r";
    armR.parent = torso;
    armR.setPivotPoint(new BABYLON.Vector3(0, 0.375, 0));
    armR.position = new BABYLON.Vector3(0.28, -0.10, 0.05);
    armR.rotation.x = -Math.PI / 2.5;

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
    const bodyBase = BABYLON.MeshBuilder.CreateBox("hellhound_body_base", { width: 0.6, height: 0.6, depth: 1.0 }, scene);
    bodyBase.material = furMat;

    const tail = BABYLON.MeshBuilder.CreateBox("hellhound_tail", { width: 0.2, height: 0.2, depth: 0.6 }, scene);
    tail.parent = bodyBase;
    tail.position = new BABYLON.Vector3(0, 0.2 - 0.6, -0.6); // relative to body center which is at y=0.6, so we adjust
    tail.position.y += 0.6; // We'll build body at origin, then move merged body up to y=0.6
    tail.position = new BABYLON.Vector3(0, -0.4, -0.6); // Adjusted for building at origin
    tail.rotation.x = -Math.PI / 6;
    tail.material = furMat;

    // Merge Body
    bodyBase.computeWorldMatrix(true);
    tail.computeWorldMatrix(true);
    const body = BABYLON.Mesh.MergeMeshes([bodyBase, tail], true, true, undefined, false, true) as BABYLON.Mesh;
    body.name = "hellhound_body";
    body.parent = root;
    body.position.y = 0.6;


    const headPivot = new BABYLON.TransformNode("headPivot", scene);
    headPivot.parent = body;
    headPivot.position = new BABYLON.Vector3(0, 0.3, 0.5);

    const headBase = BABYLON.MeshBuilder.CreateBox("hellhound_head_base", { size: 0.5 }, scene);
    headBase.material = furMat;

    const snout = BABYLON.MeshBuilder.CreateBox("hellhound_snout", { width: 0.25, height: 0.2, depth: 0.3 }, scene);
    snout.parent = headBase;
    snout.position = new BABYLON.Vector3(0, -0.1, 0.35);
    snout.material = darkMat;

    const earL = BABYLON.MeshBuilder.CreateBox("hellhound_earL", { width: 0.15, height: 0.15, depth: 0.1 }, scene);
    earL.parent = headBase; earL.position = new BABYLON.Vector3(-0.15, 0.3, 0); earL.material = furMat;

    const earR = BABYLON.MeshBuilder.CreateBox("hellhound_earR", { width: 0.15, height: 0.15, depth: 0.1 }, scene);
    earR.parent = headBase; earR.position = new BABYLON.Vector3(0.15, 0.3, 0); earR.material = furMat;

    // Merge Head
    headBase.computeWorldMatrix(true);
    snout.computeWorldMatrix(true);
    earL.computeWorldMatrix(true);
    earR.computeWorldMatrix(true);
    const head = BABYLON.Mesh.MergeMeshes([headBase, snout, earL, earR], true, true, undefined, false, true) as BABYLON.Mesh;
    head.name = "hellhound_head";
    head.parent = headPivot;
    head.position.y = 0.25;
    const createLeg = (name: string, x: number, z: number) => {
        const leg = BABYLON.MeshBuilder.CreateBox("hellhound_" + name, { width: 0.2, height: 0.6, depth: 0.2 }, scene);
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

    const instance = zombiePool!.acquire();
    instance.mesh.position.copyFrom(position);

    // Enable after position is set to avoid one-frame flash at old location
    instance.mesh.setEnabled(true);
    instance.head.setEnabled(true);
    if (instance.torso) instance.torso.setEnabled(true);
    instance.limbs.armL.setEnabled(true);
    instance.limbs.armR.setEnabled(true);
    instance.limbs.legL.setEnabled(true);
    instance.limbs.legR.setEnabled(true);

    return instance;
};
export const createHellhoundMesh = (scene: BABYLON.Scene, position: BABYLON.Vector3, resourceManager: ResourceManager): ZombieMeshResult => {
    if (!masterHellhound) preWarmTemplates(scene, resourceManager);

    const instance = hellhoundPool!.acquire();
    instance.mesh.position.copyFrom(position);

    // Enable after position is set to avoid one-frame flash at old location
    instance.mesh.setEnabled(true);
    instance.head.setEnabled(true);
    instance.limbs.armL.setEnabled(true);
    instance.limbs.armR.setEnabled(true);
    instance.limbs.legL.setEnabled(true);
    instance.limbs.legR.setEnabled(true);

    return instance;
};

export const releaseZombieMesh = (zmr: ZombieMeshResult) => {
    zmr.mesh.setEnabled(false);
    zmr.mesh.rotationQuaternion = null;
    if (zombiePool) zombiePool.release(zmr);
};

export const releaseHellhoundMesh = (zmr: ZombieMeshResult) => {
    zmr.mesh.setEnabled(false);
    zmr.mesh.rotationQuaternion = null;
    if (hellhoundPool) hellhoundPool.release(zmr);
};

export const disposeZombiePools = () => {
    if (zombiePool) {
        zombiePool.dispose();
        zombiePool = null;
    }
    if (hellhoundPool) {
        hellhoundPool.dispose();
        hellhoundPool = null;
    }
    
    if (masterZombie) {
        masterZombie.mesh.dispose();
        masterZombie = null;
    }
    if (masterHellhound) {
        masterHellhound.mesh.dispose();
        masterHellhound = null;
    }
}
