import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from './ResourceManager';
import { ParticleManager } from './visual/ParticleManager';
import { DecalManager } from './visual/DecalManager';
import { GoreManager } from './visual/GoreManager';
import { VISUAL_CONFIG } from '../config';

export class VisualManager {
    public lights: BABYLON.PointLight[] = [];

    private particleManager: ParticleManager;
    private decalManager: DecalManager;
    private goreManager: GoreManager;

    constructor(private scene: BABYLON.Scene, private resourceManager: ResourceManager) {
        this.particleManager = new ParticleManager(scene, resourceManager);
        this.decalManager = new DecalManager(scene, resourceManager);
        this.goreManager = new GoreManager(scene, resourceManager);
    }

    public async preWarmAssets() {
        const textures = [
            "https://playground.babylonjs.com/textures/flare.png",
            "https://playground.babylonjs.com/textures/impact.png",
            "https://playground.babylonjs.com/textures/wood.jpg"
        ];
        await Promise.all(textures.map(t => this.resourceManager.preWarmTexture(t)));

        this.decalManager.getDecalMaterial();
        this.decalManager.getBloodDecalMaterial();
        this.goreManager.getFloorGoreMaterial();
    }

    public setLights(lights: BABYLON.PointLight[]) {
        this.lights = lights;
    }

    public createDecal(pos: BABYLON.Vector3, normal: BABYLON.Vector3, target: BABYLON.AbstractMesh) {
        this.decalManager.createDecal(pos, normal, target);
    }

    public createImpactParticles(pos: BABYLON.Vector3, normal: BABYLON.Vector3) {
        this.particleManager.createImpactParticles(pos, normal);
    }

    public createBloodSplatter(pos: BABYLON.Vector3, normal: BABYLON.Vector3, targetMesh?: BABYLON.AbstractMesh) {
        this.particleManager.createBloodSplatterParticles(pos, normal);

        if (targetMesh) {
            this.decalManager.createBloodDecalOnMesh(pos, normal, targetMesh);
        }

        this.decalManager.createFloorBloodDecal(pos);
    }

    public createZombieExplosion(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        this.particleManager.createZombieExplosionParticles(pos, hitDir);
        this.goreManager.createFloorGore(pos);
    }

    public createHeadExplosion(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        this.particleManager.createHeadExplosionParticles(pos, hitDir);
        this.goreManager.createFloorGore(pos);
    }

    public createHellhoundDeathExplosion(pos: BABYLON.Vector3) {
        this.particleManager.createHellhoundDeathExplosion(pos);
    }

    public createWoodDebris(pos: BABYLON.Vector3) {
        this.particleManager.createWoodDebris(pos);
    }

    public createGroundSpawnEruption(pos: BABYLON.Vector3) {
        this.particleManager.createDirtBurst(pos);
    }

    public createSpawnEffect(pos: BABYLON.Vector3) {
        this.particleManager.createSpawnEffect(pos);
    }

    public createSpawnSmokeEffect(pos: BABYLON.Vector3): BABYLON.ParticleSystem {
        return this.particleManager.createSpawnSmokeEffect(pos);
    }

    /** Start persistent ambient smoke on ground spawn holes. */
    public startHoleSmoke(positions: BABYLON.Vector3[]): void {
        this.particleManager.startHoleSmoke(positions);
    }

    /** Stop all persistent hole smoke. */
    public stopHoleSmoke(): void {
        this.particleManager.stopHoleSmoke();
    }

    public createPlasmaExplosion(pos: BABYLON.Vector3, isPacked: boolean = false) {
        this.particleManager.createPlasmaExplosion(pos, isPacked);
    }

    public createProjectileTrail(mesh: BABYLON.AbstractMesh, isPacked: boolean = false): BABYLON.ParticleSystem {
        return this.particleManager.createProjectileTrail(mesh, isPacked);
    }

    public stopProjectileTrail(ps: BABYLON.ParticleSystem) {
        this.particleManager.stopProjectileTrail(ps);
    }

    public reset() {
        this.decalManager.reset();
        this.goreManager.reset();
        this.particleManager.reset();

        this.lights = [];
    }

    public dispose() {
        this.decalManager.dispose();
        this.goreManager.dispose();
        this.particleManager.dispose();

        this.lights = [];
    }
}
