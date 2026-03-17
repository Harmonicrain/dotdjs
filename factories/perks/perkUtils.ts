
import * as BABYLON from '@babylonjs/core';

/**
 * Shared post-load setup for all perk machine models.
 * Limits simultaneous lights to prevent shader overflow (GL_MAX_VERTEX_UNIFORM_BUFFERS).
 */
export const configurePerkModel = (
    meshes: BABYLON.AbstractMesh[],
    shadowCasters: BABYLON.AbstractMesh[]
) => {
    meshes.forEach(m => {
        if (m instanceof BABYLON.Mesh) {
            shadowCasters.push(m);
            m.checkCollisions = false;
            if (m.material) {
                (m.material as any).maxSimultaneousLights = 4;
                if (m.material instanceof BABYLON.PBRMaterial) {
                    m.material.unlit = false;
                }
            }
        }
    });
};

/**
 * Creates a colored fallback box when a perk model fails to load.
 */
export const createPerkFallback = (
    scene: BABYLON.Scene,
    root: BABYLON.TransformNode,
    name: string,
    color: BABYLON.Color3,
    size: { height: number; width: number; depth: number } = { height: 2, width: 1, depth: 1 },
    posY: number = 1
) => {
    const fallback = BABYLON.MeshBuilder.CreateBox(name, size, scene);
    fallback.parent = root;
    fallback.position.y = posY;
    const mat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
    mat.diffuseColor = color;
    fallback.material = mat;
};
