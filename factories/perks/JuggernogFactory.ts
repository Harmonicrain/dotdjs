
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { resolveModelTransform, ModelTransform } from '../../config/modelTransforms';

export const createJuggernog = (scene: BABYLON.Scene, shadowCasters: BABYLON.AbstractMesh[], position: BABYLON.Vector3, rotationY: number = 0, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) => {
    const root = new BABYLON.TransformNode("juggernogRoot", scene);
    root.position = position;
    root.rotation.y = rotationY;

    // Interaction Trigger
    const trigger = BABYLON.MeshBuilder.CreateBox("juggernogTrigger", {width: 2, height: 2, depth: 2}, scene);
    trigger.parent = root; 
    trigger.position.y = 1; 
    trigger.visibility = 0; 
    trigger.checkCollisions = false;

    // Load 3D Model
    const p = BABYLON.SceneLoader.ImportMeshAsync("", "", MODELS.JUGGERNOG, scene)
        .then((result) => {
            if (scene.isDisposed) return; // Prevent error if scene died during load

            const model = result.meshes[0];
            model.parent = root;
            
            // Reset transforms relative to root
            const tx = resolveModelTransform('juggernog', modelOverride);
            model.position = new BABYLON.Vector3(tx.position[0], tx.position[1], tx.position[2]);
            model.rotation = new BABYLON.Vector3(tx.rotation[0], tx.rotation[1], tx.rotation[2]);
            model.scaling = new BABYLON.Vector3(tx.scaling[0], tx.scaling[1], tx.scaling[2]);

            // Register shadow casters & collisions
            result.meshes.forEach(m => {
                if (m instanceof BABYLON.Mesh) {
                    shadowCasters.push(m);
                    m.checkCollisions = true;
                    
                    // Limit lights to prevent shader overflow (GL_MAX_VERTEX_UNIFORM_BUFFERS)
                    if (m.material) {
                        (m.material as any).maxSimultaneousLights = 4;
                    }
                }
            });
        })
        .catch((e) => {
            if (scene.isDisposed) return;
            console.error("Failed to load Juggernog model:", e);
            // Fallback visual in case of error (red placeholder)
            const fallback = BABYLON.MeshBuilder.CreateBox("juggFallback", {height: 2, width: 1, depth: 1}, scene);
            fallback.parent = root;
            fallback.position.y = 1;
            const mat = new BABYLON.StandardMaterial("errMat", scene);
            mat.diffuseColor = new BABYLON.Color3(1, 0, 0);
            fallback.material = mat;
        });

    if (promises) promises.push(p);

    return root;
};
