
import * as BABYLON from '@babylonjs/core';
import { MODELS } from '../../config';
import { ModelTransform } from '../../config/modelTransforms';
import { createPerkMachine } from './createPerkMachine';

export const createQuickRevive = (scene: BABYLON.Scene, shadowCasters: BABYLON.AbstractMesh[], position: BABYLON.Vector3, rotationY: number = 0, modelOverride?: Partial<ModelTransform>, promises?: Promise<any>[]) =>
    createPerkMachine({
        name: 'quickRevive',
        modelUrl: MODELS.QUICK_REVIVE,
        transformKey: 'quick_revive',
        triggerName: 'quickReviveTrigger',
        collisionName: 'qrCollision',
        collisionBox: { height: 2.2, width: 1.3, depth: 1.3 },
        fallbackName: 'qrFallback',
        fallbackColor: new BABYLON.Color3(0, 0.6, 0.8),
    }, scene, shadowCasters, position, rotationY, modelOverride, promises);
