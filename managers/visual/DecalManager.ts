import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from '../ResourceManager';

export class DecalManager {
    private decalMat: BABYLON.StandardMaterial | null = null;
    private activeDecals: BABYLON.AbstractMesh[] = [];
    private MAX_DECALS = 40;

    private activeBloodDecals: BABYLON.AbstractMesh[] = [];
    private static readonly MAX_BLOOD_DECALS = 60;

    private static readonly _floorRayDir = new BABYLON.Vector3(0, -1, 0);
    private static readonly _floorRayUp = new BABYLON.Vector3(0, 1, 0);
    private static readonly _floorRayOrigin = new BABYLON.Vector3();
    private static readonly _floorRay = new BABYLON.Ray(
        new BABYLON.Vector3(), BABYLON.Vector3.Down(), 10
    );

    constructor(private scene: BABYLON.Scene, private resourceManager: ResourceManager) {}

    private initDecalMaterial() {
        if (this.decalMat) return;
        this.decalMat = this.resourceManager.getMaterial("decalMat", () => {
            const mat = new BABYLON.StandardMaterial("decalMat", this.scene);
            mat.diffuseTexture = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/impact.png");
            mat.diffuseTexture.hasAlpha = true;
            mat.zOffset = -2;
            mat.specularColor = BABYLON.Color3.Black();
            return mat;
        });
    }

    public createDecal(pos: BABYLON.Vector3, normal: BABYLON.Vector3, target: BABYLON.AbstractMesh) {
        this.initDecalMaterial();
        if (!this.decalMat || !target) return;

        const size = new BABYLON.Vector3(0.2, 0.2, 0.2);
        const decal = BABYLON.MeshBuilder.CreateDecal("bulletHole", target, {
            position: pos,
            normal: normal,
            size: size,
            angle: Math.random() * Math.PI
        });

        decal.material = this.decalMat;
        decal.isPickable = false;
        decal.setParent(target);

        this.activeDecals.push(decal);

        if (this.activeDecals.length > this.MAX_DECALS) {
            const oldest = this.activeDecals.shift();
            if (oldest) oldest.dispose();
        }
    }

    public createBloodDecalOnMesh(pos: BABYLON.Vector3, normal: BABYLON.Vector3, target: BABYLON.AbstractMesh) {
        if (this.activeBloodDecals.length >= DecalManager.MAX_BLOOD_DECALS) {
            const oldest = this.activeBloodDecals.shift();
            if (oldest && !oldest.isDisposed()) oldest.dispose();
        }

        const size = new BABYLON.Vector3(0.15, 0.15, 0.15);
        const decal = BABYLON.MeshBuilder.CreateDecal("bloodDecal", target, {
            position: pos,
            normal: normal,
            size: size,
            angle: Math.random() * Math.PI
        });

        let bloodMat = this.resourceManager.getMaterial("bloodDecalMat", () => {
            const mat = new BABYLON.StandardMaterial("bloodDecalMat", this.scene);
            mat.diffuseColor = new BABYLON.Color3(0.6, 0, 0);
            mat.specularColor = BABYLON.Color3.Black();
            mat.zOffset = -1;
            return mat;
        });

        decal.material = bloodMat;
        decal.isPickable = false;
        decal.setParent(target);

        this.activeBloodDecals.push(decal);
    }

    public createFloorBloodDecal(pos: BABYLON.Vector3) {
        DecalManager._floorRayOrigin.set(pos.x, pos.y + 0.1, pos.z);
        DecalManager._floorRay.origin.copyFrom(DecalManager._floorRayOrigin);
        DecalManager._floorRay.direction.copyFrom(DecalManager._floorRayDir);
        DecalManager._floorRay.length = 10;
        const floorPick = this.scene.pickWithRay(DecalManager._floorRay, (m) => m.checkCollisions && m.isEnabled());
        if (floorPick && floorPick.hit && floorPick.pickedPoint && floorPick.pickedMesh) {
            this.createBloodDecalOnMesh(floorPick.pickedPoint, DecalManager._floorRayUp, floorPick.pickedMesh);
        }
    }

    public getDecalMaterial(): BABYLON.StandardMaterial | null {
        this.initDecalMaterial();
        return this.decalMat;
    }

    public getBloodDecalMaterial(): BABYLON.StandardMaterial {
        return this.resourceManager.getMaterial("bloodDecalMat", () => {
            const mat = new BABYLON.StandardMaterial("bloodDecalMat", this.scene);
            mat.diffuseColor = new BABYLON.Color3(0.6, 0, 0);
            mat.specularColor = BABYLON.Color3.Black();
            mat.zOffset = -1;
            return mat;
        });
    }

    public reset() {
        this.activeDecals.forEach(d => d.dispose());
        this.activeDecals = [];
        this.activeBloodDecals.forEach(d => { if (!d.isDisposed()) d.dispose(); });
        this.activeBloodDecals = [];
    }

    public dispose() {
        this.activeDecals.forEach(d => d.dispose());
        this.activeDecals = [];
        this.activeBloodDecals.forEach(d => { if (!d.isDisposed()) d.dispose(); });
        this.activeBloodDecals = [];
        if (this.decalMat) this.decalMat.dispose();
    }
}
