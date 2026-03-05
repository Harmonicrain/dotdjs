import * as BABYLON from '@babylonjs/core';

export interface BuildingDefinition {
    id: string;
    model: string;  // Path to GLB file
    pos: [number, number, number];
    rotation?: [number, number, number];
    scaling?: [number, number, number];
    checkCollisions?: boolean;
    receiveShadows?: boolean;
    castShadows?: boolean;
}

export interface BuildingOptions {
    onLoaded?: (meshes: BABYLON.Mesh[]) => void;
}

export const createBuilding = (
    scene: BABYLON.Scene,
    def: BuildingDefinition,
    shadowCasters: BABYLON.AbstractMesh[],
    navMeshes: BABYLON.Mesh[],
    options?: BuildingOptions,
    promises?: Promise<any>[]
): BABYLON.TransformNode => {
    const root = new BABYLON.TransformNode(`building_${def.id}`, scene);
    root.position = new BABYLON.Vector3(def.pos[0], def.pos[1], def.pos[2]);
    
    if (def.rotation) {
        root.rotation = new BABYLON.Vector3(def.rotation[0], def.rotation[1], def.rotation[2]);
    }

    const loadedMeshes: BABYLON.Mesh[] = [];

    // Load 3D Model
    const p = BABYLON.SceneLoader.ImportMeshAsync("", "", def.model, scene)
        .then((result) => {
            if (scene.isDisposed) return;

            const model = result.meshes[0];
            model.parent = root;
            
            // Reset position relative to root
            model.position = BABYLON.Vector3.Zero();
            
            // Apply scaling if specified
            if (def.scaling) {
                model.scaling = new BABYLON.Vector3(def.scaling[0], def.scaling[1], def.scaling[2]);
            }

            // Process all meshes in the model
            result.meshes.forEach(m => {
                if (m instanceof BABYLON.Mesh) {
                    loadedMeshes.push(m);
                    
                    // Collisions
                    if (def.checkCollisions !== false) {
                        m.checkCollisions = true;
                    }
                    
                    // Shadows
                    if (def.castShadows !== false) {
                        shadowCasters.push(m);
                    }
                    if (def.receiveShadows !== false) {
                        m.receiveShadows = true;
                    }
                    
                    // Limit lights to prevent shader overflow
                    if (m.material) {
                        (m.material as any).maxSimultaneousLights = 4;
                    }
                }
            });

            // Notify that building is loaded (for decal meshes, etc.)
            if (options?.onLoaded) {
                options.onLoaded(loadedMeshes);
            }
        })
        .catch((e) => {
            if (scene.isDisposed) return;
            console.error(`Failed to load building model ${def.model}:`, e);
            
            // Fallback visual (red placeholder box)
            const fallback = BABYLON.MeshBuilder.CreateBox(`building_${def.id}_fallback`, {
                height: 5, width: 5, depth: 5
            }, scene);
            fallback.parent = root;
            fallback.position.y = 2.5;
            const mat = new BABYLON.StandardMaterial("buildingErrMat", scene);
            mat.diffuseColor = new BABYLON.Color3(1, 0, 0);
            mat.alpha = 0.5;
            fallback.material = mat;
        });

    if (promises) promises.push(p);

    return root;
};
