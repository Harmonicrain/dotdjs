import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from '../ResourceManager';

const GORE_POOL_SIZE = 20;
const MAX_FLOOR_GORE = 60;
const GORE_FADE_MS = 30000;
const BLOOD_COLOR_R = 0.8;
const BLOOD_COLOR_G = 0;
const BLOOD_COLOR_B = 0;
const GORE_DISC_MIN_SCALE = 0.4;
const GORE_DISC_SCALE_RANGE = 0.45;
const MIN_GORE_BITS = 1;
const MAX_GORE_BITS = 2;

interface PooledSplatter {
    mesh: BABYLON.Mesh;
    material: BABYLON.StandardMaterial;
    observer: BABYLON.Observer<BABYLON.Scene> | null;
}

interface ActiveGoreDisc {
    mesh: BABYLON.Mesh;
    startTime: number;
    startVis: number;
}

export class GoreManager {
    private bloodPool: PooledSplatter[] = [];
    private poolSize = GORE_POOL_SIZE;

    private floorGorePieces: BABYLON.Mesh[] = [];
    private goreDiscPool: BABYLON.Mesh[] = [];
    private goreDiscCursor = 0;
    private activeGoreDiscs: ActiveGoreDisc[] = [];
    private goreFadeObserver: BABYLON.Observer<BABYLON.Scene> | null = null;

    private static readonly _floorRayDir = new BABYLON.Vector3(0, -1, 0);
    private static readonly _floorRayOrigin = new BABYLON.Vector3();
    private static readonly _floorRay = new BABYLON.Ray(
        new BABYLON.Vector3(), BABYLON.Vector3.Down(), 10
    );

    constructor(private scene: BABYLON.Scene, private resourceManager: ResourceManager) {
        this.initBloodPool();
        this.initGoreDiscPool();
        this.initGoreFadeObserver();
    }

    private initBloodPool() {
        for (let i = 0; i < this.poolSize; i++) {
            const plane = BABYLON.MeshBuilder.CreatePlane("blood_" + i, { size: 0.5 }, this.scene);
            plane.setEnabled(false);

            const mat = new BABYLON.StandardMaterial("bloodMat_" + i, this.scene);
            mat.diffuseColor = new BABYLON.Color3(BLOOD_COLOR_R, BLOOD_COLOR_G, BLOOD_COLOR_B);
            mat.specularColor = new BABYLON.Color3(0.1, 0, 0);
            mat.emissiveColor = new BABYLON.Color3(0.2, 0, 0);
            mat.alpha = 0.9;
            mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            plane.material = mat;

            this.bloodPool.push({
                mesh: plane,
                material: mat,
                observer: null
            });
        }
    }

    private initGoreDiscPool() {
        const mat = this.getFloorGoreMaterial();

        for (let i = 0; i < MAX_FLOOR_GORE; i++) {
            const disc = BABYLON.MeshBuilder.CreateDisc(`goreDisc_${i}`, {
                radius: 1,
                tessellation: 12
            }, this.scene);
            disc.material = mat ?? null;
            disc.isPickable = false;
            disc.setEnabled(false);
            disc.rotation.x = Math.PI / 2;
            this.goreDiscPool.push(disc);
        }
    }

    private initGoreFadeObserver() {
        this.goreFadeObserver = this.scene.onBeforeRenderObservable.add(() => {
            const arr = this.activeGoreDiscs;
            if (arr.length === 0) return; // no-op when nothing active (e.g. after reset())
            const now = Date.now();
            for (let i = arr.length - 1; i >= 0; i--) {
                const entry = arr[i];
                const elapsed = now - entry.startTime;

                if (elapsed >= GORE_FADE_MS) {
                    entry.mesh.setEnabled(false);
                    // Swap-remove: O(1) instead of splice O(n)
                    arr[i] = arr[arr.length - 1];
                    arr.pop();
                } else {
                    const t = elapsed / GORE_FADE_MS;
                    entry.mesh.visibility = entry.startVis * (1 - t);
                }
            }
        });
    }

    public createFloorGore(pos: BABYLON.Vector3): void {
        GoreManager._floorRayOrigin.set(pos.x, pos.y + 0.5, pos.z);
        GoreManager._floorRay.origin.copyFrom(GoreManager._floorRayOrigin);
        GoreManager._floorRay.direction.copyFrom(GoreManager._floorRayDir);
        GoreManager._floorRay.length = 10;
        const floorPick = this.scene.pickWithRay(GoreManager._floorRay, (m) => m.checkCollisions && m.isEnabled());
        const floorY = (floorPick && floorPick.hit && floorPick.pickedPoint)
            ? floorPick.pickedPoint.y + 0.005
            : 0.005;

        this.spawnGoreDisc(pos.x, floorY, pos.z, GORE_DISC_MIN_SCALE + Math.random() * GORE_DISC_SCALE_RANGE, 0.9);

        const bitsCount = MIN_GORE_BITS + Math.floor(Math.random() * (MAX_GORE_BITS - MIN_GORE_BITS + 1));
        for (let i = 0; i < bitsCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 0.2 + Math.random() * 0.4;
            this.spawnGoreDisc(
                pos.x + Math.cos(angle) * dist,
                floorY,
                pos.z + Math.sin(angle) * dist,
                0.05 + Math.random() * 0.12,
                0.8
            );
        }
    }

    private spawnGoreDisc(x: number, y: number, z: number, scale: number, vis: number) {
        const idx = this.goreDiscCursor % MAX_FLOOR_GORE;
        this.goreDiscCursor++;
        const disc = this.goreDiscPool[idx];

        disc.setEnabled(true);
        disc.position.set(x, y, z);
        disc.scaling.setAll(scale);
        disc.rotation.y = Math.random() * Math.PI * 2;
        disc.visibility = vis;

        this.activeGoreDiscs.push({
            mesh: disc,
            startTime: Date.now(),
            startVis: vis
        });
    }

    public getFloorGoreMaterial(): BABYLON.Material | undefined {
        return this.resourceManager.getMaterial("floorGoreMat", () => {
            const m = new BABYLON.StandardMaterial("floorGoreMat", this.scene);
            m.diffuseColor = new BABYLON.Color3(0.42, 0.0, 0.0);
            m.specularColor = new BABYLON.Color3(0.02, 0, 0);
            m.emissiveColor = new BABYLON.Color3(0.04, 0, 0);
            m.backFaceCulling = false;
            return m;
        });
    }

    /** Between-round/between-game cleanup — manager stays alive, observer keeps running. */
    public reset() {
        this.floorGorePieces.forEach(m => { if (!m.isDisposed()) m.dispose(); });
        this.floorGorePieces = [];

        this.bloodPool.forEach(b => {
            b.mesh.setEnabled(false);
            if (b.material) b.material.alpha = 0.9;
        });

        // Hide all gore discs and clear the active fade list
        for (const disc of this.goreDiscPool) {
            disc.setEnabled(false);
        }
        this.activeGoreDiscs.length = 0;
        this.goreDiscCursor = 0;
    }

    /** Full teardown — manager is destroyed, all GPU resources and observers released. */
    public dispose() {
        for (const item of this.bloodPool) {
            if (item.observer) {
                this.scene.onBeforeRenderObservable.remove(item.observer);
                item.observer = null;
            }
            if (item.mesh && !item.mesh.isDisposed()) item.mesh.dispose();
            if (item.material) item.material.dispose();
        }
        this.bloodPool = [];

        if (this.goreFadeObserver) {
            this.scene.onBeforeRenderObservable.remove(this.goreFadeObserver);
            this.goreFadeObserver = null;
        }

        this.floorGorePieces.forEach(m => { if (!m.isDisposed()) m.dispose(); });
        this.floorGorePieces = [];
    }
}
