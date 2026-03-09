
import * as BABYLON from '@babylonjs/core';
import { WindowBarrier, InteractableMetadata } from '../types/index';

/**
 * Marks a material as dirty when a texture finishes loading.
 * This ensures materials recompile after textures are on GPU.
 */
export const markMaterialDirtyOnLoad = (mat: BABYLON.Material, tex: BABYLON.Texture): void => {
    if (tex.isReady()) {
        mat.markDirty();
    } else {
        tex.onLoadObservable.addOnce(() => {
            mat.markDirty();
        });
    }
};

/**
 * Creates a PBR material with standard setup for level geometry.
 * 
 * IMPORTANT: When textures are served from browser cache, they can resolve
 * synchronously before the PBR pipeline has processed the environment texture,
 * causing materials to compile with black/missing environment contribution.
 * We hook into the texture's onLoadObservable to force a material recompile
 * once the texture data is actually on the GPU.
 */
export const createMaterial = (
    scene: BABYLON.Scene,
    name: string,
    textureUrl: string,
    color: BABYLON.Color3,
    uScale: number = 1,
    vScale: number = 1,
    roughness: number = 0.75
) => {
    const mat = new BABYLON.PBRMaterial(name, scene);
    const tex = new BABYLON.Texture(textureUrl, scene, {
        noMipmap: false,
    });
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = uScale;
    tex.vScale = vScale;

    mat.albedoTexture = tex;
    mat.albedoColor = color;
    mat.metallic = 0.05; // Concrete/Brick/Wood is dielectric
    mat.roughness = roughness;
    mat.maxSimultaneousLights = 8;
    mat.directIntensity = 1.0;
    mat.environmentIntensity = 0.6;

    // Force material recompile when the texture finishes loading.
    markMaterialDirtyOnLoad(mat, tex);

    return mat;
};

/**
 * Creates a box with UVs scaled to match the dimensions, ensuring texture tiling is consistent.
 */
export const createTiledBox = (
    scene: BABYLON.Scene,
    name: string,
    options: { w: number, h: number, d: number },
    position: BABYLON.Vector3,
    material: BABYLON.Material,
    uvScale: number = 1.0,
    castShadows: boolean,
    shadowCasters: BABYLON.AbstractMesh[],
    navMeshes: BABYLON.Mesh[]
) => {
    const { w, h, d } = options;
    const faceUV = [
        new BABYLON.Vector4(0, 0, w * uvScale, h * uvScale),
        new BABYLON.Vector4(0, 0, w * uvScale, h * uvScale),
        new BABYLON.Vector4(0, 0, d * uvScale, h * uvScale),
        new BABYLON.Vector4(0, 0, d * uvScale, h * uvScale),
        new BABYLON.Vector4(0, 0, w * uvScale, d * uvScale),
        new BABYLON.Vector4(0, 0, w * uvScale, d * uvScale)
    ];
    const box = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d, faceUV: faceUV, wrap: true }, scene);
    box.position = position;
    box.material = material;
    box.checkCollisions = true;
    if (castShadows) {
        box.receiveShadows = true;
        shadowCasters.push(box);
    }
    navMeshes.push(box);
    return box;
};

/**
 * Creates a wall buy visual (chalk outline + trigger)
 */
export const createWallBuy = (
    scene: BABYLON.Scene,
    name: string,
    pos: BABYLON.Vector3,
    rotY: number,
    drawingFn: (ctx: CanvasRenderingContext2D) => void
) => {
    const root = new BABYLON.TransformNode(name + "_root", scene);
    root.position = pos;
    root.rotation.y = rotY;
    const gunPlane = BABYLON.MeshBuilder.CreatePlane(name + "_mesh", { width: 2, height: 1, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    gunPlane.parent = root;
    const gunTex = new BABYLON.DynamicTexture(name + "_tex", { width: 512, height: 256 }, scene, true);
    gunTex.hasAlpha = true;
    const ctx = gunTex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 256);
    drawingFn(ctx);
    gunTex.update();

    const gunMat = new BABYLON.StandardMaterial(name + "_mat", scene);
    gunMat.diffuseTexture = gunTex;
    gunMat.emissiveTexture = gunTex;
    gunMat.useAlphaFromDiffuseTexture = true;
    gunMat.disableLighting = true;
    gunMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    gunMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;

    gunPlane.material = gunMat;

    const glowLight = new BABYLON.PointLight(name + "_glow", new BABYLON.Vector3(0, 0, -0.5), scene);
    glowLight.parent = root; glowLight.diffuse = new BABYLON.Color3(0.4, 0.8, 1); glowLight.intensity = 0.8; glowLight.range = 4;
    const trigger = BABYLON.MeshBuilder.CreateBox(name + "_trigger", { width: 2.5, height: 2, depth: 1.5 }, scene);
    trigger.parent = root; trigger.visibility = 0; trigger.checkCollisions = false;

    return root;
};

/**
 * Creates a window barrier with planks, trigger, and spawn/entry points logic.
 */
export const createWindow = (
    scene: BABYLON.Scene,
    id: string,
    zPos: number,
    zone: number,
    windowsRef: WindowBarrier[],
    plankMat: BABYLON.Material,
    metalMat: BABYLON.Material,
    voidMat: BABYLON.Material,
    xOverride?: number,
    isRotated: boolean = false
) => {
    const xPos = xOverride || 10;
    const width = 4.5;
    const boards: BABYLON.AbstractMesh[] = [];
    const plankDefs = [{ y: 0.5, rot: 0.02 }, { y: 1.0, rot: -0.05 }, { y: 1.5, rot: 0.05 }, { y: 2.0, rot: -0.03 }, { y: 2.5, rot: 0.04 }];

    plankDefs.forEach((def, i) => {
        const pW = isRotated ? width + 0.2 : 0.1;
        const pD = isRotated ? 0.1 : width + 0.2;
        const plank = BABYLON.MeshBuilder.CreateBox(id + "_plank_" + i, { width: pW, height: 0.6, depth: pD }, scene);
        plank.position = new BABYLON.Vector3(xPos, def.y, zPos);
        if (isRotated) {
            plank.rotation.x = def.rot + ((Math.random() - 0.5) * 0.1);
            plank.rotation.z = (Math.random() - 0.5) * 0.05;
            plank.position.z += (Math.random() * 0.05);
        } else {
            plank.rotation.x = def.rot + ((Math.random() - 0.5) * 0.1);
            plank.rotation.y = (Math.random() - 0.5) * 0.05;
            plank.position.x += (Math.random() * 0.05);
        }
        plank.material = plankMat;
        plank.checkCollisions = false;
        boards.push(plank);
        if (!isRotated) {
            const nail1 = BABYLON.MeshBuilder.CreateCylinder(id + "_nail_" + i + "_1", { diameter: 0.08, height: 0.15 }, scene);
            nail1.rotation.z = Math.PI / 2; nail1.parent = plank; nail1.position = new BABYLON.Vector3(-0.05, 0, 1.8); nail1.material = metalMat;
            const nail2 = BABYLON.MeshBuilder.CreateCylinder(id + "_nail_" + i + "_2", { diameter: 0.08, height: 0.15 }, scene);
            nail2.rotation.z = Math.PI / 2; nail2.parent = plank; nail2.position = new BABYLON.Vector3(-0.05, 0, -1.8); nail2.material = metalMat;
        } else {
            const nail1 = BABYLON.MeshBuilder.CreateCylinder(id + "_nail_" + i + "_1", { diameter: 0.08, height: 0.15 }, scene);
            nail1.rotation.x = Math.PI / 2; nail1.parent = plank; nail1.position = new BABYLON.Vector3(1.8, 0, -0.05); nail1.material = metalMat;
            const nail2 = BABYLON.MeshBuilder.CreateCylinder(id + "_nail_" + i + "_2", { diameter: 0.08, height: 0.15 }, scene);
            nail2.rotation.x = Math.PI / 2; nail2.parent = plank; nail2.position = new BABYLON.Vector3(-1.8, 0, -0.05); nail2.material = metalMat;
        }
    });
    let voidW = 10, voidD = width + 2;
    let trigW = 2, trigD = width;
    let blockW = 1, blockD = width;
    if (isRotated) {
        voidW = width + 2; voidD = 10;
        trigW = width; trigD = 2;
        blockW = width; blockD = 1;
    }
    const voidBox = BABYLON.MeshBuilder.CreateBox(id + "_void", { width: voidW, height: 9, depth: voidD, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
    if (isRotated) voidBox.position = new BABYLON.Vector3(xPos, 4.51, zPos + 5.05);
    else voidBox.position = new BABYLON.Vector3(xPos + 5.05, 4.51, zPos);
    voidBox.material = voidMat; voidBox.receiveShadows = false;

    const trigger = BABYLON.MeshBuilder.CreateBox(id + "_trigger", { width: trigW, height: 5, depth: trigD }, scene);
    if (isRotated) trigger.position = new BABYLON.Vector3(xPos, 2.5, zPos - 1);
    else trigger.position = new BABYLON.Vector3(xPos - 1, 2.5, zPos);
    trigger.visibility = 0; trigger.checkCollisions = false;

    const blocker = BABYLON.MeshBuilder.CreateBox(id + "_blocker", { width: blockW, height: 6, depth: blockD }, scene);
    if (isRotated) blocker.position = new BABYLON.Vector3(xPos, 3, zPos);
    else blocker.position = new BABYLON.Vector3(xPos, 3, zPos);
    blocker.visibility = 0; blocker.checkCollisions = true;

    // Spawn / Attack / Entry points
    let spawnP = new BABYLON.Vector3(xPos + 5, 2.5, zPos);
    let attackP = new BABYLON.Vector3(xPos + 1.5, 0.1, zPos);
    let entryP = new BABYLON.Vector3(xPos - 2, 0.1, zPos);

    if (isRotated) {
        spawnP = new BABYLON.Vector3(xPos, 2.5, zPos + 3);
        attackP = new BABYLON.Vector3(xPos, 0.1, zPos + 1.2);
        entryP = new BABYLON.Vector3(xPos, 0.1, zPos - 2.0);
    }
    windowsRef.push({
        id, triggerMesh: trigger, boards,
        position: new BABYLON.Vector3(xPos, 4, zPos),
        spawnPoint: spawnP,
        attackPoint: attackP,
        entryPoint: entryP,
        zone
    });
};

export const createFixture = (
    scene: BABYLON.Scene,
    x: number,
    z: number,
    zone: number,
    lights: BABYLON.PointLight[],
    intensity: number = 1.5,
    range: number = 20
) => {
    const root = new BABYLON.TransformNode(`fixture_root_${x}_${z}`, scene);

    const wire = BABYLON.MeshBuilder.CreateCylinder("wire", { diameter: 0.05, height: 1.5 }, scene);
    wire.position = new BABYLON.Vector3(x, 9.25, z);
    wire.parent = root;

    const wireMat = new BABYLON.PBRMaterial("wireMat", scene);
    wireMat.albedoColor = BABYLON.Color3.Black(); wireMat.metallic = 0; wireMat.roughness = 0.5;
    wire.material = wireMat;

    const housing = BABYLON.MeshBuilder.CreateCylinder("housing", { diameterTop: 0.6, diameterBottom: 0.8, height: 0.4 }, scene);
    housing.position = new BABYLON.Vector3(x, 8.5, z);
    housing.parent = root;

    const housingMat = new BABYLON.PBRMaterial("housingMat", scene);
    housingMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.15); housingMat.metallic = 0.7; housingMat.roughness = 0.4;
    housing.material = housingMat;

    const bulb = BABYLON.MeshBuilder.CreateSphere("bulb_" + x + "_" + z, { diameter: 0.25 }, scene);
    bulb.position = new BABYLON.Vector3(x, 8.3, z);
    bulb.parent = root;

    const bulbMat = new BABYLON.PBRMaterial("bulbMat_" + x + "_" + z, scene);
    bulbMat.albedoColor = new BABYLON.Color3(1.0, 0.9, 0.8);
    bulbMat.emissiveColor = new BABYLON.Color3(1.0, 0.6, 0.2);
    bulbMat.unlit = true;
    bulb.material = bulbMat;

    const pl = new BABYLON.PointLight(`light_zone_${zone}_${x}_${z}`, new BABYLON.Vector3(x, 7.5, z), scene);
    pl.intensity = intensity; pl.range = range;
    pl.diffuse = new BABYLON.Color3(1.0, 0.75, 0.45); pl.specular = new BABYLON.Color3(0.1, 0.1, 0.1);
    pl.parent = root;

    const noiseOffset = Math.random() * 1000;

    const obs = scene.onBeforeRenderObservable.add(() => {
        if (pl.isDisposed()) {
            scene.onBeforeRenderObservable.remove(obs);
            return;
        }

        if (!pl.isEnabled()) {
            bulbMat.emissiveColor.set(0, 0, 0);
        } else {
            bulbMat.emissiveColor.set(1.0, 0.6, 0.2);
        }
    });

    lights.push(pl);
    return { root, light: pl };
};

/**
 * Computes horizontal distance between two positions (ignoring Y).
 */
export const getHorizontalDist = (p1: BABYLON.Vector3, p2: BABYLON.Vector3): number => {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dz * dz);
};

/**
 * Computes horizontal squared distance between two positions (ignoring Y).
 */
export const getHorizontalDistSq = (p1: BABYLON.Vector3, p2: BABYLON.Vector3): number => {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return dx * dx + dz * dz;
};

