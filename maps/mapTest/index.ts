/**
 * LEGACY BUILDER — This file is no longer used at runtime.
 * All maps are now built via LevelBuilder + MapDefinition (see definition.ts).
 * Kept for reference only. Costs are read from ./config.ts MAP_GAMEPLAY.
 */
import * as BABYLON from '@babylonjs/core';
import { WindowBarrier, MysteryBox, InteractableMetadata, MutableRefObject } from '../../types/index';
import { createJuggernog, createSpeedCola, createPackAPunchMachine, createQuickRevive } from '../../meshes';
import { GAME_CONFIG } from '../../config';
import { ResolvedTextureSet } from '../MapTextureResolver';

// Legacy function stubs - these don't exist anymore
const createMapTestMaterials = (scene: BABYLON.Scene, textures: ResolvedTextureSet) => ({ 
    grassMat: new BABYLON.StandardMaterial("grass", scene), 
    wallMat: new BABYLON.StandardMaterial("wall", scene), 
    plankMat: new BABYLON.StandardMaterial("plank", scene) 
});
const createOctagonFloor = (scene: BABYLON.Scene, size: number, mat: BABYLON.Material, navMeshes: BABYLON.Mesh[]) => new BABYLON.Mesh("floor", scene);
const createPerimeterWalls = (scene: BABYLON.Scene, size: number, wallMat: BABYLON.Material, plankMat: BABYLON.Material, shadowCasters: BABYLON.AbstractMesh[]) => {};
const MAP_GAMEPLAY = { perkCosts: { quick_revive: 1500, juggernog: 2500, speed_cola: 3000 }, packAPunchCost: 4500 };

export const buildMapTest = (scene: BABYLON.Scene, textures: ResolvedTextureSet, shadowCasters: BABYLON.AbstractMesh[], windowsRef: WindowBarrier[], mysteryBoxRef: MutableRefObject<MysteryBox>, navPlugin?: BABYLON.RecastJSPlugin) => {
    
    const root = new BABYLON.TransformNode("mapTestRoot", scene);
    const navMeshes: BABYLON.Mesh[] = [];
    const lights: BABYLON.PointLight[] = [];

    // --- SKYBOX ---
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 150.0 }, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    // Using playground skybox for daytime feel
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://playground.babylonjs.com/textures/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.disableLighting = true;
    skyboxMaterial.disableDepthWrite = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skybox.parent = root;

    // --- FOG ---
    scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
    scene.fogDensity = 0.0;
    scene.fogColor = new BABYLON.Color3(0.8, 0.8, 0.9);
    scene.clearColor = new BABYLON.Color4(0.8, 0.8, 0.9, 1);

    const { grassMat, wallMat, plankMat } = createMapTestMaterials(scene, textures);

    const floor = createOctagonFloor(scene, 100, grassMat, navMeshes);
    floor.parent = root;

    // Create perimeter walls and parent them
    createPerimeterWalls(scene, 100, wallMat, plankMat, shadowCasters);
    // Find the walls and parent them to root
    for(let i=0; i<8; i++) {
        const grp = scene.getTransformNodeByName("wall_group_" + i);
        if(grp) grp.parent = root;
        const wall = scene.getMeshByName("wall_" + i);
        if(wall) wall.parent = root;
    }

    const qr = createQuickRevive(scene, shadowCasters, new BABYLON.Vector3(-6, 0, 10), Math.PI);
    qr.parent = root;
    const qrTrigger = scene.getMeshByName("quickReviveTrigger");
    if(qrTrigger) qrTrigger.metadata = { type: 'PERK', id: 'quickRevive', perkType: 'quick_revive', cost: MAP_GAMEPLAY.perkCosts?.quick_revive ?? GAME_CONFIG.QUICK_REVIVE_COST } as InteractableMetadata;

    const jugg = createJuggernog(scene, shadowCasters, new BABYLON.Vector3(-2, 0, 10), Math.PI);
    jugg.parent = root;
    const juggTrigger = scene.getMeshByName("juggernogTrigger");
    if(juggTrigger) juggTrigger.metadata = { type: 'PERK', id: 'juggernog', perkType: 'juggernog', cost: MAP_GAMEPLAY.perkCosts?.juggernog ?? GAME_CONFIG.JUGGERNOG_COST } as InteractableMetadata;

    const sc = createSpeedCola(scene, shadowCasters, new BABYLON.Vector3(2, 0, 10), Math.PI);
    sc.parent = root;
    const scTrigger = scene.getMeshByName("speedColaTrigger");
    if(scTrigger) scTrigger.metadata = { type: 'PERK', id: 'speedCola', perkType: 'speed_cola', cost: MAP_GAMEPLAY.perkCosts?.speed_cola ?? GAME_CONFIG.SPEED_COLA_COST } as InteractableMetadata;

    const pap = createPackAPunchMachine(scene, new BABYLON.Vector3(6, 0, 10), Math.PI);
    pap.parent = root;
    const papTrigger = scene.getMeshByName("papTrigger");
    if(papTrigger) papTrigger.metadata = { type: 'PAP', cost: MAP_GAMEPLAY.packAPunchCost ?? GAME_CONFIG.PACK_A_PUNCH_COST } as InteractableMetadata;

    // --- LIGHTING ---
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.6; // Moderate ambient
    hemi.diffuse = new BABYLON.Color3(0.9, 0.9, 1.0);
    hemi.groundColor = new BABYLON.Color3(0.2, 0.2, 0.25);
    hemi.parent = root;

    const dirLight = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, -0.5), scene);
    dirLight.position = new BABYLON.Vector3(20, 50, 20); // Position high up for shadows
    dirLight.intensity = 2.5; // Strong sun for PBR
    dirLight.parent = root;
    
    // Shadows
    const shadowGenerator = new BABYLON.ShadowGenerator(2048, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    shadowGenerator.darkness = 0.3; // Softer shadows for daylight
    shadowCasters.forEach(mesh => shadowGenerator.addShadowCaster(mesh));
    
    if (navPlugin) {
        navPlugin.createNavMesh(navMeshes, {
            cs: 0.2, ch: 0.2, walkableSlopeAngle: 45, walkableHeight: 2.0,
            walkableClimb: 0.5, walkableRadius: 0.5, maxEdgeLen: 12,
            maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20,
            maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1
        });
    }

    return {
        root,
        doors: {}, // No doors in test map
        powerSwitchHandle: null, powerDoor: null,
        boxLocations: [], 
        boxRotations: [], 
        lights,
        spawnPoints: {
            host: new BABYLON.Vector3(0, 2.2, -5),
            client: new BABYLON.Vector3(2, 2.2, -5),
            rotation: 0
        },
        zones: [
            { id: 1, bounds: { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity } }
        ],
        doorConnections: []
    };
};
