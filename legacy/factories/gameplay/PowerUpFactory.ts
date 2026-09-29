
import * as BABYLON from '@babylonjs/core';
import { PowerUpType } from '../../types/index';

const POWERUP_HIGHLIGHT_LAYER_KEY = '__dotd_powerupHighlightLayer';

const getPowerUpColor = (type: PowerUpType): BABYLON.Color3 => {
    if (type === PowerUpType.MAX_AMMO) return new BABYLON.Color3(0.2, 1, 0.2);
    if (type === PowerUpType.INSTA_KILL) return new BABYLON.Color3(1, 0.2, 0.2);
    if (type === PowerUpType.DOUBLE_POINTS) return new BABYLON.Color3(1, 0.8, 0.2);
    if (type === PowerUpType.NUKE) return new BABYLON.Color3(1, 1, 0.2);
    if (type === PowerUpType.CARPENTER) return new BABYLON.Color3(0.8, 0.6, 0.2);
    if (type === PowerUpType.FIRE_SALE) return new BABYLON.Color3(1, 0.5, 0);
    return new BABYLON.Color3(0.2, 1, 0.2);
};

const getSharedPowerUpHighlightLayer = (scene: BABYLON.Scene): BABYLON.HighlightLayer => {
    const sceneMetadata = (scene.metadata ??= {}) as Record<string, unknown>;
    const existingLayer = sceneMetadata[POWERUP_HIGHLIGHT_LAYER_KEY];

    if (existingLayer instanceof BABYLON.HighlightLayer) {
        return existingLayer;
    }

    const layer = new BABYLON.HighlightLayer('powerUpHighlightLayer', scene);
    sceneMetadata[POWERUP_HIGHLIGHT_LAYER_KEY] = layer;
    return layer;
};

export const createPowerUpMesh = (scene: BABYLON.Scene, type: PowerUpType, position: BABYLON.Vector3) => {
    const root = new BABYLON.TransformNode("powerUp_" + type, scene);
    root.position = position.clone();
    root.position.y += 0.45;

    const glowBox = BABYLON.MeshBuilder.CreateBox("powerUpGlowBox", { size: 0.72 }, scene);
    glowBox.parent = root;
    glowBox.rotation.y = Math.PI / 4;
    glowBox.rotation.x = Math.PI / 4;

    const box = BABYLON.MeshBuilder.CreateBox("powerUpBox", {size: 0.5}, scene);
    box.parent = root;
    box.rotation.y = Math.PI / 4;
    box.rotation.x = Math.PI / 4;

    const powerUpColor = getPowerUpColor(type);
    const mat = new BABYLON.StandardMaterial("powerUpMat_" + type, scene);
    mat.disableLighting = true;
    mat.diffuseColor = powerUpColor.scale(0.08);
    mat.specularColor = BABYLON.Color3.Black();
    mat.ambientColor = BABYLON.Color3.Black();
    mat.emissiveColor = powerUpColor.scale(0.75);

    const glowMat = new BABYLON.StandardMaterial("powerUpGlowMat_" + type, scene);
    glowMat.disableLighting = true;
    glowMat.diffuseColor = BABYLON.Color3.Black();
    glowMat.specularColor = BABYLON.Color3.Black();
    glowMat.ambientColor = BABYLON.Color3.Black();
    glowMat.emissiveColor = powerUpColor.scale(1.25);
    glowMat.alpha = 0.18;
    glowMat.alphaMode = BABYLON.Constants.ALPHA_ADD;

    box.material = mat;
    glowBox.material = glowMat;

    const light = new BABYLON.PointLight("powerUpLight", root.position.clone(), scene);
    light.parent = root;
    light.diffuse = powerUpColor.scale(0.8);
    light.specular = powerUpColor.scale(0.35);
    light.intensity = 1.8;
    light.range = 3.5;

    const hl = getSharedPowerUpHighlightLayer(scene);
    hl.innerGlow = false;
    hl.outerGlow = true;
    hl.addMesh(box, powerUpColor);
    root.onDisposeObservable.addOnce(() => {
        hl.removeMesh(box);
        if (box.material === mat) {
            mat.dispose();
        }
        if (glowBox.material === glowMat) {
            glowMat.dispose();
        }
        if (!light.isDisposed()) {
            light.dispose();
        }
    });

    // Spawn pop-in animation — scale from 0 → 1 with a slight overshoot
    const spawnAnim = new BABYLON.Animation(
        'powerUpSpawn', 'scaling', 60,
        BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    const ease = new BABYLON.BackEase(0.5);
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
    spawnAnim.setEasingFunction(ease);
    spawnAnim.setKeys([
        { frame: 0,  value: new BABYLON.Vector3(0, 0, 0) },
        { frame: 15, value: new BABYLON.Vector3(1, 1, 1) },
    ]);
    root.animations = [spawnAnim];
    scene.beginAnimation(root, 0, 15, false);

    return root;
};
