
import * as BABYLON from '@babylonjs/core';
import { MapDefinition, WindowBarrier, GroundSpawn, MysteryBox, InteractableMetadata, DoorMeshEntry, SpawnPoints, MapGameplay, MutableRefObject, DoorConnection } from '../types/index';
import { ResolvedTextureSet } from '../maps/MapTextureResolver';
import { createMaterial, createTiledBox, createWallBuy, createWindow, createFixture } from './GeometryUtils';
import { createJuggernog, createSpeedCola, createQuickRevive, createPackAPunchMachine, createPowerSwitch, createMysteryBox } from '../meshes';
import { createBuilding } from '../meshes/BuildingFactory';
import { GAME_CONFIG, MYSTERY_BOX_CONFIG } from '../config';

/**
 * Helper to create PBR material with texture and mark dirty on load.
 */
function createPBRMaterialWithTexture(
    scene: BABYLON.Scene,
    name: string,
    textureUrl: string,
    albedoColor: BABYLON.Color3,
    metallic: number,
    roughness: number,
    envIntensity: number
): BABYLON.PBRMaterial {
    const mat = new BABYLON.PBRMaterial(name, scene);
    const tex = new BABYLON.Texture(textureUrl, scene);
    mat.albedoTexture = tex;
    mat.albedoColor = albedoColor;
    mat.metallic = metallic;
    mat.roughness = roughness;
    mat.environmentIntensity = envIntensity;

    if (tex.isReady()) {
        mat.markDirty();
    } else {
        tex.onLoadObservable.addOnce(() => mat.markDirty());
    }
    return mat;
}

export class LevelBuilder {
    private scene: BABYLON.Scene;
    private root: BABYLON.TransformNode;
    private navMeshes: BABYLON.Mesh[] = [];
    private shadowCasters: BABYLON.AbstractMesh[];
    private lights: BABYLON.PointLight[] = [];
    private materials: Map<string, BABYLON.Material> = new Map();
    private mapGameplay: MapGameplay = {};

    // Result Containers
    public loadPromises: Promise<any>[] = [];
    private windowsRef: WindowBarrier[];
    private groundSpawnsRef: GroundSpawn[];
    private mysteryBoxRef: MutableRefObject<MysteryBox>;
    private doorMeshes: Record<string, DoorMeshEntry> = {};
    private powerSwitchHandle: BABYLON.TransformNode | null = null;
    private powerSwitchActivate: (() => void) | null = null;
    private powerDoor: BABYLON.Mesh | null = null;
    private powerDoorOpenY: number = 8;

    constructor(
        scene: BABYLON.Scene,
        shadowCasters: BABYLON.AbstractMesh[],
        windowsRef: WindowBarrier[],
        groundSpawnsRef: GroundSpawn[],
        mysteryBoxRef: MutableRefObject<MysteryBox>,
        private onBuildingLoaded?: (meshes: BABYLON.Mesh[]) => void
    ) {
        this.scene = scene;
        this.shadowCasters = shadowCasters;
        this.windowsRef = windowsRef;
        this.groundSpawnsRef = groundSpawnsRef;
        this.mysteryBoxRef = mysteryBoxRef;
        this.root = new BABYLON.TransformNode("levelRoot", scene);
    }

    public build(definition: MapDefinition, textures: ResolvedTextureSet) {
        this.mapGameplay = definition.config?.gameplay as MapGameplay || {};
        this.initializeEnvironment(definition);
        this.initializeMaterials(textures);
        this.buildGeometry(definition);
        this.buildGrounds(definition);
        this.buildNavFloors(definition);
        this.buildInteractables(definition);
        this.buildFixtures(definition);

        return {
            root: this.root,
            navMeshes: this.navMeshes,
            lights: this.lights,
            doors: this.doorMeshes,
            powerSwitchHandle: this.powerSwitchHandle,
            powerSwitchActivate: this.powerSwitchActivate,
            powerDoor: this.powerDoor,
            powerDoorOpenY: this.powerDoorOpenY,
            mapGameplay: this.mapGameplay,
            boxLocations: definition.interactables.mysteryBoxes?.map(b => new BABYLON.Vector3(b.pos[0], b.pos[1], b.pos[2])) || [],
            boxRotations: definition.interactables.mysteryBoxes?.map(b => b.rotation || 0) || [],
            zones: definition.zones,
            spawnPoints: {
                host: new BABYLON.Vector3(definition.spawns.host.pos[0], definition.spawns.host.pos[1], definition.spawns.host.pos[2]),
                client: new BABYLON.Vector3(definition.spawns.client.pos[0], definition.spawns.client.pos[1], definition.spawns.client.pos[2]),
                rotation: definition.spawns.host.rot,
                clientRotation: definition.spawns.client.rot
            } as SpawnPoints,
            doorConnections: this.extractDoorConnections(definition),
            loadPromises: this.loadPromises
        };
    }

    private initializeEnvironment(def: MapDefinition) {
        if (!def.environment) return;

        const env = def.environment;

        if (env.skybox) {
            const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, this.scene);
            const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
            skyboxMaterial.backFaceCulling = false;
            skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://playground.babylonjs.com/textures/skybox", this.scene);
            skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
            skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
            skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
            skybox.material = skyboxMaterial;
            skybox.infiniteDistance = true;
            skybox.parent = this.root;
        }

        if (env.fog) {
            this.scene.fogMode = env.fog.mode === 'exp2' ? BABYLON.Scene.FOGMODE_EXP2 : BABYLON.Scene.FOGMODE_NONE;
            this.scene.fogDensity = env.fog.density;
            const c = env.fog.color;
            this.scene.fogColor = new BABYLON.Color3(c[0], c[1], c[2]);
            this.scene.clearColor = new BABYLON.Color4(c[0], c[1], c[2], 1);
        }

        if (env.ambientLight) {
            const h = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), this.scene);
            h.intensity = env.ambientLight.intensity;
            const d = env.ambientLight.diffuse;
            h.diffuse = new BABYLON.Color3(d[0], d[1], d[2]);
            const g = env.ambientLight.ground;
            h.groundColor = new BABYLON.Color3(g[0], g[1], g[2]);
            h.parent = this.root;
        }

        if (env.directionalLight) {
            const d = env.directionalLight.direction;
            const dl = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(d[0], d[1], d[2]), this.scene);
            dl.intensity = env.directionalLight.intensity;
            dl.position = new BABYLON.Vector3(0, 20, 0);
            dl.parent = this.root;

            const shadow = env.shadow;
            const shadowGenerator = new BABYLON.ShadowGenerator(shadow?.resolution ?? 1024, dl);
            shadowGenerator.useBlurExponentialShadowMap = true;
            shadowGenerator.blurKernel = shadow?.blurKernel ?? 32;
            shadowGenerator.darkness = shadow?.darkness ?? 0.5;
            this.scene.onNewMeshAddedObservable.add((mesh) => {
                if (this.shadowCasters.includes(mesh)) {
                    shadowGenerator.addShadowCaster(mesh);
                }
            });
        }
    }

    private initializeMaterials(textures: ResolvedTextureSet) {
        // Standard materials
        this.materials.set('floor', new BABYLON.StandardMaterial("floorMat", this.scene));
        const floorMat = this.materials.get('floor') as BABYLON.StandardMaterial;
        const floorTex = new BABYLON.Texture(textures.floor, this.scene);
        floorMat.diffuseTexture = floorTex;
        floorTex.uScale = 8;
        floorTex.vScale = 16;

        this.materials.set('wall', new BABYLON.StandardMaterial("wallMat", this.scene));
        const wallMat = this.materials.get('wall') as BABYLON.StandardMaterial;
        wallMat.diffuseTexture = new BABYLON.Texture(textures.wall, this.scene);

        this.materials.set('ceiling', new BABYLON.StandardMaterial("ceilingMat", this.scene));
        const ceilingMat = this.materials.get('ceiling') as BABYLON.StandardMaterial;
        ceilingMat.diffuseTexture = new BABYLON.Texture(textures.ceiling, this.scene);

        this.materials.set('plank', new BABYLON.StandardMaterial("plankMat", this.scene));
        const plankMat = this.materials.get('plank') as BABYLON.StandardMaterial;
        plankMat.diffuseTexture = new BABYLON.Texture(textures.plank, this.scene);

        // Aliases
        this.materials.set('brick', this.materials.get('wall')!);
        this.materials.set('wood', this.materials.get('floor')!);
        this.materials.set('wood_small', createMaterial(this.scene, "woodSmallMat", textures.floor, new BABYLON.Color3(0.5, 0.5, 0.5), 1.0666, 1.2, 0.8));
        this.materials.set('wood_large', createMaterial(this.scene, "woodLargeMat", textures.floor, new BABYLON.Color3(1, 1, 1), 0.5, 0.15, 0.8));

        // PBR materials using helper
        const pbrColor = new BABYLON.Color3(0.6, 0.6, 0.6);
        this.materials.set('door', createPBRMaterialWithTexture(this.scene, "doorMat", textures.door, pbrColor, 0, 0.6, 0.6));
        this.materials.set('powerDoor', createPBRMaterialWithTexture(this.scene, "powerDoorMat", textures.powerDoor, pbrColor, 0, 0.6, 0.6));

        // Metal material
        const metalMat = new BABYLON.PBRMaterial("metalMat", this.scene);
        metalMat.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.25);
        metalMat.metallic = 0.8;
        metalMat.roughness = 0.4;
        metalMat.environmentIntensity = 0.6;
        metalMat.markDirty();
        this.materials.set('metal', metalMat);

        // Void material
        const voidMat = new BABYLON.PBRMaterial("voidMat", this.scene);
        voidMat.albedoColor = new BABYLON.Color3(0, 0, 0);
        voidMat.unlit = true;
        this.materials.set('void', voidMat);

        // Frame material
        const frameMat = new BABYLON.PBRMaterial("frameMat", this.scene);
        frameMat.albedoColor = new BABYLON.Color3(0.6, 0.6, 0.6);
        frameMat.metallic = 0.8;
        frameMat.roughness = 0.4;
        frameMat.environmentIntensity = 0.6;
        frameMat.markDirty();
        this.materials.set('frame', frameMat);
    }

    private buildGeometry(def: MapDefinition) {
        const groups: Record<string, { meshes: BABYLON.Mesh[], mat: BABYLON.Material, isWalkable: boolean }> = {};

        def.geometry.forEach((geo, idx) => {
            const matName = geo.material || geo.texture || (geo.type === 'wall' ? 'wall' : 'floor');
            const mat = this.materials.get(matName) || this.materials.get('wall')!;

            if (geo.type === 'box' || geo.type === 'wall' || geo.type === 'floor' || geo.type === 'ceiling') {
                const isWalkableSurface = geo.type === 'floor' || geo.type === 'box';
                const key = `${matName}_${isWalkableSurface}`;

                if (!groups[key]) {
                    groups[key] = { meshes: [], mat, isWalkable: isWalkableSurface };
                }

                const box = createTiledBox(
                    this.scene,
                    `geo_${idx}`,
                    { w: geo.size[0], h: geo.size[1], d: geo.size[2] },
                    new BABYLON.Vector3(geo.pos[0], geo.pos[1], geo.pos[2]),
                    mat,
                    geo.uvScale || 1.0,
                    false, // Handle shadows post-merge
                    [],    // Temp array
                    []     // Temp array
                );

                if (geo.rotation) {
                    box.rotation = new BABYLON.Vector3(geo.rotation[0], geo.rotation[1], geo.rotation[2]);
                }

                box.computeWorldMatrix(true);
                groups[key].meshes.push(box as BABYLON.Mesh);
            }
        });

        Object.keys(groups).forEach(key => {
            const group = groups[key];
            if (group.meshes.length > 0) {
                if (group.meshes.length === 1) {
                    const mesh = group.meshes[0];
                    mesh.parent = this.root;
                    mesh.receiveShadows = true;
                    this.shadowCasters.push(mesh);
                    if (group.isWalkable) this.navMeshes.push(mesh);
                } else {
                    const merged = BABYLON.Mesh.MergeMeshes(group.meshes, true, true);
                    if (merged) {
                        merged.name = `merged_geo_${key}`;
                        merged.parent = this.root;
                        merged.material = group.mat;
                        merged.checkCollisions = true;
                        merged.receiveShadows = true;
                        this.shadowCasters.push(merged);
                        if (group.isWalkable) this.navMeshes.push(merged);
                    }
                }
            }
        });
    }

    private buildGrounds(def: MapDefinition) {
        if (!def.grounds) return;
        const hasNavFloors = def.navFloors && def.navFloors.length > 0;

        const groups: Record<string, { meshes: BABYLON.Mesh[], mat: BABYLON.Material }> = {};

        def.grounds.forEach((g, idx) => {
            const matName = g.texture || 'floor';
            const baseMat = this.materials.get(matName) || this.materials.get('floor')!;

            const ground = BABYLON.MeshBuilder.CreateGround(`ground_${idx}`, { width: g.width, height: g.height }, this.scene);
            ground.position = new BABYLON.Vector3(g.pos[0], g.pos[1], g.pos[2]);

            if (g.uvScale) {
                let texU = 1;
                let texV = 1;

                if (baseMat instanceof BABYLON.StandardMaterial && baseMat.diffuseTexture && (baseMat.diffuseTexture as BABYLON.Texture).uScale !== undefined) {
                    texU = (baseMat.diffuseTexture as BABYLON.Texture).uScale;
                    texV = (baseMat.diffuseTexture as BABYLON.Texture).vScale;
                } else if (baseMat instanceof BABYLON.PBRMaterial && baseMat.albedoTexture && (baseMat.albedoTexture as BABYLON.Texture).uScale !== undefined) {
                    texU = (baseMat.albedoTexture as BABYLON.Texture).uScale;
                    texV = (baseMat.albedoTexture as BABYLON.Texture).vScale;
                }

                const uvData = ground.getVerticesData(BABYLON.VertexBuffer.UVKind);
                if (uvData) {
                    for (let i = 0; i < uvData.length; i += 2) {
                        uvData[i] *= (g.uvScale[0] / texU);
                        uvData[i + 1] *= (g.uvScale[1] / texV);
                    }
                    ground.setVerticesData(BABYLON.VertexBuffer.UVKind, uvData);
                }
            }

            ground.computeWorldMatrix(true);

            if (!groups[matName]) {
                groups[matName] = { meshes: [], mat: baseMat };
            }
            groups[matName].meshes.push(ground);
        });

        Object.keys(groups).forEach(key => {
            const group = groups[key];
            if (group.meshes.length > 0) {
                if (group.meshes.length === 1) {
                    const mesh = group.meshes[0];
                    mesh.material = group.mat;
                    mesh.checkCollisions = true;
                    mesh.receiveShadows = true;
                    mesh.parent = this.root;
                    if (!hasNavFloors) this.navMeshes.push(mesh);
                } else {
                    const merged = BABYLON.Mesh.MergeMeshes(group.meshes, true, true);
                    if (merged) {
                        merged.name = `merged_ground_${key}`;
                        merged.material = group.mat;
                        merged.checkCollisions = true;
                        merged.receiveShadows = true;
                        merged.parent = this.root;
                        if (!hasNavFloors) this.navMeshes.push(merged);
                    }
                }
            }
        });
    }

    private buildNavFloors(def: MapDefinition) {
        if (!def.navFloors) return;

        const DEBUG_SHOW_NAVFLOORS = false;
        const colors = [
            new BABYLON.Color3(1, 0, 0),
            new BABYLON.Color3(1, 1, 0),
            new BABYLON.Color3(0, 1, 0),
            new BABYLON.Color3(0, 1, 1),
            new BABYLON.Color3(0, 0, 1),
            new BABYLON.Color3(1, 0, 1),
        ];

        const navFloorMeshes: BABYLON.Mesh[] = [];

        def.navFloors.forEach((g, idx) => {
            const ground = BABYLON.MeshBuilder.CreateGround(`navfloor_${idx}`, { width: g.width, height: g.height }, this.scene);
            ground.position = new BABYLON.Vector3(g.pos[0], g.pos[1] + 0.05, g.pos[2]);

            if (DEBUG_SHOW_NAVFLOORS) {
                const mat = new BABYLON.StandardMaterial(`navfloor_mat_${idx}`, this.scene);
                mat.diffuseColor = colors[idx % colors.length];
                mat.alpha = 0.3;
                mat.backFaceCulling = false;
                ground.material = mat;
                ground.visibility = 1;
            } else {
                ground.visibility = 0;
            }

            ground.computeWorldMatrix(true);
            navFloorMeshes.push(ground);
        });

        if (navFloorMeshes.length > 0) {
            if (navFloorMeshes.length === 1) {
                const mesh = navFloorMeshes[0];
                mesh.isPickable = false;
                mesh.checkCollisions = false;
                mesh.parent = this.root;
                this.navMeshes.push(mesh);
            } else {
                if (!DEBUG_SHOW_NAVFLOORS) {
                    const merged = BABYLON.Mesh.MergeMeshes(navFloorMeshes, true, true);
                    if (merged) {
                        merged.name = "merged_navfloors";
                        merged.visibility = 0;
                        merged.isPickable = false;
                        merged.checkCollisions = false;
                        merged.parent = this.root;
                        this.navMeshes.push(merged);
                    }
                } else {
                    navFloorMeshes.forEach(mesh => {
                        mesh.isPickable = false;
                        mesh.checkCollisions = false;
                        mesh.parent = this.root;
                        this.navMeshes.push(mesh);
                    });
                }
            }
        }
    }

    private buildInteractables(def: MapDefinition) {
        const i = def.interactables;
        this.buildDoors(i.doors);
        this.buildWindows(i.windows);
        this.buildGroundSpawns(i.groundSpawns);
        this.buildPerks(i.perks, def);
        this.buildWallbuys(i.wallbuys);
        this.buildBuildings(i.buildings);
        this.buildPowerSwitch(i.powerSwitch, def);
        this.buildPackAPunch(i.packAPunch, def);
        this.buildMysteryBoxes(i.mysteryBoxes);
    }

    private buildDoors(doors: MapDefinition['interactables']['doors']) {
        if (!doors) return;
        const doorMat = this.materials.get('door')!;

        doors.forEach(d => {
            const mesh = BABYLON.MeshBuilder.CreateBox(`door_${d.id}`, { width: d.size[0], height: d.size[1], depth: d.size[2] }, this.scene);
            mesh.position = new BABYLON.Vector3(d.pos[0], d.pos[1], d.pos[2]);
            if (d.rotation) mesh.rotation.y = d.rotation;
            mesh.visibility = 0;
            mesh.checkCollisions = true;
            mesh.metadata = { type: 'DOOR', id: d.id, cost: d.cost } as InteractableMetadata;
            mesh.parent = this.root;

            const vis = BABYLON.MeshBuilder.CreateBox(`door_vis_${d.id}`, { width: d.size[0], height: d.size[1], depth: d.size[2] }, this.scene);
            vis.parent = mesh;
            vis.position = BABYLON.Vector3.Zero();
            vis.material = doorMat;
            vis.checkCollisions = false;
            vis.receiveShadows = true;
            this.shadowCasters.push(vis);

            this.doorMeshes[d.id] = {
                mesh,
                observer: null,
                closedY: d.closedY ?? d.pos[1],
                openY: d.openY ?? (d.pos[1] + 4),
                size: d.size,
                rotation: d.rotation
            };
        });
    }

    private buildWindows(windows: MapDefinition['interactables']['windows']) {
        if (!windows) return;
        const plankMat = this.materials.get('plank') as BABYLON.PBRMaterial;
        const metalMat = this.materials.get('metal') as BABYLON.PBRMaterial;
        const voidMat = this.materials.get('void') as BABYLON.PBRMaterial;

        windows.forEach(w => {
            const isRotated = w.rotation !== undefined && Math.abs(w.rotation) > 0.1;
            createWindow(
                this.scene,
                w.id,
                w.pos[2],
                w.zone,
                this.windowsRef,
                plankMat,
                metalMat,
                voidMat,
                w.pos[0],
                isRotated
            );
        });

        this.windowsRef.forEach(w => {
            if (!w.triggerMesh.parent) w.triggerMesh.parent = this.root;
            const voidBox = this.scene.getMeshByName(w.id + "_void");
            if (voidBox) voidBox.parent = this.root;
            const blocker = this.scene.getMeshByName(w.id + "_blocker");
            if (blocker) blocker.parent = this.root;
            w.boards.forEach(b => { if (!b.parent) b.parent = this.root; });
        });
    }

    private buildGroundSpawns(groundSpawns: MapDefinition['interactables']['groundSpawns']) {
        if (!groundSpawns || groundSpawns.length === 0) return;

        // Dark ground material for the hole disc
        const holeMat = new BABYLON.StandardMaterial("groundHoleMat", this.scene);
        holeMat.diffuseColor = new BABYLON.Color3(0.05, 0.03, 0.02);
        holeMat.specularColor = BABYLON.Color3.Black();
        holeMat.emissiveColor = new BABYLON.Color3(0.01, 0.005, 0.0);

        // Dirt material for the mound around the hole
        const dirtMat = new BABYLON.StandardMaterial("groundDirtMat", this.scene);
        dirtMat.diffuseColor = new BABYLON.Color3(0.15, 0.1, 0.05); // Dark brown
        dirtMat.specularColor = BABYLON.Color3.Black();

        groundSpawns.forEach(gs => {
            // Create a dark disc on the ground to mark the spawn hole
            const disc = BABYLON.MeshBuilder.CreateDisc(
                `groundSpawn_${gs.id}`,
                { radius: 0.9, tessellation: 16 },
                this.scene
            );
            disc.material = holeMat;
            disc.rotation.x = Math.PI / 2; // Lay flat on ground
            disc.position = new BABYLON.Vector3(gs.pos[0], gs.pos[1] + 0.02, gs.pos[2]); // Slightly above ground to prevent z-fighting
            disc.isPickable = false;
            disc.parent = this.root;

            // Create a Torus for the dirt mound around the hole
            const mound = BABYLON.MeshBuilder.CreateTorus(
                `groundSpawnMound_${gs.id}`,
                { diameter: 1.95, thickness: 0.45, tessellation: 16 },
                this.scene
            );
            mound.material = dirtMat;
            mound.position = new BABYLON.Vector3(gs.pos[0], gs.pos[1] - 0.1, gs.pos[2]); // Half-buried
            mound.scaling.y = 0.5; // Squashed
            mound.isPickable = false;
            mound.parent = this.root;

            // Store the runtime GroundSpawn object
            this.groundSpawnsRef.push({
                id: gs.id,
                position: new BABYLON.Vector3(gs.pos[0], gs.pos[1], gs.pos[2]),
                zone: gs.zone,
            });
        });
    }

    private buildPerks(perks: MapDefinition['interactables']['perks'], def: MapDefinition) {
        if (!perks) return;

        const defaultPerkCosts: Record<string, number> = {
            juggernog: GAME_CONFIG.JUGGERNOG_COST,
            speed_cola: GAME_CONFIG.SPEED_COLA_COST,
            quick_revive: GAME_CONFIG.QUICK_REVIVE_COST,
        };

        perks.forEach(p => {
            const pos = new BABYLON.Vector3(p.pos[0], p.pos[1], p.pos[2]);
            let machine: BABYLON.TransformNode;

            if (p.type === 'juggernog') {
                machine = createJuggernog(this.scene, this.shadowCasters, pos, p.rotation || 0, def.modelOverrides?.['juggernog'], this.loadPromises);
            } else if (p.type === 'speed_cola') {
                machine = createSpeedCola(this.scene, this.shadowCasters, pos, p.rotation || 0, def.modelOverrides?.['speed_cola'], this.loadPromises);
            } else {
                machine = createQuickRevive(this.scene, this.shadowCasters, pos, p.rotation || 0, def.modelOverrides?.['quick_revive'], this.loadPromises);
            }

            machine.parent = this.root;
            const perkCost = this.mapGameplay.perkCosts?.[p.type] ?? defaultPerkCosts[p.type] ?? 2000;

            const triggers = machine.getChildMeshes().filter(m => m.name.includes("Trigger"));
            triggers.forEach(t => {
                t.metadata = { type: 'PERK', id: p.id, perkType: p.type, cost: perkCost } as InteractableMetadata;
            });
        });
    }

    private buildWallbuys(wallbuys: MapDefinition['interactables']['wallbuys']) {
        if (!wallbuys) return;

        wallbuys.forEach(wb => {
            const pos = new BABYLON.Vector3(wb.pos[0], wb.pos[1], wb.pos[2]);
            const drawer = this.getWallbuyDrawer(wb.weapon);

            const root = createWallBuy(this.scene, wb.id, pos, wb.rotation || 0, drawer);
            root.parent = this.root;
            const trigger = this.scene.getMeshByName(wb.id + "_trigger");
            if (trigger) {
                trigger.metadata = { type: 'WALLBUY', id: wb.id, weapon: wb.weapon, cost: wb.cost } as InteractableMetadata;
            }
        });
    }

    private getWallbuyDrawer(weapon: string): (ctx: CanvasRenderingContext2D) => void {
        if (weapon === 'shotgun') {
            return (ctx) => {
                ctx.strokeStyle = "rgba(180, 230, 255, 1)";
                ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.lineJoin = "round";
                ctx.shadowColor = "rgba(0, 200, 255, 1)"; ctx.shadowBlur = 25;
                ctx.beginPath();
                ctx.moveTo(150, 100); ctx.lineTo(420, 100);
                ctx.moveTo(150, 130); ctx.lineTo(420, 130);
                ctx.moveTo(150, 100); ctx.lineTo(100, 120); ctx.lineTo(60, 150); ctx.lineTo(80, 180); ctx.lineTo(150, 130);
                ctx.moveTo(150, 130); ctx.quadraticCurveTo(160, 160, 180, 130);
                ctx.stroke();
            };
        } else if (weapon === 'famas') {
            return (ctx) => {
                ctx.strokeStyle = "rgba(180, 230, 255, 1)";
                ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.lineJoin = "round";
                ctx.shadowColor = "rgba(0, 200, 255, 1)"; ctx.shadowBlur = 25;
                ctx.beginPath();
                ctx.moveTo(80, 120); ctx.lineTo(400, 120);
                ctx.lineTo(400, 140); ctx.lineTo(380, 150); ctx.lineTo(320, 150);
                ctx.lineTo(300, 180); ctx.lineTo(260, 180); ctx.lineTo(280, 150);
                ctx.lineTo(120, 150); ctx.lineTo(100, 190); ctx.lineTo(60, 190); ctx.lineTo(80, 150);
                ctx.lineTo(80, 120);
                ctx.moveTo(150, 120); ctx.lineTo(160, 80); ctx.lineTo(320, 80); ctx.lineTo(330, 120);
                ctx.stroke();
            };
        } else {
            return (ctx) => {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
                ctx.lineWidth = 10;
                ctx.strokeRect(50, 50, 412, 156);
                ctx.font = "bold 60px Arial";
                ctx.fillStyle = "white";
                ctx.textAlign = "center";
                ctx.fillText(weapon.toUpperCase(), 256, 140);
            };
        }
    }

    private buildBuildings(buildings: MapDefinition['interactables']['buildings']) {
        if (!buildings) return;

        buildings.forEach(b => {
            const building = createBuilding(
                this.scene,
                b,
                this.shadowCasters,
                this.navMeshes,
                { onLoaded: this.onBuildingLoaded },
                this.loadPromises
            );
            building.parent = this.root;
        });
    }

    private buildPowerSwitch(powerSwitch: MapDefinition['interactables']['powerSwitch'], def: MapDefinition) {
        if (!powerSwitch) return;

        const ps = powerSwitch;
        const sw = createPowerSwitch(this.scene, new BABYLON.Vector3(ps.pos[0], ps.pos[1], ps.pos[2]), ps.rotation || 0, def.modelOverrides?.['power_switch'], this.loadPromises);
        sw.root.parent = this.root;
        this.powerSwitchHandle = sw.handle;
        this.powerSwitchActivate = sw.activate;

        const trig = this.scene.getMeshByName("powerSwitchTrigger");
        if (trig) trig.metadata = { type: 'POWER' } as InteractableMetadata;

        if (ps.powerDoor) {
            const pdDef = ps.powerDoor;
            this.powerDoorOpenY = pdDef.openY ?? 8;

            const pd = BABYLON.MeshBuilder.CreateBox("powerDoor", { width: pdDef.size[0], height: pdDef.size[1], depth: pdDef.size[2] }, this.scene);
            pd.position = new BABYLON.Vector3(pdDef.pos[0], pdDef.pos[1], pdDef.pos[2]);
            pd.visibility = 0;
            pd.checkCollisions = true;
            pd.parent = this.root;

            const pdVis = BABYLON.MeshBuilder.CreateBox("powerDoorVis", { width: pdDef.size[0], height: pdDef.size[1], depth: pdDef.size[2] }, this.scene);
            pdVis.parent = pd;
            pdVis.position = BABYLON.Vector3.Zero();
            pdVis.material = this.materials.get('powerDoor')!;
            this.powerDoor = pd;

            this.doorMeshes["powerDoor"] = {
                mesh: pd,
                observer: null,
                closedY: pdDef.pos[1],
                openY: this.powerDoorOpenY,
                size: pdDef.size,
                rotation: 0
            };
        }
    }

    private buildPackAPunch(packAPunch: MapDefinition['interactables']['packAPunch'], def: MapDefinition) {
        if (!packAPunch) return;

        const pp = packAPunch;
        const machine = createPackAPunchMachine(this.scene, new BABYLON.Vector3(pp.pos[0], pp.pos[1], pp.pos[2]), pp.rotation || 0, def.modelOverrides?.['pack_a_punch'], this.loadPromises);
        machine.parent = this.root;

        const papCost = this.mapGameplay.packAPunchCost ?? GAME_CONFIG.PACK_A_PUNCH_COST;
        const trig = this.scene.getMeshByName("papTrigger");
        if (trig) trig.metadata = { type: 'PAP', cost: papCost } as InteractableMetadata;
    }

    private buildMysteryBoxes(mysteryBoxes: MapDefinition['interactables']['mysteryBoxes']) {
        if (!mysteryBoxes || mysteryBoxes.length === 0) return;

        if (this.mysteryBoxRef.current) {
            this.mysteryBoxRef.current.instances = [];
        }

        mysteryBoxes.forEach((loc, index) => {
            const box = createMysteryBox(this.scene);
            box.root.parent = this.root;
            box.root.position = new BABYLON.Vector3(loc.pos[0], loc.pos[1], loc.pos[2]);
            if (loc.rotation) box.root.rotation.y = loc.rotation;

            if (this.mysteryBoxRef.current) {
                this.mysteryBoxRef.current.instances.push({
                    mesh: box.root,
                    lidMesh: box.lidPivot,
                    weaponAnchor: box.weaponAnchor,
                    glowLight: box.light,
                    teddyMesh: box.teddy,
                    beamMesh: box.beam,
                    glowPlaneMesh: box.glowPlane,
                    trigger: box.trigger
                });
            }

            box.trigger.metadata = { type: 'MYSTERY_BOX' } as InteractableMetadata;

            if (index > 0) {
                box.root.setEnabled(false);
                if (box.trigger) box.trigger.setEnabled(false);
            }
        });

        if (this.mysteryBoxRef.current && this.mysteryBoxRef.current.instances.length > 0) {
            this.mysteryBoxRef.current.activeLocationIndex = 0;
        }
    }

    private buildFixtures(def: MapDefinition) {
        if (!def.fixtures) return;
        def.fixtures.forEach(f => {
            const fix = createFixture(this.scene, f.pos[0], f.pos[1], f.zone, this.lights, f.intensity, f.range);
            fix.root.parent = this.root;
        });
    }

    private extractDoorConnections(def: MapDefinition) {
        const doorConnections: DoorConnection[] = [];

        if (def.interactables.doors) {
            def.interactables.doors.forEach(d => {
                doorConnections.push({
                    doorId: d.id,
                    fromZone: d.connects[0],
                    toZone: d.connects[1],
                    waypoint: new BABYLON.Vector3(d.pos[0], d.pos[1], d.pos[2]),
                    entryThreshold: 2.0
                });
            });
        }

        const powerDoorDef = def.interactables.powerSwitch?.powerDoor;
        if (powerDoorDef?.connects) {
            doorConnections.push({
                doorId: "powerDoor",
                fromZone: powerDoorDef.connects[0],
                toZone: powerDoorDef.connects[1],
                waypoint: new BABYLON.Vector3(powerDoorDef.pos[0], powerDoorDef.pos[1], powerDoorDef.pos[2]),
                entryThreshold: 2.0
            });
        }

        return doorConnections;
    }
}
