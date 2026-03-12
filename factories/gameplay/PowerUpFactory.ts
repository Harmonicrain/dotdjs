
import * as BABYLON from '@babylonjs/core';
import { PowerUpType } from '../../types/index';

export const createPowerUpMesh = (scene: BABYLON.Scene, type: PowerUpType, position: BABYLON.Vector3) => {
    const root = new BABYLON.TransformNode("powerUp_" + type, scene);
    root.position = position.clone();
    root.position.y += 0.3;

    const box = BABYLON.MeshBuilder.CreateBox("powerUpBox", {size: 0.5}, scene);
    box.parent = root;
    box.rotation.y = Math.PI / 4;
    box.rotation.x = Math.PI / 4;

    const mat = new BABYLON.PBRMaterial("powerUpMat_" + type, scene);
    mat.emissiveColor = new BABYLON.Color3(0.2, 1.0, 0.2);
    mat.unlit = true;

    if (type === PowerUpType.MAX_AMMO) mat.emissiveColor = new BABYLON.Color3(0.2, 1, 0.2);
    else if (type === PowerUpType.INSTA_KILL) mat.emissiveColor = new BABYLON.Color3(1, 0.2, 0.2);
    else if (type === PowerUpType.DOUBLE_POINTS) mat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.2);
    else if (type === PowerUpType.NUKE) mat.emissiveColor = new BABYLON.Color3(1, 1, 0.2);
    else if (type === PowerUpType.CARPENTER) mat.emissiveColor = new BABYLON.Color3(0.8, 0.6, 0.2);
    else if (type === PowerUpType.FIRE_SALE) mat.emissiveColor = new BABYLON.Color3(1, 0.5, 0); // Orange

    box.material = mat;

    const hl = new BABYLON.HighlightLayer("hl_" + Math.random(), scene);
    hl.addMesh(box, BABYLON.Color3.Green());

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
