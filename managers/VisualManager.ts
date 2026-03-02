import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from './ResourceManager';
import { VISUAL_CONFIG } from '../config';

interface PooledSplatter {
    mesh: BABYLON.Mesh;
    material: BABYLON.StandardMaterial;
    observer: BABYLON.Observer<BABYLON.Scene> | null;
}

/**
 * Configuration for explosion chunk effects
 */
interface ExplosionChunkConfig {
    count: number;
    sizeMin: number;
    sizeMax: number;
    color: BABYLON.Color3;
    emissiveColor: BABYLON.Color3;
    velocitySpread: number;
    upwardForce: number;
    gravity: number;
    materialName: string;
}

const ZOMBIE_CHUNK_CONFIG: ExplosionChunkConfig = {
    count: 8,
    sizeMin: 0.1,
    sizeMax: 0.25,
    color: new BABYLON.Color3(0.4, 0.1, 0.1),
    emissiveColor: new BABYLON.Color3(0.1, 0.02, 0.02),
    velocitySpread: 0.1,
    upwardForce: 0.2,
    gravity: -0.015,
    materialName: "zombieResidueMat"
};

const HEAD_CHUNK_CONFIG: ExplosionChunkConfig = {
    count: 6,
    sizeMin: 0.05,
    sizeMax: 0.15,
    color: new BABYLON.Color3(0.5, 0.15, 0.1),
    emissiveColor: new BABYLON.Color3(0.15, 0.04, 0.03),
    velocitySpread: 0.15,
    upwardForce: 0.25,
    gravity: -0.02,
    materialName: "headChunkMat"
};

export class VisualManager {
    private bloodPool: PooledSplatter[] = [];
    private poolSize = VISUAL_CONFIG.BLOOD_POOL_SIZE;
    private poolCursor = 0;
    
    // Decal State
    private decalMat: BABYLON.StandardMaterial | null = null;
    private activeDecals: BABYLON.AbstractMesh[] = [];
    private MAX_DECALS = 40;

    public lights: BABYLON.PointLight[] = [];

    // Zombie Residue
    private zombieResidue: { meshes: BABYLON.AbstractMesh[], timestamp: number }[] = [];

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
     * Creates explosion chunks with physics simulation.
     * Shared logic for zombie body and head explosions.
     * Includes max-lifetime timeout (10s) to guarantee observer cleanup.
     */
    private createExplosionChunks(pos: BABYLON.Vector3, config: ExplosionChunkConfig): BABYLON.AbstractMesh[] {
        const meshes: BABYLON.AbstractMesh[] = [];
        const MAX_LIFETIME_MS = 10000; // 10 second safety timeout
        const startTime = Date.now();
        
        const mat = this.resourceManager.getMaterial(config.materialName, () => {
            const m = new BABYLON.StandardMaterial(config.materialName, this.scene);
            m.diffuseColor = config.color.clone();
            m.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            m.emissiveColor = config.emissiveColor.clone();
            m.maxSimultaneousLights = 4;
            return m;
        });

        for (let i = 0; i < config.count; i++) {
            const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
            const chunk = BABYLON.MeshBuilder.CreateBox("chunk_" + i, { size }, this.scene);
            chunk.material = mat;
            chunk.position.copyFrom(pos);
            chunk.position.y += 1.0; // Start from center of body
            
            // Random spread
            chunk.position.x += (Math.random() - 0.5) * 0.5;
            chunk.position.z += (Math.random() - 0.5) * 0.5;
            chunk.rotation = new BABYLON.Vector3(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            // Physics simulation
            const velocity = new BABYLON.Vector3(
                (Math.random() - 0.5) * config.velocitySpread,
                config.upwardForce * (0.5 + Math.random()),
                (Math.random() - 0.5) * config.velocitySpread
            );
            
            const floorY = 0.05;
            
            const observer = this.scene.onBeforeRenderObservable.add(() => {
                if (chunk.isDisposed()) {
                    this.scene.onBeforeRenderObservable.remove(observer);
                    return;
                }

                // Max lifetime safety check
                if (Date.now() - startTime > MAX_LIFETIME_MS) {
                    this.scene.onBeforeRenderObservable.remove(observer);
                    return;
                }

                velocity.y += config.gravity;
                chunk.position.addInPlace(velocity);
                chunk.rotation.addInPlaceFromFloats(0.05, 0.05, 0.05);

                // Floor collision
                if (chunk.position.y <= floorY) {
                    chunk.position.y = floorY;
                    this.scene.onBeforeRenderObservable.remove(observer);
                    chunk.rotation.x = 0;
                    chunk.rotation.z = 0;
                }
            });

            meshes.push(chunk);
        }

        return meshes;
    }

    public createZombieExplosion(pos: BABYLON.Vector3) {
        const meshes = this.createExplosionChunks(pos, ZOMBIE_CHUNK_CONFIG);

        this.zombieResidue.push({ meshes, timestamp: Date.now() });

        // Cleanup old residue
        if (this.zombieResidue.length > VISUAL_CONFIG.MAX_ZOMBIE_RESIDUE) {
            const old = this.zombieResidue.shift();
            if (old) {
                old.meshes.forEach(m => m.dispose());
            }
        }
    }

    public createHeadExplosion(pos: BABYLON.Vector3) {
        const meshes = this.createExplosionChunks(pos, HEAD_CHUNK_CONFIG);

        this.zombieResidue.push({ meshes, timestamp: Date.now() });

        if (this.zombieResidue.length > VISUAL_CONFIG.MAX_ZOMBIE_RESIDUE) {
            const old = this.zombieResidue.shift();
            if (old) {
                old.meshes.forEach(m => m.dispose());
            }
        }

        // Blood spray particles
        const ps = new BABYLON.ParticleSystem("headBloodPS", 30, this.scene);
        ps.particleTexture = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        ps.emitter = pos;
        ps.color1 = new BABYLON.Color4(0.8, 0.1, 0.1, 1);
        ps.color2 = new BABYLON.Color4(0.4, 0.05, 0.05, 1);
        ps.colorDead = new BABYLON.Color4(0.1, 0, 0, 0);
        ps.minSize = 0.05; ps.maxSize = 0.15;
        ps.minLifeTime = 0.3; ps.maxLifeTime = 0.6;
        ps.emitRate = 200;
        ps.targetStopDuration = 0.1;
        ps.createSphereEmitter(0.15);
        ps.direction1 = new BABYLON.Vector3(-1, 1, -1);
        ps.direction2 = new BABYLON.Vector3(1, 2, 1);
        ps.minEmitPower = 3; ps.maxEmitPower = 6;
        ps.gravity = new BABYLON.Vector3(0, -5, 0);
        this.setupSafeAutoDispose(ps);
        ps.start();
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
        
        this.bloodPool = [];
        this.lights = [];
    }
}
