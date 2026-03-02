import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from './ResourceManager';
import { VISUAL_CONFIG } from '../config';

interface PooledSplatter {
    mesh: BABYLON.Mesh;
    material: BABYLON.StandardMaterial;
    observer: BABYLON.Observer<BABYLON.Scene> | null;
}


export class VisualManager {
    private bloodPool: PooledSplatter[] = [];
    private poolSize = VISUAL_CONFIG.BLOOD_POOL_SIZE;
    private poolCursor = 0;
    
    // Decal State
    private decalMat: BABYLON.StandardMaterial | null = null;
    private activeDecals: BABYLON.AbstractMesh[] = [];
    private MAX_DECALS = 40;

    public lights: BABYLON.PointLight[] = [];

    // Zombie Residue (kept for compatibility; no longer stores cube chunks)
    private zombieResidue: { meshes: BABYLON.AbstractMesh[], timestamp: number }[] = [];

    // Floor gore pools (blood pools + scattered flesh bits that persist on the floor)
    private floorGorePieces: BABYLON.Mesh[] = [];
    private static readonly MAX_FLOOR_GORE = 60;

    // ── Explosion flash light pool ──────────────────────────────────────────
    // Pre-allocated pool avoids creating/disposing PointLights every shot
    // which would push the scene past the per-shader light limit.
    private static readonly MAX_FLASH_LIGHTS = 2;
    private flashLightPool: BABYLON.PointLight[] = [];
    private flashLightCursor = 0;
    private flashLightFadeStart: number[] = [];
    private flashLightFadeObserver: BABYLON.Observer<BABYLON.Scene> | null = null;

    // ── Pre-allocated plasma explosion particle system pool ─────────────────
    // Instead of new ParticleSystem() per explosion, we recycle a small pool.
    private static readonly MAX_EXPLOSION_PS = 3;
    private explosionPSPool: BABYLON.ParticleSystem[] = [];
    private explosionPSCursor = 0;

    // ── Shared scratch objects (zero-alloc hot path) ────────────────────────
    private static readonly _scratchColor3 = new BABYLON.Color3();
    private static readonly _explosionDirMin = new BABYLON.Vector3(-1, 1, -1);
    private static readonly _explosionDirMax = new BABYLON.Vector3(1, 1, 1);
    private static readonly _explosionGravity = new BABYLON.Vector3(0, -2, 0);

    constructor(private scene: BABYLON.Scene, private resourceManager: ResourceManager) {
        this.initBloodPool();
        this.initFlashLightPool();
        this.initExplosionPSPool();
    }

    private initFlashLightPool() {
        for (let i = 0; i < VisualManager.MAX_FLASH_LIGHTS; i++) {
            const light = new BABYLON.PointLight(`explosionFlash_${i}`, BABYLON.Vector3.Zero(), this.scene);
            light.intensity = 0;
            light.range = 15;
            // Keep lights ALWAYS enabled so they're included in shader compilation
            // from the start. Toggling setEnabled causes Babylon to recompile every
            // material's shader (active light count changes), which causes visible
            // flicker on the first few shots. We control visibility via intensity only.
            this.flashLightPool.push(light);
            this.flashLightFadeStart.push(0);
        }
        // Single render observer drives all flash light fades
        this.flashLightFadeObserver = this.scene.onBeforeRenderObservable.add(() => {
            const now = Date.now();
            for (let i = 0; i < this.flashLightPool.length; i++) {
                const start = this.flashLightFadeStart[i];
                if (start === 0) continue; // inactive
                const t = (now - start) / 200;
                if (t >= 1) {
                    this.flashLightPool[i].intensity = 0;
                    this.flashLightFadeStart[i] = 0;
                } else {
                    this.flashLightPool[i].intensity = 5 * (1 - t);
                }
            }
        });
    }

    private acquireFlashLight(pos: BABYLON.Vector3, r: number, g: number, b: number): void {
        const idx = this.flashLightCursor % VisualManager.MAX_FLASH_LIGHTS;
        this.flashLightCursor++;
        const light = this.flashLightPool[idx];
        light.position.copyFrom(pos);
        light.diffuse.r = r;
        light.diffuse.g = g;
        light.diffuse.b = b;
        light.intensity = 5;
        this.flashLightFadeStart[idx] = Date.now();
    }

    private initExplosionPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_EXPLOSION_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`plasmaExplosion_${i}`, 80, this.scene);
            ps.particleTexture = tex;
            ps.minSize = 0.5;
            ps.maxSize = 2.0;
            ps.minLifeTime = 0.2;
            ps.maxLifeTime = 0.5;
            ps.emitRate = 500;
            ps.targetStopDuration = 0.1;
            ps.createSphereEmitter(0.5);
            ps.direction1 = VisualManager._explosionDirMin;
            ps.direction2 = VisualManager._explosionDirMax;
            ps.minEmitPower = 10;
            ps.maxEmitPower = 20;
            ps.gravity = VisualManager._explosionGravity;
            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
            // Don't auto-dispose — we recycle these
            ps.disposeOnStop = false;
            this.explosionPSPool.push(ps);
        }
    }

    /**
     * Safely configure a one-shot particle system so it auto-disposes after
     * all particles die, WITHOUT destroying the shared particleTexture.
     *
     * Babylon's default `disposeOnStop` calls `dispose(disposeTexture=true)`
     * which destroys the texture — fatal when the texture is shared/cached
     * via ResourceManager. Instead we use `onAnimationEnd` to manually call
     * `dispose(false)` which skips texture disposal.
     */
    private setupSafeAutoDispose(ps: BABYLON.ParticleSystem): void {
        ps.disposeOnStop = false;
        ps.onAnimationEnd = () => {
            ps.dispose(false);
        };
    }

    /**
     * Creates flat blood pool discs + scattered flesh bits on the floor at the given position.
     * These persist for ~30 seconds before fading out, giving the impression of body remains.
     */
    private createFloorGore(pos: BABYLON.Vector3): void {
        // Find actual floor Y via downward ray
        const floorRay = new BABYLON.Ray(
            new BABYLON.Vector3(pos.x, pos.y + 0.5, pos.z),
            new BABYLON.Vector3(0, -1, 0),
            10
        );
        const floorPick = this.scene.pickWithRay(floorRay, (m) => m.checkCollisions && m.isEnabled());
        const floorY = (floorPick && floorPick.hit && floorPick.pickedPoint)
            ? floorPick.pickedPoint.y + 0.005
            : 0.005;

        // Shared material for all floor gore (transparency controlled per-mesh via visibility)
        const mat = this.resourceManager.getMaterial("floorGoreMat", () => {
            const m = new BABYLON.StandardMaterial("floorGoreMat", this.scene);
            m.diffuseColor = new BABYLON.Color3(0.42, 0.0, 0.0);
            m.specularColor = new BABYLON.Color3(0.02, 0, 0);
            m.emissiveColor = new BABYLON.Color3(0.04, 0, 0);
            m.backFaceCulling = false;
            return m;
        });

        const pieces: BABYLON.Mesh[] = [];

        // Main blood pool disc
        const poolRadius = 0.4 + Math.random() * 0.45;
        const pool = BABYLON.MeshBuilder.CreateDisc("gorePool", {
            radius: poolRadius,
            tessellation: 14
        }, this.scene);
        pool.material = mat;
        pool.position.set(
            pos.x + (Math.random() - 0.5) * 0.2,
            floorY,
            pos.z + (Math.random() - 0.5) * 0.2
        );
        pool.rotation.x = Math.PI / 2;
        pool.rotation.y = Math.random() * Math.PI * 2;
        pool.isPickable = false;
        pool.visibility = 0.9;
        pieces.push(pool);

        // Scattered gore bits — irregular low-tessellation discs look like flesh chunks
        const bitsCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bitsCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 0.15 + Math.random() * poolRadius * 1.1;
            const bitRadius = 0.05 + Math.random() * 0.12;
            const bit = BABYLON.MeshBuilder.CreateDisc("goreBit_" + i, {
                radius: bitRadius,
                tessellation: 4 + Math.floor(Math.random() * 4) // 4-7 sides → irregular blobs
            }, this.scene);
            bit.material = mat;
            bit.position.set(
                pos.x + Math.cos(angle) * dist,
                floorY,
                pos.z + Math.sin(angle) * dist
            );
            bit.rotation.x = Math.PI / 2;
            bit.rotation.y = Math.random() * Math.PI * 2;
            bit.isPickable = false;
            bit.visibility = 0.85;
            pieces.push(bit);
        }

        // Register pieces for cap-based cleanup
        this.floorGorePieces.push(...pieces);
        while (this.floorGorePieces.length > VisualManager.MAX_FLOOR_GORE) {
            const old = this.floorGorePieces.shift();
            if (old && !old.isDisposed()) old.dispose();
        }

        // Self-contained 30-second fade-out
        const FADE_MS = 30000;
        const startTime = Date.now();
        const startVisibilities = pieces.map(p => p.visibility);
        const fadeObserver = this.scene.onBeforeRenderObservable.add(() => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= FADE_MS) {
                this.scene.onBeforeRenderObservable.remove(fadeObserver);
                pieces.forEach(p => { if (!p.isDisposed()) p.dispose(); });
                return;
            }
            const t = elapsed / FADE_MS;
            pieces.forEach((p, idx) => {
                if (!p.isDisposed()) p.visibility = startVisibilities[idx] * (1 - t);
            });
        });
    }

    /**
     * Full body-death explosion: directional blood burst, gore mist, heavy chunk arc,
     * and a persistent blood pool + gore pile on the floor.
     * @param hitDir The direction the killing projectile was traveling (optional).
     */
    public createZombieExplosion(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        const flare = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        // Emit from body center
        const origin = new BABYLON.Vector3(pos.x, pos.y + 0.8, pos.z);

        // Blood blasts in the direction opposite to bullet travel.
        // If no direction given, default to a mild upward bias.
        const bx = hitDir ? -hitDir.x : 0;
        const by = hitDir ? Math.max(-hitDir.y + 0.8, 0.5) : 1.0;
        const bz = hitDir ? -hitDir.z : 0;

        // ── 1. Large directional blood burst ────────────────────────────────
        const burst = new BABYLON.ParticleSystem("zombieBurst", 60, this.scene);
        burst.particleTexture = flare;
        burst.emitter = origin;
        burst.color1 = new BABYLON.Color4(0.9, 0.02, 0.02, 1);
        burst.color2 = new BABYLON.Color4(0.6, 0.0, 0.0, 1);
        burst.colorDead = new BABYLON.Color4(0.15, 0, 0, 0);
        burst.minSize = 0.04; burst.maxSize = 0.18;
        burst.minLifeTime = 0.25; burst.maxLifeTime = 0.65;
        burst.emitRate = 900;
        burst.targetStopDuration = 0.07;
        burst.createSphereEmitter(0.15);
        burst.direction1 = new BABYLON.Vector3(bx - 0.9, by - 0.3, bz - 0.9);
        burst.direction2 = new BABYLON.Vector3(bx + 0.9, by + 1.2, bz + 0.9);
        burst.minEmitPower = 7; burst.maxEmitPower = 15;
        burst.gravity = new BABYLON.Vector3(0, -9.8, 0);
        burst.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.setupSafeAutoDispose(burst);
        burst.start();

        // ── 2. Fine blood mist (omnidirectional haze) ───────────────────────
        const mist = new BABYLON.ParticleSystem("zombieMist", 25, this.scene);
        mist.particleTexture = flare;
        mist.emitter = origin;
        mist.color1 = new BABYLON.Color4(0.75, 0.0, 0.0, 0.9);
        mist.color2 = new BABYLON.Color4(0.4, 0.0, 0.0, 0.6);
        mist.colorDead = new BABYLON.Color4(0.1, 0, 0, 0);
        mist.minSize = 0.02; mist.maxSize = 0.07;
        mist.minLifeTime = 0.4; mist.maxLifeTime = 1.0;
        mist.emitRate = 350;
        mist.targetStopDuration = 0.07;
        mist.createSphereEmitter(0.25);
        mist.direction1 = new BABYLON.Vector3(-1, 0.5, -1);
        mist.direction2 = new BABYLON.Vector3(1, 2.5, 1);
        mist.minEmitPower = 2; mist.maxEmitPower = 5;
        mist.gravity = new BABYLON.Vector3(0, -5, 0);
        mist.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.setupSafeAutoDispose(mist);
        mist.start();

        // ── 3. Heavy gore chunks (large particles that arc and splat) ────────
        const chunks = new BABYLON.ParticleSystem("zombieChunks", 10, this.scene);
        chunks.particleTexture = flare;
        chunks.emitter = origin;
        chunks.color1 = new BABYLON.Color4(0.45, 0.05, 0.04, 1);
        chunks.color2 = new BABYLON.Color4(0.28, 0.03, 0.02, 1);
        chunks.colorDead = new BABYLON.Color4(0.18, 0.02, 0.01, 0.4);
        chunks.minSize = 0.12; chunks.maxSize = 0.28;
        chunks.minLifeTime = 0.6; chunks.maxLifeTime = 1.5;
        chunks.emitRate = 160;
        chunks.targetStopDuration = 0.06;
        chunks.createSphereEmitter(0.2);
        chunks.direction1 = new BABYLON.Vector3(bx - 1.5, by + 0.5, bz - 1.5);
        chunks.direction2 = new BABYLON.Vector3(bx + 1.5, by + 3.0, bz + 1.5);
        chunks.minEmitPower = 5; chunks.maxEmitPower = 11;
        chunks.gravity = new BABYLON.Vector3(0, -15, 0);
        chunks.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.setupSafeAutoDispose(chunks);
        chunks.start();

        // ── 4. Persistent floor blood pool + gore pile ───────────────────────
        this.createFloorGore(pos);
    }

    /**
     * Headshot explosion: intense upward burst, brain-matter chunks, fine mist,
     * and a floor blood pool.
     * @param hitDir The direction the killing projectile was traveling (optional).
     */
    public createHeadExplosion(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        const flare = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        const origin = new BABYLON.Vector3(pos.x, pos.y, pos.z);

        // Headshots have a strong upward bias
        const bx = hitDir ? -hitDir.x : 0;
        const by = hitDir ? Math.max(-hitDir.y + 1.2, 1.0) : 1.5;
        const bz = hitDir ? -hitDir.z : 0;

        // ── 1. Primary head burst (upward + directional) ─────────────────────
        const burst = new BABYLON.ParticleSystem("headBurst", 50, this.scene);
        burst.particleTexture = flare;
        burst.emitter = origin;
        burst.color1 = new BABYLON.Color4(0.95, 0.02, 0.02, 1);
        burst.color2 = new BABYLON.Color4(0.65, 0.0, 0.0, 1);
        burst.colorDead = new BABYLON.Color4(0.12, 0, 0, 0);
        burst.minSize = 0.03; burst.maxSize = 0.14;
        burst.minLifeTime = 0.25; burst.maxLifeTime = 0.6;
        burst.emitRate = 800;
        burst.targetStopDuration = 0.06;
        burst.createSphereEmitter(0.12);
        burst.direction1 = new BABYLON.Vector3(bx - 0.7, by, bz - 0.7);
        burst.direction2 = new BABYLON.Vector3(bx + 0.7, by + 1.5, bz + 0.7);
        burst.minEmitPower = 8; burst.maxEmitPower = 18;
        burst.gravity = new BABYLON.Vector3(0, -9.8, 0);
        burst.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.setupSafeAutoDispose(burst);
        burst.start();

        // ── 2. Dark brain-matter chunks ───────────────────────────────────────
        const brain = new BABYLON.ParticleSystem("headBrain", 8, this.scene);
        brain.particleTexture = flare;
        brain.emitter = origin;
        brain.color1 = new BABYLON.Color4(0.5, 0.05, 0.05, 1);
        brain.color2 = new BABYLON.Color4(0.32, 0.02, 0.02, 1);
        brain.colorDead = new BABYLON.Color4(0.18, 0.01, 0.01, 0.3);
        brain.minSize = 0.08; brain.maxSize = 0.2;
        brain.minLifeTime = 0.5; brain.maxLifeTime = 1.2;
        brain.emitRate = 140;
        brain.targetStopDuration = 0.06;
        brain.createSphereEmitter(0.1);
        brain.direction1 = new BABYLON.Vector3(bx - 2, by + 0.5, bz - 2);
        brain.direction2 = new BABYLON.Vector3(bx + 2, by + 4, bz + 2);
        brain.minEmitPower = 5; brain.maxEmitPower = 13;
        brain.gravity = new BABYLON.Vector3(0, -14, 0);
        brain.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.setupSafeAutoDispose(brain);
        brain.start();

        // ── 3. Fine blood mist ────────────────────────────────────────────────
        const mist = new BABYLON.ParticleSystem("headMist", 20, this.scene);
        mist.particleTexture = flare;
        mist.emitter = origin;
        mist.color1 = new BABYLON.Color4(0.8, 0.0, 0.0, 0.85);
        mist.color2 = new BABYLON.Color4(0.45, 0.0, 0.0, 0.55);
        mist.colorDead = new BABYLON.Color4(0.1, 0, 0, 0);
        mist.minSize = 0.015; mist.maxSize = 0.055;
        mist.minLifeTime = 0.35; mist.maxLifeTime = 0.9;
        mist.emitRate = 300;
        mist.targetStopDuration = 0.07;
        mist.createSphereEmitter(0.18);
        mist.direction1 = new BABYLON.Vector3(-1.2, 1.0, -1.2);
        mist.direction2 = new BABYLON.Vector3(1.2, 3.5, 1.2);
        mist.minEmitPower = 3; mist.maxEmitPower = 8;
        mist.gravity = new BABYLON.Vector3(0, -6, 0);
        mist.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.setupSafeAutoDispose(mist);
        mist.start();

        // ── 4. Floor blood pool ───────────────────────────────────────────────
        this.createFloorGore(pos);
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

    /**
     * Pre-loads all shared materials and textures used by the VisualManager.
     * Called during level load to prevent runtime hitches.
     */
    public async preWarmAssets() {
        // 1. Pre-warm textures
        const textures = [
            "https://playground.babylonjs.com/textures/flare.png",
            "https://playground.babylonjs.com/textures/impact.png",
            "https://playground.babylonjs.com/textures/wood.jpg"
        ];
        await Promise.all(textures.map(t => this.resourceManager.preWarmTexture(t)));

        // 2. Initialize Shared Materials
        this.initDecalMaterial();
        
        // 3. Pre-compile materials (Optional but recommended for StandardMaterial)
        if (this.decalMat) this.decalMat.forceCompilation(this.activeDecals[0] || this.scene.meshes[0]);
    }

    public setLights(lights: BABYLON.PointLight[]) {
        this.lights = lights;
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

        // Fade out and dispose after 10s
        setTimeout(() => {
            if (decal && !decal.isDisposed()) {
                // For performance we just dispose, but could lerp alpha if decal had unique mat
                const idx = this.activeDecals.indexOf(decal);
                if (idx !== -1) this.activeDecals.splice(idx, 1);
                decal.dispose();
            }
        }, 10000);
    }

    public createImpactParticles(pos: BABYLON.Vector3, normal: BABYLON.Vector3) {
        const ps = new BABYLON.ParticleSystem("impact", 10, this.scene);
        ps.particleTexture = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        ps.emitter = pos;
        ps.color1 = new BABYLON.Color4(1, 1, 0.8, 1);
        ps.color2 = new BABYLON.Color4(0.5, 0.5, 0.4, 0.5);
        ps.minSize = 0.01; ps.maxSize = 0.05;
        ps.minLifeTime = 0.05; ps.maxLifeTime = 0.15;
        ps.emitRate = 100;
        ps.targetStopDuration = 0.05;
        ps.createPointEmitter(new BABYLON.Vector3(0.05, 0.05, 0.05), new BABYLON.Vector3(-0.05, -0.05, -0.05));
        ps.direction1 = normal.scale(1.5).add(new BABYLON.Vector3(0.2, 0.2, 0.2));
        ps.direction2 = normal.scale(1.5).add(new BABYLON.Vector3(-0.2, -0.2, -0.2));
        ps.minEmitPower = 1; ps.maxEmitPower = 2;
        ps.gravity = new BABYLON.Vector3(0, -9.8, 0);
        this.setupSafeAutoDispose(ps);
        ps.start();
    }

    private initBloodPool() {
        for (let i = 0; i < this.poolSize; i++) {
            const plane = BABYLON.MeshBuilder.CreatePlane("blood_" + i, {size: VISUAL_CONFIG.BLOOD_PLANE_SIZE}, this.scene);
            plane.setEnabled(false);
            
            const mat = new BABYLON.StandardMaterial("bloodMat_" + i, this.scene);
            mat.diffuseColor = new BABYLON.Color3(0.8, 0, 0); 
            mat.specularColor = new BABYLON.Color3(0.1, 0, 0); 
            mat.emissiveColor = new BABYLON.Color3(0.2, 0, 0);
            mat.alpha = VISUAL_CONFIG.BLOOD_INITIAL_ALPHA;
            mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            plane.material = mat;

            this.bloodPool.push({
                mesh: plane,
                material: mat,
                observer: null
            });
        }
    }

    public createBloodSplatter(pos: BABYLON.Vector3, normal: BABYLON.Vector3, targetMesh?: BABYLON.AbstractMesh) {
        const scene = this.scene;

        // Create blood spray particles
        const ps = new BABYLON.ParticleSystem("bloodPS", 20, scene);
        ps.particleTexture = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        ps.emitter = pos;
        ps.color1 = new BABYLON.Color4(0.7, 0, 0, 1);
        ps.color2 = new BABYLON.Color4(0.3, 0, 0, 1);
        ps.colorDead = new BABYLON.Color4(0.1, 0, 0, 0);
        ps.minSize = 0.05; ps.maxSize = 0.15;
        ps.minLifeTime = 0.2; ps.maxLifeTime = 0.4;
        ps.emitRate = 100;
        ps.targetStopDuration = 0.1;
        ps.createPointEmitter(new BABYLON.Vector3(0.1, 0.1, 0.1), new BABYLON.Vector3(-0.1, -0.1, -0.1));
        ps.direction1 = normal.scale(2).add(new BABYLON.Vector3(0.5, 0.5, 0.5));
        ps.direction2 = normal.scale(2).add(new BABYLON.Vector3(-0.5, -0.5, -0.5));
        ps.minEmitPower = 1; ps.maxEmitPower = 3;
        ps.gravity = new BABYLON.Vector3(0, -5, 0);
        ps.targetStopDuration = 0.1;
        this.setupSafeAutoDispose(ps);
        ps.start();

        // Create blood decal on the zombie body where hit
        if (targetMesh) {
            this.createBloodDecalOnMesh(pos, normal, targetMesh);
        }

        // Try to find floor for blood pool
        const floorRay = new BABYLON.Ray(pos.add(new BABYLON.Vector3(0, 0.1, 0)), new BABYLON.Vector3(0, -1, 0), 10);
        const floorPick = scene.pickWithRay(floorRay, (m) => m.checkCollisions && m.isEnabled());
        if (floorPick && floorPick.hit && floorPick.pickedPoint && floorPick.pickedMesh) {
            this.createBloodDecalOnMesh(floorPick.pickedPoint, new BABYLON.Vector3(0, 1, 0), floorPick.pickedMesh);
        }
    }

    private createBloodDecalOnMesh(pos: BABYLON.Vector3, normal: BABYLON.Vector3, target: BABYLON.AbstractMesh) {
        const scene = this.scene;
        
        // Create a blood decal using Babylon's CreateDecal
        const size = new BABYLON.Vector3(0.15, 0.15, 0.15);
        const decal = BABYLON.MeshBuilder.CreateDecal("bloodDecal", target, {
            position: pos,
            normal: normal,
            size: size,
            angle: Math.random() * Math.PI
        });

        // Create blood material if not exists
        let bloodMat = this.resourceManager.getMaterial("bloodDecalMat", () => {
            const mat = new BABYLON.StandardMaterial("bloodDecalMat", scene);
            mat.diffuseColor = new BABYLON.Color3(0.6, 0, 0);
            mat.specularColor = BABYLON.Color3.Black();
            mat.zOffset = -1;
            return mat;
        });

        decal.material = bloodMat;
        decal.isPickable = false;
        decal.setParent(target);

        // Fade out after 5 seconds
        setTimeout(() => {
            if (decal && !decal.isDisposed()) {
                decal.dispose();
            }
        }, 5000);
    }

    public createSpawnEffect(pos: BABYLON.Vector3) {
        const ps = new BABYLON.ParticleSystem("spawnSmoke", 50, this.scene);
        ps.particleTexture = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        ps.emitter = pos; 
        ps.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 1); 
        ps.color2 = new BABYLON.Color4(0, 0, 0, 0);
        ps.minSize = 0.5; ps.maxSize = 1.0; 
        ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0; 
        ps.emitRate = 100; 
        ps.targetStopDuration = 0.5; 
        this.setupSafeAutoDispose(ps);
        ps.start();
    }

    public createSpawnSmokeEffect(pos: BABYLON.Vector3): BABYLON.ParticleSystem {
        const ps = new BABYLON.ParticleSystem("hellhoundSpawnSmoke", 100, this.scene);
        ps.particleTexture = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        ps.emitter = pos;
        
        // Dark, ominous smoke colors
        ps.color1 = new BABYLON.Color4(0.1, 0.1, 0.15, 1);
        ps.color2 = new BABYLON.Color4(0.3, 0.2, 0.4, 0.8);
        ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
        
        ps.minSize = 0.8;
        ps.maxSize = 2.0;
        ps.minLifeTime = 0.8;
        ps.maxLifeTime = 1.5;
        ps.emitRate = 80;
        
        ps.minEmitBox = new BABYLON.Vector3(-0.5, -0.2, -0.5);
        ps.maxEmitBox = new BABYLON.Vector3(0.5, 0.5, 0.5);
        
        ps.direction1 = new BABYLON.Vector3(-1, 2, -1);
        ps.direction2 = new BABYLON.Vector3(1, 3, 1);
        
        ps.minEmitPower = 0.5;
        ps.maxEmitPower = 1.5;
        ps.gravity = new BABYLON.Vector3(0, -0.5, 0);
        
        ps.minAngularSpeed = -Math.PI;
        ps.maxAngularSpeed = Math.PI;
        
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        
        return ps;
    }

    // Pre-computed color constants for plasma explosions (avoid per-call allocations)
    private static readonly _colorNormal   = new BABYLON.Color4(1, 0.4, 0, 1);
    private static readonly _colorNormal2  = new BABYLON.Color4(0.5, 0.2, 0, 1);
    private static readonly _colorPacked   = new BABYLON.Color4(0.6, 0.1, 1, 1);
    private static readonly _colorPacked2  = new BABYLON.Color4(0.3, 0.05, 0.5, 1);
    private static readonly _colorDead     = new BABYLON.Color4(0, 0, 0, 0);

    public createPlasmaExplosion(pos: BABYLON.Vector3, isPacked: boolean = false) {
        // Recycle from the pre-allocated pool (round-robin)
        const idx = this.explosionPSCursor % VisualManager.MAX_EXPLOSION_PS;
        this.explosionPSCursor++;
        const ps = this.explosionPSPool[idx];

        // If still running from a previous explosion, force-stop then restart
        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }

        // Reposition emitter — use a clone since the caller's pos may be transient
        ps.emitter = pos;

        // Set colors without allocating new Color4 objects
        if (isPacked) {
            ps.color1 = VisualManager._colorPacked;
            ps.color2 = VisualManager._colorPacked2;
        } else {
            ps.color1 = VisualManager._colorNormal;
            ps.color2 = VisualManager._colorNormal2;
        }
        ps.colorDead = VisualManager._colorDead;

        ps.start();

        // Reuse a pooled flash light
        const c = isPacked ? VisualManager._colorPacked : VisualManager._colorNormal;
        this.acquireFlashLight(pos, c.r, c.g, c.b);
    }

    // Pre-computed trail colors & directions
    private static readonly _trailColorNormal  = new BABYLON.Color4(1, 0.4, 0, 1);
    private static readonly _trailColorNormal2 = new BABYLON.Color4(0.8, 0.32, 0, 1);
    private static readonly _trailColorPacked  = new BABYLON.Color4(0.6, 0.1, 1, 1);
    private static readonly _trailColorPacked2 = new BABYLON.Color4(0.48, 0.08, 0.8, 1);
    private static readonly _trailDir = new BABYLON.Vector3(0, 0, -1);

    public createProjectileTrail(mesh: BABYLON.AbstractMesh, isPacked: boolean = false): BABYLON.ParticleSystem {
        const ps = new BABYLON.ParticleSystem("projectileTrail", 100, this.scene);
        ps.particleTexture = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        ps.emitter = mesh;

        if (isPacked) {
            ps.color1 = VisualManager._trailColorPacked;
            ps.color2 = VisualManager._trailColorPacked2;
        } else {
            ps.color1 = VisualManager._trailColorNormal;
            ps.color2 = VisualManager._trailColorNormal2;
        }
        ps.colorDead = VisualManager._colorDead;

        ps.minSize = 0.1;
        ps.maxSize = 0.4;
        ps.minLifeTime = 0.05;
        ps.maxLifeTime = 0.2;

        ps.emitRate = 150;
        ps.createPointEmitter(VisualManager._trailDir, VisualManager._trailDir);

        ps.minEmitPower = 1;
        ps.maxEmitPower = 2;
        ps.updateSpeed = 0.02;

        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        ps.start();

        return ps;
    }

    public reset() {
        this.activeDecals.forEach(d => d.dispose());
        this.activeDecals = [];

        this.zombieResidue.forEach(r => r.meshes.forEach(m => m.dispose()));
        this.zombieResidue = [];

        this.floorGorePieces.forEach(m => { if (!m.isDisposed()) m.dispose(); });
        this.floorGorePieces = [];
        
        this.flashLightPool.forEach(l => l.intensity = 0);
        this.flashLightFadeStart.fill(0);
        
        this.explosionPSPool.forEach(ps => { 
            if (ps.isStarted()) ps.stop(); 
            ps.reset(); 
        });
        
        this.bloodPool.forEach(b => { 
            b.mesh.setEnabled(false); 
            if (b.material) b.material.alpha = VISUAL_CONFIG.BLOOD_INITIAL_ALPHA; 
        });
        
        this.lights = [];
    }

    public dispose() {
        for (const item of this.bloodPool) {
            if (item.observer) {
                this.scene.onBeforeRenderObservable.remove(item.observer);
                item.observer = null;
            }
            item.mesh.dispose();
            item.material.dispose();
        }
        this.activeDecals.forEach(d => d.dispose());
        this.activeDecals = [];
        if (this.decalMat) this.decalMat.dispose();

        // Dispose flash light pool
        if (this.flashLightFadeObserver) {
            this.scene.onBeforeRenderObservable.remove(this.flashLightFadeObserver);
            this.flashLightFadeObserver = null;
        }
        for (let i = 0; i < this.flashLightPool.length; i++) {
            this.flashLightPool[i].dispose();
        }
        this.flashLightPool = [];
        this.flashLightFadeStart = [];

        // Dispose explosion PS pool
        for (const ps of this.explosionPSPool) {
            ps.dispose(false);
        }
        this.explosionPSPool = [];

        this.floorGorePieces.forEach(m => { if (!m.isDisposed()) m.dispose(); });
        this.floorGorePieces = [];

        this.bloodPool = [];
        this.lights = [];
    }
}
