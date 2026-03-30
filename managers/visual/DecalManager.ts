import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from '../ResourceManager';

const MAX_DECALS = 40;
const MAX_BLOOD_DECALS = 60;
const DECAL_THROTTLE_MS = 50; // ~20 decals/sec max
const BULLET_DECAL_SIZE = new BABYLON.Vector3(0.2, 0.2, 0.2);
const BLOOD_DECAL_BASE_SIZE = 0.12;

export class DecalManager {
    private decalMat: BABYLON.StandardMaterial | null = null;

    // ── Circular-buffer pools replace shift()-based arrays ────────────────
    // Decals are pre-allocated once and recycled via cursor index, eliminating
    // both the costly MeshBuilder.CreateDecal() per-shot AND the O(n) shift().
    private decalPool: (BABYLON.Mesh | null)[] = new Array(MAX_DECALS).fill(null);
    private decalCursor = 0;

    private bloodDecalPool: (BABYLON.Mesh | null)[] = new Array(MAX_BLOOD_DECALS).fill(null);
    private bloodDecalCursor = 0;

    // Throttle decal creation — at most one bullet-hole decal per this interval
    private lastDecalTime = 0;
    private lastBloodDecalTime = 0;

    private static readonly _floorRayDir = new BABYLON.Vector3(0, -1, 0);
    private static readonly _floorRayUp = new BABYLON.Vector3(0, 1, 0);
    private static readonly _floorRayOrigin = new BABYLON.Vector3();
    private static readonly _floorRay = new BABYLON.Ray(
        new BABYLON.Vector3(), BABYLON.Vector3.Down(), 10
    );
    private static readonly _bloodDecalSize = new BABYLON.Vector3();

    constructor(private scene: BABYLON.Scene, private resourceManager: ResourceManager) { }

    private createBloodDecalTexture(): BABYLON.DynamicTexture {
        const texture = new BABYLON.DynamicTexture(
            'bloodDecalTex',
            { width: 256, height: 256 },
            this.scene,
            true
        );
        const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, 256, 256);

        const core = ctx.createRadialGradient(128, 128, 10, 128, 128, 78);
        core.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        core.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
        core.addColorStop(0.82, 'rgba(255, 255, 255, 0.45)');
        core.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(128, 128, 78, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.45;
            const distance = 52 + Math.random() * 26;
            const radius = 12 + Math.random() * 16;
            const x = 128 + Math.cos(angle) * distance;
            const y = 128 + Math.sin(angle) * distance;
            const blot = ctx.createRadialGradient(x, y, 2, x, y, radius);
            blot.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            blot.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
            blot.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = blot;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        texture.hasAlpha = true;
        texture.update();
        return texture;
    }

    private getBloodDecalSize(): BABYLON.Vector3 {
        const width = BLOOD_DECAL_BASE_SIZE * (0.8 + Math.random() * 0.45);
        const height = BLOOD_DECAL_BASE_SIZE * (0.8 + Math.random() * 0.45);
        const depth = BLOOD_DECAL_BASE_SIZE * (0.85 + Math.random() * 0.2);
        return DecalManager._bloodDecalSize.set(width, height, depth);
    }

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
        if (now - this.lastDecalTime < DECAL_THROTTLE_MS) return;
        this.lastDecalTime = now;

        const idx = this.decalCursor % MAX_DECALS;
        this.decalCursor++;

        // Dispose old decal in this slot
        const old = this.decalPool[idx];
        if (old && !old.isDisposed()) old.dispose();

        const decal = BABYLON.MeshBuilder.CreateDecal("bulletHole", target, {
            position: pos,
            normal: normal,
            size: BULLET_DECAL_SIZE,
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
        if (now - this.lastBloodDecalTime < DECAL_THROTTLE_MS) return;
        this.lastBloodDecalTime = now;

        const idx = this.bloodDecalCursor % MAX_BLOOD_DECALS;
        this.bloodDecalCursor++;

        // Dispose old decal in this slot
        const old = this.bloodDecalPool[idx];
        if (old && !old.isDisposed()) old.dispose();

        const decal = BABYLON.MeshBuilder.CreateDecal("bloodDecal", target, {
            position: pos,
            normal: normal,
            size: this.getBloodDecalSize(),
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
        if (now - this.lastBloodDecalTime < DECAL_THROTTLE_MS) return;

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
            mat.diffuseTexture = this.resourceManager.getTexture(
                'bloodDecalDynamicTex',
                () => this.createBloodDecalTexture()
            );
            mat.diffuseTexture.hasAlpha = true;
            mat.useAlphaFromDiffuseTexture = true;
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
