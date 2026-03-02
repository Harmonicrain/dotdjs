
import * as BABYLON from '@babylonjs/core';
import { TEXTURES, WEAPON_CONFIGS } from '../../config';
import { createWorldWeapon } from '../WeaponMeshFactory';

export const createTeddyBear = (scene: BABYLON.Scene, parent: BABYLON.TransformNode) => {
    const root = new BABYLON.TransformNode("teddyRoot", scene);
    root.parent = parent;

    const furMat = new BABYLON.PBRMaterial("teddyFur", scene);
    furMat.albedoColor = new BABYLON.Color3(0.4, 0.25, 0.1); 
    furMat.metallic = 0.0;
    furMat.roughness = 0.9;

    const head = BABYLON.MeshBuilder.CreateSphere("teddyHead", {diameter: 0.25}, scene);
    head.parent = root; head.position.y = 0.35; head.material = furMat;

    const earL = BABYLON.MeshBuilder.CreateSphere("teddyEarL", {diameter: 0.1}, scene);
    earL.parent = head; earL.position = new BABYLON.Vector3(-0.1, 0.1, 0); earL.material = furMat;
    const earR = BABYLON.MeshBuilder.CreateSphere("teddyEarR", {diameter: 0.1}, scene);
    earR.parent = head; earR.position = new BABYLON.Vector3(0.1, 0.1, 0); earR.material = furMat;

    const body = BABYLON.MeshBuilder.CreateSphere("teddyBody", {diameter: 0.35}, scene);
    body.parent = root; body.position.y = 0.1; body.scaling.y = 1.2; body.material = furMat;

    const armL = BABYLON.MeshBuilder.CreateSphere("teddyArmL", {diameter: 0.12}, scene);
    armL.parent = body; armL.position = new BABYLON.Vector3(-0.15, 0.1, 0); armL.scaling.y = 2; armL.material = furMat;
    const armR = BABYLON.MeshBuilder.CreateSphere("teddyArmR", {diameter: 0.12}, scene);
    armR.parent = body; armR.position = new BABYLON.Vector3(0.15, 0.1, 0); armR.scaling.y = 2; armR.material = furMat;

    return root;
};

export const createMysteryBox = (scene: BABYLON.Scene) => {
    const root = new BABYLON.TransformNode("mysteryBoxRoot", scene);
    
    // Switch to PBR for correct environment lighting usage
    const woodMat = new BABYLON.PBRMaterial("boxWood", scene);
    // Use texture for wood appearance
    const woodTex = new BABYLON.Texture(TEXTURES.PLANK_TEX, scene);
    woodTex.uScale = 1; 
    woodTex.vScale = 0.5;
    woodMat.albedoTexture = woodTex;
    woodMat.albedoColor = new BABYLON.Color3(1, 1, 1); // White to show texture color
    woodMat.reflectivityColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    woodMat.metallic = 0;
    woodMat.roughness = 0.8;

    const metalMat = new BABYLON.PBRMaterial("boxMetal", scene);
    metalMat.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.85); // Light grey metal
    metalMat.metallic = 0.9;
    metalMat.roughness = 0.4;

    const box = BABYLON.MeshBuilder.CreateBox("boxBase", {width: 2.2, height: 0.8, depth: 0.8}, scene);
    box.parent = root; box.position.y = 0.4; box.material = woodMat;

    const strap1 = BABYLON.MeshBuilder.CreateBox("boxStrap1", {width: 0.1, height: 0.82, depth: 0.82}, scene);
    strap1.parent = box; strap1.position.x = -0.9; strap1.material = metalMat;
    const strap2 = BABYLON.MeshBuilder.CreateBox("boxStrap2", {width: 0.1, height: 0.82, depth: 0.82}, scene);
    strap2.parent = box; strap2.position.x = 0.9; strap2.material = metalMat;

    // Use a Mesh for pivot to ensure robust hierarchy update
    const lidPivot = BABYLON.MeshBuilder.CreateBox("lidPivot", { size: 0.05 }, scene);
    lidPivot.parent = root;
    lidPivot.position = new BABYLON.Vector3(0, 0.8, 0.4);
    lidPivot.visibility = 0; // Invisible pivot

    const lid = BABYLON.MeshBuilder.CreateBox("boxLid", {width: 2.2, height: 0.2, depth: 0.84}, scene);
    lid.parent = lidPivot; lid.position = new BABYLON.Vector3(0, 0.1, -0.42); lid.material = woodMat;

    const q1 = BABYLON.MeshBuilder.CreatePlane("qMark1", {size: 0.5}, scene);
    q1.parent = lid; q1.position = new BABYLON.Vector3(-0.5, 0.11, 0); q1.rotation.x = Math.PI / 2; q1.rotation.z = Math.PI;
    const q2 = BABYLON.MeshBuilder.CreatePlane("qMark2", {size: 0.5}, scene);
    q2.parent = lid; q2.position = new BABYLON.Vector3(0.5, 0.11, 0); q2.rotation.x = Math.PI / 2; q2.rotation.z = Math.PI;

    // Use StandardMaterial for correct transparency on canvas textures (fixes black square issue)
    const glowMat = new BABYLON.StandardMaterial("boxGlow", scene);
    glowMat.emissiveColor = new BABYLON.Color3(1.0, 0.9, 0.4);
    glowMat.disableLighting = true;
    glowMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;

    const qTex = new BABYLON.DynamicTexture("qTex", 256, scene, true);
    qTex.hasAlpha = true;
    const ctx = qTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0,0,256,256);
    ctx.fillStyle = "#FFDD44"; ctx.font = "bold 200px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "#FF8800"; ctx.shadowBlur = 20; ctx.fillText("?", 128, 140);
    qTex.update();
    
    glowMat.diffuseTexture = qTex;
    glowMat.emissiveTexture = qTex;
    glowMat.useAlphaFromDiffuseTexture = true;
    
    q1.material = glowMat; q2.material = glowMat;

    const weaponAnchor = new BABYLON.TransformNode("boxWeaponAnchor", scene);
    weaponAnchor.parent = root; weaponAnchor.position = new BABYLON.Vector3(0, 0.8, 0);

    const light = new BABYLON.PointLight("boxLight", new BABYLON.Vector3(0, 1.5, 0), scene);
    light.parent = root; light.diffuse = new BABYLON.Color3(1.0, 0.8, 0.2); light.intensity = 0; light.range = 5;

    const beam = BABYLON.MeshBuilder.CreateCylinder("boxBeam", {height: 20, diameterTop: 0.5, diameterBottom: 0.5}, scene);
    beam.parent = root; beam.position.y = 10; 
    const beamMat = new BABYLON.PBRMaterial("boxBeamMat", scene);
    beamMat.emissiveColor = new BABYLON.Color3(1.0, 0.9, 0.5); 
    beamMat.albedoColor = new BABYLON.Color3(0, 0, 0);
    beamMat.alpha = 0; 
    beamMat.unlit = true;
    beamMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND; 
    beamMat.backFaceCulling = false;
    beam.material = beamMat; beam.visibility = 0;

    const glowPlane = BABYLON.MeshBuilder.CreatePlane("boxGlowPlane", {width: 2.0, height: 0.6}, scene);
    glowPlane.parent = root; glowPlane.rotation.x = Math.PI / 2; glowPlane.position.y = 0.85; 
    const gpMat = new BABYLON.PBRMaterial("boxGPMat", scene);
    gpMat.emissiveColor = new BABYLON.Color3(1.0, 1.0, 0.8); gpMat.unlit = true; gpMat.alpha = 0;
    gpMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    glowPlane.material = gpMat;

    const trigger = BABYLON.MeshBuilder.CreateBox("mysteryBoxTrigger", {width: 2.5, height: 2, depth: 2}, scene);
    trigger.parent = root; trigger.position.y = 1; trigger.visibility = 0; trigger.checkCollisions = false;

    WEAPON_CONFIGS.forEach((w, i) => {
        // GLB weapons use _world transforms designed for flat ground pickup (rotation.x = π/2).
        // For box display they must be upright — override rotation only.
        let displayOverride: { rotation: [number, number, number] } | undefined;
        if (w.id === 'pistol')    displayOverride = { rotation: [0, Math.PI / 2, 0] };
        else if (w.id === 'ray_gun') displayOverride = { rotation: [0, Math.PI, 0] };
        const wm = createWorldWeapon(scene, w.id, weaponAnchor, displayOverride);
        wm.setEnabled(false); wm.name = `box_weapon_${i}`; wm.scaling = new BABYLON.Vector3(2, 2, 2); wm.rotation.y = Math.PI / 2;
    });
    
    const teddy = createTeddyBear(scene, weaponAnchor);
    teddy.setEnabled(false); teddy.name = "box_teddy";

    return { root, lidPivot, weaponAnchor, light, trigger, teddy, beam, glowPlane };
};
