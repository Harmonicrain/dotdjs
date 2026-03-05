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

    // Blood decals are created at a much higher rate (up to 2 per bullet hit)
    // so they get their own capped ring-buffer to avoid unbounded mesh growth.
    private activeBloodDecals: BABYLON.AbstractMesh[] = [];
    private static readonly MAX_BLOOD_DECALS = 60;

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

    // ── Pre-allocated trail particle system pool (Ray Gun etc) ───────────────
    private static readonly MAX_TRAIL_PS = 20;
    private trailPSPool: BABYLON.ParticleSystem[] = [];
    private trailPSCursor = 0;

    // ── Pre-allocated impact particle system pool ────────────────────────────
    private static readonly MAX_IMPACT_PS = 15;
    private impactPSPool: BABYLON.ParticleSystem[] = [];
    private impactPSCursor = 0;

    // ── Pre-allocated blood splatter particle system pool ────────────────────
    private static readonly MAX_BLOOD_PS = 15;
    private bloodPSPool: BABYLON.ParticleSystem[] = [];
    private bloodPSCursor = 0;

    // ── Pre-allocated wood debris particle system pool ───────────────────────
    private static readonly MAX_DEBRIS_PS = 10;
    private debrisPSPool: BABYLON.ParticleSystem[] = [];
    private debrisPSCursor = 0;

    // ── Pre-allocated zombie explosion pool (Burst, Mist, Chunks) ────────────
    private static readonly MAX_ZOMBIE_EXPLOSIONS = 5;
    private burstPSPool: BABYLON.ParticleSystem[] = [];
    private mistPSPool: BABYLON.ParticleSystem[] = [];
    private chunksPSPool: BABYLON.ParticleSystem[] = [];
    private zombieExplosionCursor = 0;

    // ── Pre-allocated head explosion pool (Brain matter) ─────────────────────
    private static readonly MAX_HEAD_EXPLOSIONS = 5;
    private brainPSPool: BABYLON.ParticleSystem[] = [];
    private headExplosionCursor = 0;

    // ── Pre-allocated hound explosion pool ───────────────────────────────────
    private static readonly MAX_HOUND_EXPLOSIONS = 3;
    private houndExplosionPSPool: BABYLON.ParticleSystem[] = [];
    private houndExplosionCursor = 0;

    // ── Pre-allocated zombie spawn smoke pool ────────────────────────────────
    private static readonly MAX_SPAWN_EFFECT_PS = 6;
    private spawnEffectPSPool: BABYLON.ParticleSystem[] = [];
    private spawnEffectCursor = 0;

    // ── Pre-allocated hellhound spawn smoke pool ─────────────────────────────
    private static readonly MAX_SPAWN_SMOKE_PS = 4;
    private spawnSmokePSPool: BABYLON.ParticleSystem[] = [];
    private spawnSmokeCursor = 0;

    // ── Floor gore mesh pool (Discs) ─────────────────────────────────────────
    private static readonly MAX_GORE_DISCS = 60;
    private goreDiscPool: BABYLON.Mesh[] = [];
    private goreDiscCursor = 0;
    private activeGoreDiscs: { mesh: BABYLON.Mesh, startTime: number, startVis: number }[] = [];

    // ── Shared scratch objects (zero-alloc hot path) ────────────────────────
    private static readonly _scratchColor3 = new BABYLON.Color3();

    private static readonly _explosionDirMin = new BABYLON.Vector3(-1, 1, -1);
    private static readonly _explosionDirMax = new BABYLON.Vector3(1, 1, 1);
    private static readonly _explosionGravity = new BABYLON.Vector3(0, -2, 0);
    private static readonly _impactDirMin = new BABYLON.Vector3(0.05, 0.05, 0.05);
    private static readonly _impactDirMax = new BABYLON.Vector3(-0.05, -0.05, -0.05);
    private static readonly _bloodDirMin = new BABYLON.Vector3(0.1, 0.1, 0.1);
    private static readonly _bloodDirMax = new BABYLON.Vector3(-0.1, -0.1, -0.1);
    private static readonly _debrisMinBox = new BABYLON.Vector3(-0.5, -0.2, -0.1);
    private static readonly _debrisMaxBox = new BABYLON.Vector3(0.5, 0.2, 0.1);
    // Scratch vectors for per-call direction computation — avoids allocations in
    // createImpactParticles, createBloodSplatter, createZombieExplosion, createHeadExplosion
    private static readonly _scratchDir1 = new BABYLON.Vector3();
    private static readonly _scratchDir2 = new BABYLON.Vector3();
    private static readonly _scratchOrigin = new BABYLON.Vector3();

    constructor(private scene: BABYLON.Scene, private resourceManager: ResourceManager) {
        this.initBloodPool();
        this.initFlashLightPool();
        this.initExplosionPSPool();
        this.initTrailPSPool();
        this.initImpactPSPool();
        this.initBloodPSPool();
        this.initDebrisPSPool();
        this.initZombieExplosionPool();
        this.initHeadExplosionPool();
        this.initHoundExplosionPool();
        this.initGoreDiscPool();
        this.initGoreFadeObserver();
        this.initSpawnEffectPool();
        this.initSpawnSmokePool();
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

    private initTrailPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_TRAIL_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`trailPS_${i}`, 100, this.scene);
            ps.particleTexture = tex;
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
            ps.disposeOnStop = false;
            this.trailPSPool.push(ps);
        }
    }

    private initImpactPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_IMPACT_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`impactPS_${i}`, 10, this.scene);
            ps.particleTexture = tex;
            ps.color1 = new BABYLON.Color4(1, 1, 0.8, 1);
            ps.color2 = new BABYLON.Color4(0.5, 0.5, 0.4, 0.5);
            ps.minSize = 0.01;
            ps.maxSize = 0.05;
            ps.minLifeTime = 0.05;
            ps.maxLifeTime = 0.15;
            ps.emitRate = 100;
            ps.targetStopDuration = 0.05;
            ps.createPointEmitter(VisualManager._impactDirMin, VisualManager._impactDirMax);
            ps.minEmitPower = 1;
            ps.maxEmitPower = 2;
            ps.gravity = new BABYLON.Vector3(0, -9.8, 0);
            ps.disposeOnStop = false;
            this.impactPSPool.push(ps);
        }
    }

    private initBloodPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_BLOOD_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`bloodPS_${i}`, 20, this.scene);
            ps.particleTexture = tex;
            ps.color1 = new BABYLON.Color4(0.7, 0, 0, 1);
            ps.color2 = new BABYLON.Color4(0.3, 0, 0, 1);
            ps.colorDead = new BABYLON.Color4(0.1, 0, 0, 0);
            ps.minSize = 0.05;
            ps.maxSize = 0.15;
            ps.minLifeTime = 0.2;
            ps.maxLifeTime = 0.4;
            ps.emitRate = 100;
            ps.targetStopDuration = 0.1;
            ps.createPointEmitter(VisualManager._bloodDirMin, VisualManager._bloodDirMax);
            ps.minEmitPower = 1;
            ps.maxEmitPower = 3;
            ps.gravity = new BABYLON.Vector3(0, -5, 0);
            ps.disposeOnStop = false;
            this.bloodPSPool.push(ps);
        }
    }

    private initDebrisPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/wood.jpg");
        for (let i = 0; i < VisualManager.MAX_DEBRIS_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`debrisPS_${i}`, 20, this.scene);
            ps.particleTexture = tex;
            ps.minEmitBox = VisualManager._debrisMinBox;
            ps.maxEmitBox = VisualManager._debrisMaxBox;
            ps.color1 = new BABYLON.Color4(0.6, 0.5, 0.4, 1.0);
            ps.color2 = new BABYLON.Color4(0.4, 0.3, 0.2, 1.0);
            ps.minSize = 0.05;
            ps.maxSize = 0.15;
            ps.minLifeTime = 0.5;
            ps.maxLifeTime = 1.0;
            ps.emitRate = 100;
            ps.targetStopDuration = 0.1;
            ps.gravity = new BABYLON.Vector3(0, -9.81, 0);
            ps.direction1 = new BABYLON.Vector3(-1, 2, -1);
            ps.direction2 = new BABYLON.Vector3(1, 2, 1);
            ps.disposeOnStop = false;
            this.debrisPSPool.push(ps);
        }
    }

    private initZombieExplosionPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_ZOMBIE_EXPLOSIONS; i++) {
            // Burst
            const burst = new BABYLON.ParticleSystem(`zombieBurst_${i}`, 60, this.scene);
            burst.particleTexture = tex;
            burst.color1 = new BABYLON.Color4(0.9, 0.02, 0.02, 1);
            burst.color2 = new BABYLON.Color4(0.6, 0.0, 0.0, 1);
            burst.colorDead = new BABYLON.Color4(0.15, 0, 0, 0);
            burst.minSize = 0.04; burst.maxSize = 0.18;
            burst.minLifeTime = 0.25; burst.maxLifeTime = 0.65;
            burst.emitRate = 900;
            burst.targetStopDuration = 0.07;
            burst.createSphereEmitter(0.15);
            burst.minEmitPower = 7; burst.maxEmitPower = 15;
            burst.gravity = new BABYLON.Vector3(0, -9.8, 0);
            burst.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
            burst.disposeOnStop = false;
            this.burstPSPool.push(burst);

            // Mist
            const mist = new BABYLON.ParticleSystem(`zombieMist_${i}`, 25, this.scene);
            mist.particleTexture = tex;
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
            mist.disposeOnStop = false;
            this.mistPSPool.push(mist);

            // Chunks
            const chunks = new BABYLON.ParticleSystem(`zombieChunks_${i}`, 10, this.scene);
            chunks.particleTexture = tex;
            chunks.color1 = new BABYLON.Color4(0.45, 0.05, 0.04, 1);
            chunks.color2 = new BABYLON.Color4(0.28, 0.03, 0.02, 1);
            chunks.colorDead = new BABYLON.Color4(0.18, 0.02, 0.01, 0.4);
            chunks.minSize = 0.12; chunks.maxSize = 0.28;
            chunks.minLifeTime = 0.6; chunks.maxLifeTime = 1.5;
            chunks.emitRate = 160;
            chunks.targetStopDuration = 0.06;
            chunks.createSphereEmitter(0.2);
            chunks.minEmitPower = 5; chunks.maxEmitPower = 11;
            chunks.gravity = new BABYLON.Vector3(0, -15, 0);
            chunks.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
            chunks.disposeOnStop = false;
            this.chunksPSPool.push(chunks);
        }
    }

    private initHeadExplosionPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_HEAD_EXPLOSIONS; i++) {
            const brain = new BABYLON.ParticleSystem(`headBrain_${i}`, 8, this.scene);
            brain.particleTexture = tex;
            brain.color1 = new BABYLON.Color4(0.5, 0.05, 0.05, 1);
            brain.color2 = new BABYLON.Color4(0.32, 0.02, 0.02, 1);
            brain.colorDead = new BABYLON.Color4(0.18, 0.01, 0.01, 0.3);
            brain.minSize = 0.08; brain.maxSize = 0.2;
            brain.minLifeTime = 0.5; brain.maxLifeTime = 1.2;
            brain.emitRate = 140;
            brain.targetStopDuration = 0.06;
            brain.createSphereEmitter(0.1);
            brain.minEmitPower = 5; brain.maxEmitPower = 13;
            brain.gravity = new BABYLON.Vector3(0, -14, 0);
            brain.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
            brain.disposeOnStop = false;
            this.brainPSPool.push(brain);
        }
    }

    private initHoundExplosionPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_HOUND_EXPLOSIONS; i++) {
            const ps = new BABYLON.ParticleSystem(`houndExplosion_${i}`, 50, this.scene);
            ps.particleTexture = tex;
            ps.color1 = new BABYLON.Color4(1, 0.5, 0, 1);
            ps.color2 = new BABYLON.Color4(1, 0.2, 0, 0.8);
            ps.colorDead = new BABYLON.Color4(0.2, 0, 0, 0);
            ps.minSize = 0.3; ps.maxSize = 0.8;
            ps.minLifeTime = 0.2; ps.maxLifeTime = 0.4;
            ps.emitRate = 100;
            ps.direction1 = new BABYLON.Vector3(-1, 1, -1);
            ps.direction2 = new BABYLON.Vector3(1, 2, 1);
            ps.minEmitPower = 2; ps.maxEmitPower = 4;
            ps.targetStopDuration = 0.1;
            ps.disposeOnStop = false;
            this.houndExplosionPSPool.push(ps);
        }
    }

    private initGoreDiscPool() {
        const mat = this.resourceManager.getMaterial("floorGoreMat", () => {
            const m = new BABYLON.StandardMaterial("floorGoreMat", this.scene);
            m.diffuseColor = new BABYLON.Color3(0.42, 0.0, 0.0);
            m.specularColor = new BABYLON.Color3(0.02, 0, 0);
            m.emissiveColor = new BABYLON.Color3(0.04, 0, 0);
            m.backFaceCulling = false;
            return m;
        });

        for (let i = 0; i < VisualManager.MAX_GORE_DISCS; i++) {
            const disc = BABYLON.MeshBuilder.CreateDisc(`goreDisc_${i}`, {
                radius: 1, 
                tessellation: 12
            }, this.scene);
            disc.material = mat;
            disc.isPickable = false;
            disc.setEnabled(false);
            disc.rotation.x = Math.PI / 2;
            this.goreDiscPool.push(disc);
        }
    }

    private initGoreFadeObserver() {
        const FADE_MS = 30000;
        this.scene.onBeforeRenderObservable.add(() => {
            const now = Date.now();
            for (let i = this.activeGoreDiscs.length - 1; i >= 0; i--) {
                const entry = this.activeGoreDiscs[i];
                const elapsed = now - entry.startTime;
                
                if (elapsed >= FADE_MS) {
                    entry.mesh.setEnabled(false);
                    this.activeGoreDiscs.splice(i, 1);
                } else {
                    const t = elapsed / FADE_MS;
                    entry.mesh.visibility = entry.startVis * (1 - t);
                }
            }
        });
    }


    public createWoodDebris(pos: BABYLON.Vector3) {
        const idx = this.debrisPSCursor % VisualManager.MAX_DEBRIS_PS;
        this.debrisPSCursor++;
        const ps = this.debrisPSPool[idx];

        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }

        ps.emitter = pos;
        ps.start();
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
     * Recycled from a pre-allocated pool to avoid runtime mesh generation.
     */
    private createFloorGore(pos: BABYLON.Vector3): void {
        const floorRay = new BABYLON.Ray(
            new BABYLON.Vector3(pos.x, pos.y + 0.5, pos.z),
            new BABYLON.Vector3(0, -1, 0),
            10
        );
        const floorPick = this.scene.pickWithRay(floorRay, (m) => m.checkCollisions && m.isEnabled());
        const floorY = (floorPick && floorPick.hit && floorPick.pickedPoint)
            ? floorPick.pickedPoint.y + 0.005
            : 0.005;

        // Main blood pool disc
        this.spawnGoreDisc(pos.x, floorY, pos.z, 0.4 + Math.random() * 0.45, 0.9);

        // Scattered gore bits
        const bitsCount = 2 + Math.floor(Math.random() * 3);
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
        const idx = this.goreDiscCursor % VisualManager.MAX_GORE_DISCS;
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

    /**
     * Full body-death explosion: directional blood burst, gore mist, heavy chunk arc,
     * and a persistent blood pool + gore pile on the floor.
     */
    public createZombieExplosion(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        const bx = hitDir ? -hitDir.x : 0;
        const by = hitDir ? Math.max(-hitDir.y + 0.8, 0.5) : 1.0;
        const bz = hitDir ? -hitDir.z : 0;

        // Reuse scratch origin — set inline to avoid new Vector3 allocation
        VisualManager._scratchOrigin.set(pos.x, pos.y + 0.8, pos.z);

        const idx = this.zombieExplosionCursor % VisualManager.MAX_ZOMBIE_EXPLOSIONS;
        this.zombieExplosionCursor++;

        // 1. Burst
        const burst = this.burstPSPool[idx];
        if (burst.isStarted()) { burst.stop(); burst.reset(); }
        burst.emitter = VisualManager._scratchOrigin;
        burst.direction1.set(bx - 0.9, by - 0.3, bz - 0.9);
        burst.direction2.set(bx + 0.9, by + 1.2, bz + 0.9);
        burst.start();

        // 2. Mist
        const mist = this.mistPSPool[idx];
        if (mist.isStarted()) { mist.stop(); mist.reset(); }
        mist.emitter = VisualManager._scratchOrigin;
        mist.start();

        // 3. Chunks
        const chunks = this.chunksPSPool[idx];
        if (chunks.isStarted()) { chunks.stop(); chunks.reset(); }
        chunks.emitter = VisualManager._scratchOrigin;
        chunks.direction1.set(bx - 1.5, by + 0.5, bz - 1.5);
        chunks.direction2.set(bx + 1.5, by + 3.0, bz + 1.5);
        chunks.start();

        this.createFloorGore(pos);
    }

    /**
     * Headshot explosion: intense upward burst, brain-matter chunks, fine mist,
     * and a floor blood pool.
     */
    public createHeadExplosion(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        const bx = hitDir ? -hitDir.x : 0;
        const by = hitDir ? Math.max(-hitDir.y + 1.2, 1.0) : 1.5;
        const bz = hitDir ? -hitDir.z : 0;

        VisualManager._scratchOrigin.set(pos.x, pos.y, pos.z);

        const idx = this.zombieExplosionCursor % VisualManager.MAX_ZOMBIE_EXPLOSIONS;
        const hIdx = this.headExplosionCursor % VisualManager.MAX_HEAD_EXPLOSIONS;
        this.zombieExplosionCursor++;
        this.headExplosionCursor++;

        // 1. Intense Burst
        const burst = this.burstPSPool[idx];
        if (burst.isStarted()) { burst.stop(); burst.reset(); }
        burst.emitter = VisualManager._scratchOrigin;
        burst.direction1.set(bx - 0.7, by, bz - 0.7);
        burst.direction2.set(bx + 0.7, by + 1.5, bz + 0.7);
        burst.start();

        // 2. Brain Chunks
        const brain = this.brainPSPool[hIdx];
        if (brain.isStarted()) { brain.stop(); brain.reset(); }
        brain.emitter = VisualManager._scratchOrigin;
        brain.direction1.set(bx - 2, by + 0.5, bz - 2);
        brain.direction2.set(bx + 2, by + 4, bz + 2);
        brain.start();

        // 3. Mist
        const mist = this.mistPSPool[idx];
        if (mist.isStarted()) { mist.stop(); mist.reset(); }
        mist.emitter = VisualManager._scratchOrigin;
        mist.start();

        this.createFloorGore(pos);
    }

    public createHellhoundDeathExplosion(pos: BABYLON.Vector3) {
        const idx = this.houndExplosionCursor % VisualManager.MAX_HOUND_EXPLOSIONS;
        this.houndExplosionCursor++;
        const ps = this.houndExplosionPSPool[idx];

        if (ps.isStarted()) { ps.stop(); ps.reset(); }
        ps.emitter = pos;
        ps.start();

        // Acquire a small orange flash light
        this.acquireFlashLight(pos, 1.0, 0.4, 0.1);
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
        
        const floorGoreMat = this.resourceManager.getMaterial("floorGoreMat", () => {
            const m = new BABYLON.StandardMaterial("floorGoreMat", this.scene);
            m.diffuseColor = new BABYLON.Color3(0.42, 0.0, 0.0);
            m.specularColor = new BABYLON.Color3(0.02, 0, 0);
            m.emissiveColor = new BABYLON.Color3(0.04, 0, 0);
            m.backFaceCulling = false;
            return m;
        });

        const bloodDecalMat = this.resourceManager.getMaterial("bloodDecalMat", () => {
            const mat = new BABYLON.StandardMaterial("bloodDecalMat", this.scene);
            mat.diffuseColor = new BABYLON.Color3(0.6, 0, 0);
            mat.specularColor = BABYLON.Color3.Black();
            mat.zOffset = -1;
            return mat;
        });

        // 3. Initialize pools (if not already done by constructor)
        // These are mostly light-weight if already initialized
        this.initGoreDiscPool();
        
        // 4. Pre-compile materials
        const compilerMesh = this.scene.meshes[0];
        if (compilerMesh) {
            if (this.decalMat) this.decalMat.forceCompilation(compilerMesh);
            if (floorGoreMat instanceof BABYLON.Material) floorGoreMat.forceCompilation(compilerMesh);
            if (bloodDecalMat instanceof BABYLON.Material) bloodDecalMat.forceCompilation(compilerMesh);
        }
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
        const idx = this.impactPSCursor % VisualManager.MAX_IMPACT_PS;
        this.impactPSCursor++;
        const ps = this.impactPSPool[idx];

        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }

        ps.emitter = pos;
        // Avoid allocations: compute scaled normal components inline and set in-place
        const nx = normal.x * 1.5, ny = normal.y * 1.5, nz = normal.z * 1.5;
        ps.direction1.set(nx + 0.2, ny + 0.2, nz + 0.2);
        ps.direction2.set(nx - 0.2, ny - 0.2, nz - 0.2);

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
        const idx = this.bloodPSCursor % VisualManager.MAX_BLOOD_PS;
        this.bloodPSCursor++;
        const ps = this.bloodPSPool[idx];

        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }

        ps.emitter = pos;
        // Avoid allocations: compute scaled normal inline and set in-place
        const nx = normal.x * 2, ny = normal.y * 2, nz = normal.z * 2;
        ps.direction1.set(nx + 0.5, ny + 0.5, nz + 0.5);
        ps.direction2.set(nx - 0.5, ny - 0.5, nz - 0.5);
        
        ps.start();

        // Create blood decal on the zombie body where hit
        if (targetMesh) {
            this.createBloodDecalOnMesh(pos, normal, targetMesh);
        }

        // Try to find floor for blood pool
        const floorRay = new BABYLON.Ray(pos.add(new BABYLON.Vector3(0, 0.1, 0)), new BABYLON.Vector3(0, -1, 0), 10);
        const floorPick = this.scene.pickWithRay(floorRay, (m) => m.checkCollisions && m.isEnabled());
        if (floorPick && floorPick.hit && floorPick.pickedPoint && floorPick.pickedMesh) {
            this.createBloodDecalOnMesh(floorPick.pickedPoint, new BABYLON.Vector3(0, 1, 0), floorPick.pickedMesh);
        }
    }


    private createBloodDecalOnMesh(pos: BABYLON.Vector3, normal: BABYLON.Vector3, target: BABYLON.AbstractMesh) {
        const scene = this.scene;

        // Evict the oldest blood decal before adding a new one so the live count
        // stays at MAX_BLOOD_DECALS. This replaces the unbounded setTimeout pattern
        // which could accumulate hundreds of meshes under sustained fire.
        if (this.activeBloodDecals.length >= VisualManager.MAX_BLOOD_DECALS) {
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
            const mat = new BABYLON.StandardMaterial("bloodDecalMat", scene);
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

    private initSpawnEffectPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_SPAWN_EFFECT_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`spawnEffect_${i}`, 50, this.scene);
            ps.particleTexture = tex;
            ps.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 1);
            ps.color2 = new BABYLON.Color4(0, 0, 0, 0);
            ps.minSize = 0.5; ps.maxSize = 1.0;
            ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0;
            ps.emitRate = 100;
            ps.targetStopDuration = 0.5;
            ps.disposeOnStop = false;
            this.spawnEffectPSPool.push(ps);
        }
    }

    private initSpawnSmokePool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < VisualManager.MAX_SPAWN_SMOKE_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`spawnSmoke_${i}`, 100, this.scene);
            ps.particleTexture = tex;
            ps.color1 = new BABYLON.Color4(0.1, 0.1, 0.15, 1);
            ps.color2 = new BABYLON.Color4(0.3, 0.2, 0.4, 0.8);
            ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
            ps.minSize = 0.8; ps.maxSize = 2.0;
            ps.minLifeTime = 0.8; ps.maxLifeTime = 1.5;
            ps.emitRate = 80;
            ps.minEmitBox = new BABYLON.Vector3(-0.5, -0.2, -0.5);
            ps.maxEmitBox = new BABYLON.Vector3(0.5, 0.5, 0.5);
            ps.direction1 = new BABYLON.Vector3(-1, 2, -1);
            ps.direction2 = new BABYLON.Vector3(1, 3, 1);
            ps.minEmitPower = 0.5; ps.maxEmitPower = 1.5;
            ps.gravity = new BABYLON.Vector3(0, -0.5, 0);
            ps.minAngularSpeed = -Math.PI;
            ps.maxAngularSpeed = Math.PI;
            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
            ps.disposeOnStop = false;
            this.spawnSmokePSPool.push(ps);
        }
    }

    public createSpawnEffect(pos: BABYLON.Vector3) {
        const idx = this.spawnEffectCursor % VisualManager.MAX_SPAWN_EFFECT_PS;
        this.spawnEffectCursor++;
        const ps = this.spawnEffectPSPool[idx];
        if (ps.isStarted()) { ps.stop(); ps.reset(); }
        ps.emitter = pos;
        ps.start();
    }

    public createSpawnSmokeEffect(pos: BABYLON.Vector3): BABYLON.ParticleSystem {
        const idx = this.spawnSmokeCursor % VisualManager.MAX_SPAWN_SMOKE_PS;
        this.spawnSmokeCursor++;
        const ps = this.spawnSmokePSPool[idx];
        if (ps.isStarted()) { ps.stop(); ps.reset(); }
        ps.emitter = pos;
        ps.start();
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
        const idx = this.trailPSCursor % VisualManager.MAX_TRAIL_PS;
        this.trailPSCursor++;
        const ps = this.trailPSPool[idx];

        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }

        ps.emitter = mesh;

        if (isPacked) {
            ps.color1 = VisualManager._trailColorPacked;
            ps.color2 = VisualManager._trailColorPacked2;
        } else {
            ps.color1 = VisualManager._trailColorNormal;
            ps.color2 = VisualManager._trailColorNormal2;
        }
        ps.colorDead = VisualManager._colorDead;

        ps.start();

        return ps;
    }

    public stopProjectileTrail(ps: BABYLON.ParticleSystem) {
        if (!ps) return;
        
        // Snapshot current position as a static emitter so remaining particles don't snap to origin
        if (ps.emitter instanceof BABYLON.AbstractMesh) {
            ps.emitter = ps.emitter.position.clone();
        }
        
        ps.stop();
    }


    public reset() {
        this.activeDecals.forEach(d => d.dispose());
        this.activeDecals = [];

        this.activeBloodDecals.forEach(d => { if (!d.isDisposed()) d.dispose(); });
        this.activeBloodDecals = [];

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

        this.trailPSPool.forEach(ps => {
            if (ps.isStarted()) ps.stop();
            ps.reset();
        });

        this.impactPSPool.forEach(ps => {
            if (ps.isStarted()) ps.stop();
            ps.reset();
        });

        this.bloodPSPool.forEach(ps => {
            if (ps.isStarted()) ps.stop();
            ps.reset();
        });

        this.spawnEffectPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.spawnSmokePSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });

        
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
        this.activeBloodDecals.forEach(d => { if (!d.isDisposed()) d.dispose(); });
        this.activeBloodDecals = [];
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

        for (const ps of this.trailPSPool) {
            ps.dispose(false);
        }
        this.trailPSPool = [];

        for (const ps of this.impactPSPool) {
            ps.dispose(false);
        }
        this.impactPSPool = [];

        for (const ps of this.bloodPSPool) {
            ps.dispose(false);
        }
        this.bloodPSPool = [];

        for (const ps of this.spawnEffectPSPool) { ps.dispose(false); }
        this.spawnEffectPSPool = [];
        for (const ps of this.spawnSmokePSPool) { ps.dispose(false); }
        this.spawnSmokePSPool = [];


        this.floorGorePieces.forEach(m => { if (!m.isDisposed()) m.dispose(); });
        this.floorGorePieces = [];

        this.bloodPool = [];
        this.lights = [];
    }
}
