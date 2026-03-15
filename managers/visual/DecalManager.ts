import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from '../ResourceManager';

export class DecalManager {
    private decalMat: BABYLON.StandardMaterial | null = null;

    // ── Circular-buffer pools replace shift()-based arrays ────────────────
    // Decals are pre-allocated once and recycled via cursor index, eliminating
    // both the costly MeshBuilder.CreateDecal() per-shot AND the O(n) shift().
    private static readonly MAX_DECALS = 40;
    private decalPool: (BABYLON.Mesh | null)[] = new Array(DecalManager.MAX_DECALS).fill(null);
    private decalCursor = 0;

    private static readonly MAX_BLOOD_DECALS = 60;
    private bloodDecalPool: (BABYLON.Mesh | null)[] = new Array(DecalManager.MAX_BLOOD_DECALS).fill(null);
    private bloodDecalCursor = 0;

    // Throttle decal creation — at most one bullet-hole decal per this interval
    private static readonly DECAL_THROTTLE_MS = 50; // ~20 decals/sec max
    private lastDecalTime = 0;
    private lastBloodDecalTime = 0;

    private static readonly _floorRayDir = new BABYLON.Vector3(0, -1, 0);
    private static readonly _floorRayUp = new BABYLON.Vector3(0, 1, 0);
    private static readonly _floorRayOrigin = new BABYLON.Vector3();
    private static readonly _floorRay = new BABYLON.Ray(
        new BABYLON.Vector3(), BABYLON.Vector3.Down(), 10
    );

    constructor(private scene: BABYLON.Scene, private resourceManager: ResourceManager) { }

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

        // Throttle: skip if too soon after last decal
        const now = performance.now();
        if (now - this.lastDecalTime < DecalManager.DECAL_THROTTLE_MS) return;
        this.lastDecalTime = now;

        const idx = this.decalCursor % DecalManager.MAX_DECALS;
        this.decalCursor++;

        // Dispose old decal in this slot
        const old = this.decalPool[idx];
        if (old && !old.isDisposed()) old.dispose();

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

        this.decalPool[idx] = decal;
    }

    public createBloodDecalOnMesh(pos: BABYLON.Vector3, normal: BABYLON.Vector3, target: BABYLON.AbstractMesh) {
        // Throttle blood decals too
        const now = performance.now();
        if (now - this.lastBloodDecalTime < DecalManager.DECAL_THROTTLE_MS) return;
        this.lastBloodDecalTime = now;

        const idx = this.bloodDecalCursor % DecalManager.MAX_BLOOD_DECALS;
        this.bloodDecalCursor++;

        // Dispose old decal in this slot
        const old = this.bloodDecalPool[idx];
        if (old && !old.isDisposed()) old.dispose();

        const size = new BABYLON.Vector3(0.15, 0.15, 0.15);
        const decal = BABYLON.MeshBuilder.CreateDecal("bloodDecal", target, {
            position: pos,
            normal: normal,
            size: size,
            angle: Math.random() * Math.PI
        });

        let bloodMat = this.getBloodDecalMaterial();

        decal.material = bloodMat;
        decal.isPickable = false;
        decal.setParent(target);

        this.bloodDecalPool[idx] = decal;
    }

    public createFloorBloodDecal(pos: BABYLON.Vector3) {
        // Skip if blood decal was just throttled (avoid the raycast entirely)
        const now = performance.now();
        if (now - this.lastBloodDecalTime < DecalManager.DECAL_THROTTLE_MS) return;

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

    /** Between-round/between-game cleanup — disposes decal meshes, manager stays alive. */
    public reset() {
        for (const d of this.decalPool) {
            if (d && !d.isDisposed()) d.dispose();
        }
        this.decalPool.fill(null);
        this.decalCursor = 0;

        for (const d of this.bloodDecalPool) {
            if (d && !d.isDisposed()) d.dispose();
        }
        this.bloodDecalPool.fill(null);
        this.bloodDecalCursor = 0;
    }

    /** Full teardown — manager is destroyed, disposes decals + shared materials. */
    public dispose() {
        for (const d of this.decalPool) {
            if (d && !d.isDisposed()) d.dispose();
        }
        this.decalPool.fill(null);

        for (const d of this.bloodDecalPool) {
            if (d && !d.isDisposed()) d.dispose();
        }
        this.bloodDecalPool.fill(null);

        if (this.decalMat) this.decalMat.dispose();
    }
}
