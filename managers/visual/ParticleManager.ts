import * as BABYLON from '@babylonjs/core';
import { ResourceManager } from '../ResourceManager';

export class ParticleManager {
    private static readonly MAX_FLASH_LIGHTS = 2;
    private flashLightPool: BABYLON.PointLight[] = [];
    private flashLightCursor = 0;
    private flashLightFadeStart: number[] = [];
    private flashLightFadeObserver: BABYLON.Observer<BABYLON.Scene> | null = null;

    private static readonly MAX_EXPLOSION_PS = 3;
    private explosionPSPool: BABYLON.ParticleSystem[] = [];
    private explosionPSCursor = 0;

    private static readonly MAX_TRAIL_PS = 20;
    private trailPSPool: BABYLON.ParticleSystem[] = [];
    private trailPSCursor = 0;

    private static readonly MAX_IMPACT_PS = 15;
    private impactPSPool: BABYLON.ParticleSystem[] = [];
    private impactPSCursor = 0;

    private static readonly MAX_BLOOD_PS = 15;
    private bloodPSPool: BABYLON.ParticleSystem[] = [];
    private bloodPSCursor = 0;

    private static readonly MAX_DEBRIS_PS = 10;
    private debrisPSPool: BABYLON.ParticleSystem[] = [];
    private debrisPSCursor = 0;

    private static readonly MAX_DIRT_BURST_PS = 5;
    private dirtBurstPSPool: BABYLON.ParticleSystem[] = [];
    private dirtBurstPSCursor = 0;

    private static readonly MAX_ZOMBIE_EXPLOSIONS = 5;
    private burstPSPool: BABYLON.ParticleSystem[] = [];
    private mistPSPool: BABYLON.ParticleSystem[] = [];
    private chunksPSPool: BABYLON.ParticleSystem[] = [];
    private zombieExplosionCursor = 0;

    private static readonly MAX_HEAD_EXPLOSIONS = 5;
    private brainPSPool: BABYLON.ParticleSystem[] = [];
    private headExplosionCursor = 0;

    private static readonly MAX_HOUND_EXPLOSIONS = 3;
    private houndExplosionPSPool: BABYLON.ParticleSystem[] = [];
    private houndExplosionCursor = 0;

    private static readonly MAX_SPAWN_EFFECT_PS = 6;
    private spawnEffectPSPool: BABYLON.ParticleSystem[] = [];
    private spawnEffectCursor = 0;

    private static readonly MAX_SPAWN_SMOKE_PS = 4;
    private spawnSmokePSPool: BABYLON.ParticleSystem[] = [];
    private spawnSmokeCursor = 0;

    // Ambient hole smoke — persistent, always-on, one per ground spawn (max 8)
    private static readonly MAX_HOLE_SMOKE_PS = 8;
    private holeSmokePSPool: BABYLON.ParticleSystem[] = [];
    private activeHoleSmokeCount = 0;

    private static readonly _scratchColor3 = new BABYLON.Color3();
    private static readonly _scratchDir1 = new BABYLON.Vector3();
    private static readonly _scratchDir2 = new BABYLON.Vector3();
    private static readonly _scratchOrigin = new BABYLON.Vector3();

    private static readonly _explosionDirMin = new BABYLON.Vector3(-1, 1, -1);
    private static readonly _explosionDirMax = new BABYLON.Vector3(1, 1, 1);
    private static readonly _explosionGravity = new BABYLON.Vector3(0, -2, 0);
    private static readonly _impactDirMin = new BABYLON.Vector3(0.05, 0.05, 0.05);
    private static readonly _impactDirMax = new BABYLON.Vector3(-0.05, -0.05, -0.05);
    private static readonly _bloodDirMin = new BABYLON.Vector3(0.1, 0.1, 0.1);
    private static readonly _bloodDirMax = new BABYLON.Vector3(-0.1, -0.1, -0.1);
    private static readonly _debrisMinBox = new BABYLON.Vector3(-0.5, -0.2, -0.1);
    private static readonly _debrisMaxBox = new BABYLON.Vector3(0.5, 0.2, 0.1);
    private static readonly _trailDir = new BABYLON.Vector3(0, 0, -1);

    private static readonly _colorNormal = new BABYLON.Color4(1, 0.4, 0, 1);
    private static readonly _colorNormal2 = new BABYLON.Color4(0.5, 0.2, 0, 1);
    private static readonly _colorPacked = new BABYLON.Color4(0.6, 0.1, 1, 1);
    private static readonly _colorPacked2 = new BABYLON.Color4(0.3, 0.05, 0.5, 1);
    private static readonly _colorDead = new BABYLON.Color4(0, 0, 0, 0);

    private static readonly _trailColorNormal = new BABYLON.Color4(1, 0.4, 0, 1);
    private static readonly _trailColorNormal2 = new BABYLON.Color4(0.8, 0.32, 0, 1);
    private static readonly _trailColorPacked = new BABYLON.Color4(0.6, 0.1, 1, 1);
    private static readonly _trailColorPacked2 = new BABYLON.Color4(0.48, 0.08, 0.8, 1);

    // Staggered nuke explosion queue — prevents simultaneous mass kills from spiking the frame
    private static readonly MAX_ZOMBIE_EXPLOSIONS_PER_FRAME = 2;
    private static readonly _queuePos = new BABYLON.Vector3();
    private static readonly _queueHit = new BABYLON.Vector3();
    private zombieExplosionQueue: Array<{ x: number; y: number; z: number; hx: number; hy: number; hz: number; hasHit: boolean }> = [];
    private zombieExplosionFrameCount = 0;

    constructor(private scene: BABYLON.Scene, private resourceManager: ResourceManager) {
        this.initFlashLightPool();
        this.initExplosionPSPool();
        this.initTrailPSPool();
        this.initImpactPSPool();
        this.initBloodPSPool();
        this.initDebrisPSPool();
        this.initDirtBurstPSPool();
        this.initZombieExplosionPool();
        this.initHeadExplosionPool();
        this.initHoundExplosionPool();
        this.initSpawnEffectPool();
        this.initSpawnSmokePool();
        this.initHoleSmokePool();
    }

    private initFlashLightPool() {
        for (let i = 0; i < ParticleManager.MAX_FLASH_LIGHTS; i++) {
            const light = new BABYLON.PointLight(`explosionFlash_${i}`, BABYLON.Vector3.Zero(), this.scene);
            light.intensity = 0;
            light.range = 15;
            this.flashLightPool.push(light);
            this.flashLightFadeStart.push(0);
        }
        this.flashLightFadeObserver = this.scene.onBeforeRenderObservable.add(() => {
            // Always reset per-frame explosion budget so the cap is per-frame, not cumulative
            this.zombieExplosionFrameCount = 0;

            // Early exit when nothing is active (e.g. after reset()) — avoids unnecessary work
            const hasActiveLight = this.flashLightFadeStart.some(s => s !== 0);
            if (!hasActiveLight && this.zombieExplosionQueue.length === 0) return;

            const now = Date.now();
            for (let i = 0; i < this.flashLightPool.length; i++) {
                const start = this.flashLightFadeStart[i];
                if (start === 0) continue;
                const t = (now - start) / 200;
                if (t >= 1) {
                    this.flashLightPool[i].intensity = 0;
                    this.flashLightFadeStart[i] = 0;
                } else {
                    this.flashLightPool[i].intensity = 5 * (1 - t);
                }
            }
            // Drain the nuke queue
            const toFire = Math.min(this.zombieExplosionQueue.length, ParticleManager.MAX_ZOMBIE_EXPLOSIONS_PER_FRAME);
            for (let j = 0; j < toFire; j++) {
                const e = this.zombieExplosionQueue.shift()!;
                ParticleManager._queuePos.set(e.x, e.y, e.z);
                this._fireZombieExplosionParticles(
                    ParticleManager._queuePos,
                    e.hasHit ? ParticleManager._queueHit.set(e.hx, e.hy, e.hz) : undefined
                );
            }
        });
    }

    private acquireFlashLight(pos: BABYLON.Vector3, r: number, g: number, b: number): void {
        const idx = this.flashLightCursor % ParticleManager.MAX_FLASH_LIGHTS;
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
        for (let i = 0; i < ParticleManager.MAX_EXPLOSION_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`plasmaExplosion_${i}`, 80, this.scene);
            ps.particleTexture = tex;
            ps.minSize = 0.5;
            ps.maxSize = 2.0;
            ps.minLifeTime = 0.2;
            ps.maxLifeTime = 0.5;
            ps.emitRate = 500;
            ps.targetStopDuration = 0.1;
            ps.createSphereEmitter(0.5);
            ps.direction1 = ParticleManager._explosionDirMin;
            ps.direction2 = ParticleManager._explosionDirMax;
            ps.minEmitPower = 10;
            ps.maxEmitPower = 20;
            ps.gravity = ParticleManager._explosionGravity;
            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
            ps.disposeOnStop = false;
            this.explosionPSPool.push(ps);
        }
    }

    private initTrailPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < ParticleManager.MAX_TRAIL_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`trailPS_${i}`, 100, this.scene);
            ps.particleTexture = tex;
            ps.minSize = 0.1;
            ps.maxSize = 0.4;
            ps.minLifeTime = 0.05;
            ps.maxLifeTime = 0.2;
            ps.emitRate = 150;
            ps.createPointEmitter(ParticleManager._trailDir, ParticleManager._trailDir);
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
        for (let i = 0; i < ParticleManager.MAX_IMPACT_PS; i++) {
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
            ps.createPointEmitter(ParticleManager._impactDirMin, ParticleManager._impactDirMax);
            ps.minEmitPower = 1;
            ps.maxEmitPower = 2;
            ps.gravity = new BABYLON.Vector3(0, -9.8, 0);
            ps.disposeOnStop = false;
            this.impactPSPool.push(ps);
        }
    }

    private initBloodPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < ParticleManager.MAX_BLOOD_PS; i++) {
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
            ps.createPointEmitter(ParticleManager._bloodDirMin, ParticleManager._bloodDirMax);
            ps.minEmitPower = 1;
            ps.maxEmitPower = 3;
            ps.gravity = new BABYLON.Vector3(0, -5, 0);
            ps.disposeOnStop = false;
            this.bloodPSPool.push(ps);
        }
    }

    private initDebrisPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/wood.jpg");
        for (let i = 0; i < ParticleManager.MAX_DEBRIS_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`debrisPS_${i}`, 20, this.scene);
            ps.particleTexture = tex;
            ps.minEmitBox = ParticleManager._debrisMinBox;
            ps.maxEmitBox = ParticleManager._debrisMaxBox;
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

    private initDirtBurstPSPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/wood.jpg"); // Reusing for blocky dirt chunks
        for (let i = 0; i < ParticleManager.MAX_DIRT_BURST_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`dirtBurstPS_${i}`, 50, this.scene);
            ps.particleTexture = tex;
            ps.minEmitBox = new BABYLON.Vector3(-0.8, -0.1, -0.8);
            ps.maxEmitBox = new BABYLON.Vector3(0.8, 0.1, 0.8);
            ps.color1 = new BABYLON.Color4(0.2, 0.15, 0.1, 1.0); // Dark brown dirt
            ps.color2 = new BABYLON.Color4(0.15, 0.1, 0.05, 1.0);
            ps.colorDead = new BABYLON.Color4(0.1, 0.05, 0.02, 0.0);
            ps.minSize = 0.08;
            ps.maxSize = 0.25;
            ps.minLifeTime = 0.4;
            ps.maxLifeTime = 0.8;
            ps.emitRate = 300;
            ps.targetStopDuration = 0.15;
            ps.gravity = new BABYLON.Vector3(0, -12.0, 0); // Heavy gravity
            ps.direction1 = new BABYLON.Vector3(-0.5, 3.0, -0.5); // Explode upwards
            ps.direction2 = new BABYLON.Vector3(0.5, 5.0, 0.5);
            ps.minAngularSpeed = -Math.PI;
            ps.maxAngularSpeed = Math.PI;
            ps.disposeOnStop = false;
            this.dirtBurstPSPool.push(ps);
        }
    }

    private initZombieExplosionPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < ParticleManager.MAX_ZOMBIE_EXPLOSIONS; i++) {
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
        for (let i = 0; i < ParticleManager.MAX_HEAD_EXPLOSIONS; i++) {
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
        for (let i = 0; i < ParticleManager.MAX_HOUND_EXPLOSIONS; i++) {
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

    private initSpawnEffectPool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < ParticleManager.MAX_SPAWN_EFFECT_PS; i++) {
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
        for (let i = 0; i < ParticleManager.MAX_SPAWN_SMOKE_PS; i++) {
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

    private initHoleSmokePool() {
        const tex = this.resourceManager.getTexture("https://playground.babylonjs.com/textures/flare.png");
        for (let i = 0; i < ParticleManager.MAX_HOLE_SMOKE_PS; i++) {
            const ps = new BABYLON.ParticleSystem(`holeSmoke_${i}`, 15, this.scene);
            ps.particleTexture = tex;
            // Red-orange hellish glow
            ps.color1 = new BABYLON.Color4(0.8, 0.15, 0.05, 0.4);
            ps.color2 = new BABYLON.Color4(0.5, 0.08, 0.02, 0.3);
            ps.colorDead = new BABYLON.Color4(0.15, 0.0, 0.0, 0);
            ps.minSize = 0.4; ps.maxSize = 1.0;
            ps.minLifeTime = 1.2; ps.maxLifeTime = 2.5;
            ps.emitRate = 8;
            // Sphere emitter for round, organic spread instead of square box
            ps.createSphereEmitter(0.5);
            // Slow upward drift with slight spread
            ps.direction1 = new BABYLON.Vector3(-0.15, 0.3, -0.15);
            ps.direction2 = new BABYLON.Vector3(0.15, 0.8, 0.15);
            ps.minEmitPower = 0.2; ps.maxEmitPower = 0.5;
            ps.gravity = new BABYLON.Vector3(0, 0.1, 0); // slight updraft
            ps.minAngularSpeed = -0.5;
            ps.maxAngularSpeed = 0.5;
            // Additive blending for glowing effect
            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
            ps.disposeOnStop = false;
            // Don't auto-start — these are positioned and started by startHoleSmoke()
            this.holeSmokePSPool.push(ps);
        }
    }

    public createWoodDebris(pos: BABYLON.Vector3) {
        const idx = this.debrisPSCursor % ParticleManager.MAX_DEBRIS_PS;
        this.debrisPSCursor++;
        const ps = this.debrisPSPool[idx];
        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }
        ps.emitter = pos;
        ps.start();
    }

    public createDirtBurst(pos: BABYLON.Vector3) {
        const idx = this.dirtBurstPSCursor % ParticleManager.MAX_DIRT_BURST_PS;
        this.dirtBurstPSCursor++;
        const ps = this.dirtBurstPSPool[idx];
        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }
        ps.emitter = pos;
        ps.start();
    }

    public createImpactParticles(pos: BABYLON.Vector3, normal: BABYLON.Vector3) {
        const idx = this.impactPSCursor % ParticleManager.MAX_IMPACT_PS;
        this.impactPSCursor++;
        const ps = this.impactPSPool[idx];
        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }
        ps.emitter = pos;
        const nx = normal.x * 1.5, ny = normal.y * 1.5, nz = normal.z * 1.5;
        ps.direction1.set(nx + 0.2, ny + 0.2, nz + 0.2);
        ps.direction2.set(nx - 0.2, ny - 0.2, nz - 0.2);
        ps.start();
    }

    public createBloodSplatterParticles(pos: BABYLON.Vector3, normal: BABYLON.Vector3) {
        const idx = this.bloodPSCursor % ParticleManager.MAX_BLOOD_PS;
        this.bloodPSCursor++;
        const ps = this.bloodPSPool[idx];
        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }
        ps.emitter = pos;
        const nx = normal.x * 2, ny = normal.y * 2, nz = normal.z * 2;
        ps.direction1.set(nx + 0.5, ny + 0.5, nz + 0.5);
        ps.direction2.set(nx - 0.5, ny - 0.5, nz - 0.5);
        ps.start();
    }

    private _fireZombieExplosionParticles(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        const bx = hitDir ? -hitDir.x : 0;
        const by = hitDir ? Math.max(-hitDir.y + 0.8, 0.5) : 1.0;
        const bz = hitDir ? -hitDir.z : 0;

        ParticleManager._scratchOrigin.set(pos.x, pos.y + 0.8, pos.z);

        const idx = this.zombieExplosionCursor % ParticleManager.MAX_ZOMBIE_EXPLOSIONS;
        this.zombieExplosionCursor++;

        const burst = this.burstPSPool[idx];
        if (burst.isStarted()) { burst.stop(); burst.reset(); }
        burst.emitter = ParticleManager._scratchOrigin;
        burst.direction1.set(bx - 0.9, by - 0.3, bz - 0.9);
        burst.direction2.set(bx + 0.9, by + 1.2, bz + 0.9);
        burst.start();

        const mist = this.mistPSPool[idx];
        if (mist.isStarted()) { mist.stop(); mist.reset(); }
        mist.emitter = ParticleManager._scratchOrigin;
        mist.start();

        const chunks = this.chunksPSPool[idx];
        if (chunks.isStarted()) { chunks.stop(); chunks.reset(); }
        chunks.emitter = ParticleManager._scratchOrigin;
        chunks.direction1.set(bx - 1.5, by + 0.5, bz - 1.5);
        chunks.direction2.set(bx + 1.5, by + 3.0, bz + 1.5);
        chunks.start();
    }

    public createZombieExplosionParticles(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        if (this.zombieExplosionFrameCount < ParticleManager.MAX_ZOMBIE_EXPLOSIONS_PER_FRAME) {
            this.zombieExplosionFrameCount++;
            this._fireZombieExplosionParticles(pos, hitDir);
        } else {
            // Queue for subsequent frames — positions copied as scalars to avoid stale mesh refs
            this.zombieExplosionQueue.push({
                x: pos.x, y: pos.y, z: pos.z,
                hx: hitDir ? hitDir.x : 0,
                hy: hitDir ? hitDir.y : 0,
                hz: hitDir ? hitDir.z : 0,
                hasHit: hitDir !== undefined
            });
        }
    }

    public createHeadExplosionParticles(pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3): void {
        const bx = hitDir ? -hitDir.x : 0;
        const by = hitDir ? Math.max(-hitDir.y + 1.2, 1.0) : 1.5;
        const bz = hitDir ? -hitDir.z : 0;

        ParticleManager._scratchOrigin.set(pos.x, pos.y, pos.z);

        const idx = this.zombieExplosionCursor % ParticleManager.MAX_ZOMBIE_EXPLOSIONS;
        const hIdx = this.headExplosionCursor % ParticleManager.MAX_HEAD_EXPLOSIONS;
        this.zombieExplosionCursor++;
        this.headExplosionCursor++;

        const burst = this.burstPSPool[idx];
        if (burst.isStarted()) { burst.stop(); burst.reset(); }
        burst.emitter = ParticleManager._scratchOrigin;
        burst.direction1.set(bx - 0.7, by, bz - 0.7);
        burst.direction2.set(bx + 0.7, by + 1.5, bz + 0.7);
        burst.start();

        const brain = this.brainPSPool[hIdx];
        if (brain.isStarted()) { brain.stop(); brain.reset(); }
        brain.emitter = ParticleManager._scratchOrigin;
        brain.direction1.set(bx - 2, by + 0.5, bz - 2);
        brain.direction2.set(bx + 2, by + 4, bz + 2);
        brain.start();

        const mist = this.mistPSPool[idx];
        if (mist.isStarted()) { mist.stop(); mist.reset(); }
        mist.emitter = ParticleManager._scratchOrigin;
        mist.start();
    }

    public createHellhoundDeathExplosion(pos: BABYLON.Vector3) {
        const idx = this.houndExplosionCursor % ParticleManager.MAX_HOUND_EXPLOSIONS;
        this.houndExplosionCursor++;
        const ps = this.houndExplosionPSPool[idx];
        if (ps.isStarted()) { ps.stop(); ps.reset(); }
        ps.emitter = pos;
        ps.start();
        this.acquireFlashLight(pos, 1.0, 0.4, 0.1);
    }

    public createSpawnEffect(pos: BABYLON.Vector3) {
        const idx = this.spawnEffectCursor % ParticleManager.MAX_SPAWN_EFFECT_PS;
        this.spawnEffectCursor++;
        const ps = this.spawnEffectPSPool[idx];
        if (ps.isStarted()) { ps.stop(); ps.reset(); }
        ps.emitter = pos;
        ps.start();
    }

    public createSpawnSmokeEffect(pos: BABYLON.Vector3): BABYLON.ParticleSystem {
        const idx = this.spawnSmokeCursor % ParticleManager.MAX_SPAWN_SMOKE_PS;
        this.spawnSmokeCursor++;
        const ps = this.spawnSmokePSPool[idx];
        if (ps.isStarted()) { ps.stop(); ps.reset(); }
        ps.emitter = pos;
        ps.start();
        return ps;
    }

    /**
     * Start persistent ambient smoke on all ground spawn holes.
     * One ParticleSystem per position, capped at MAX_HOLE_SMOKE_PS.
     * Very low overhead: ~8 emitRate × 15 capacity per hole.
     */
    public startHoleSmoke(positions: BABYLON.Vector3[]): void {
        this.stopHoleSmoke();
        const count = Math.min(positions.length, ParticleManager.MAX_HOLE_SMOKE_PS);
        for (let i = 0; i < count; i++) {
            const ps = this.holeSmokePSPool[i];
            ps.emitter = positions[i];
            ps.start();
        }
        this.activeHoleSmokeCount = count;
    }

    /** Stop all persistent hole smoke particle systems. */
    public stopHoleSmoke(): void {
        for (let i = 0; i < this.activeHoleSmokeCount; i++) {
            const ps = this.holeSmokePSPool[i];
            if (ps.isStarted()) { ps.stop(); ps.reset(); }
        }
        this.activeHoleSmokeCount = 0;
    }

    /** Enable or disable hole smoke at a specific position. */
    public setHoleSmokeEnabled(pos: BABYLON.Vector3, enabled: boolean): void {
        for (let i = 0; i < this.activeHoleSmokeCount; i++) {
            const ps = this.holeSmokePSPool[i];
            if (ps.emitter && (ps.emitter as BABYLON.Vector3).equalsWithEpsilon(pos, 0.1)) {
                ps.emitRate = enabled ? 8 : 0;
            }
        }
    }

    public createPlasmaExplosion(pos: BABYLON.Vector3, isPacked: boolean = false) {
        const idx = this.explosionPSCursor % ParticleManager.MAX_EXPLOSION_PS;
        this.explosionPSCursor++;
        const ps = this.explosionPSPool[idx];
        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }
        ps.emitter = pos;
        if (isPacked) {
            ps.color1 = ParticleManager._colorPacked;
            ps.color2 = ParticleManager._colorPacked2;
        } else {
            ps.color1 = ParticleManager._colorNormal;
            ps.color2 = ParticleManager._colorNormal2;
        }
        ps.colorDead = ParticleManager._colorDead;
        ps.start();

        const c = isPacked ? ParticleManager._colorPacked : ParticleManager._colorNormal;
        this.acquireFlashLight(pos, c.r, c.g, c.b);
    }

    public createProjectileTrail(mesh: BABYLON.AbstractMesh, isPacked: boolean = false): BABYLON.ParticleSystem {
        const idx = this.trailPSCursor % ParticleManager.MAX_TRAIL_PS;
        this.trailPSCursor++;
        const ps = this.trailPSPool[idx];
        if (ps.isStarted()) {
            ps.stop();
            ps.reset();
        }
        ps.emitter = mesh;
        if (isPacked) {
            ps.color1 = ParticleManager._trailColorPacked;
            ps.color2 = ParticleManager._trailColorPacked2;
        } else {
            ps.color1 = ParticleManager._trailColorNormal;
            ps.color2 = ParticleManager._trailColorNormal2;
        }
        ps.colorDead = ParticleManager._colorDead;
        ps.start();
        return ps;
    }

    public stopProjectileTrail(ps: BABYLON.ParticleSystem) {
        if (!ps) return;
        if (ps.emitter instanceof BABYLON.AbstractMesh) {
            ps.emitter = ps.emitter.position.clone();
        }
        ps.stop();
    }

    public reset() {
        this.flashLightPool.forEach(l => l.intensity = 0);
        this.flashLightFadeStart.fill(0);
        this.explosionPSPool.forEach(ps => { if (ps.isStarted()) ps.stop(); ps.reset(); });
        this.trailPSPool.forEach(ps => { if (ps.isStarted()) ps.stop(); ps.reset(); });
        this.impactPSPool.forEach(ps => { if (ps.isStarted()) ps.stop(); ps.reset(); });
        this.bloodPSPool.forEach(ps => { if (ps.isStarted()) ps.stop(); ps.reset(); });
        this.debrisPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.dirtBurstPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.burstPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.mistPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.chunksPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.brainPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.zombieExplosionQueue.length = 0;
        this.zombieExplosionFrameCount = 0;
        this.houndExplosionPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.spawnEffectPSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.spawnSmokePSPool.forEach(ps => { if (ps.isStarted()) { ps.stop(); ps.reset(); } });
        this.stopHoleSmoke();
    }

    public dispose() {
        if (this.flashLightFadeObserver) {
            this.scene.onBeforeRenderObservable.remove(this.flashLightFadeObserver);
            this.flashLightFadeObserver = null;
        }
        for (let i = 0; i < this.flashLightPool.length; i++) {
            this.flashLightPool[i].dispose();
        }
        this.flashLightPool = [];
        this.flashLightFadeStart = [];

        for (const ps of this.explosionPSPool) { ps.dispose(false); }
        this.explosionPSPool = [];
        for (const ps of this.trailPSPool) { ps.dispose(false); }
        this.trailPSPool = [];
        for (const ps of this.impactPSPool) { ps.dispose(false); }
        this.impactPSPool = [];
        for (const ps of this.bloodPSPool) { ps.dispose(false); }
        this.bloodPSPool = [];
        for (const ps of this.debrisPSPool) { ps.dispose(false); }
        this.debrisPSPool = [];
        for (const ps of this.dirtBurstPSPool) { ps.dispose(false); }
        this.dirtBurstPSPool = [];
        for (const ps of this.burstPSPool) { ps.dispose(false); }
        this.burstPSPool = [];
        for (const ps of this.mistPSPool) { ps.dispose(false); }
        this.mistPSPool = [];
        for (const ps of this.chunksPSPool) { ps.dispose(false); }
        this.chunksPSPool = [];
        for (const ps of this.brainPSPool) { ps.dispose(false); }
        this.brainPSPool = [];
        for (const ps of this.houndExplosionPSPool) { ps.dispose(false); }
        this.houndExplosionPSPool = [];
        for (const ps of this.spawnEffectPSPool) { ps.dispose(false); }
        this.spawnEffectPSPool = [];
        for (const ps of this.spawnSmokePSPool) { ps.dispose(false); }
        this.spawnSmokePSPool = [];
        for (const ps of this.holeSmokePSPool) { ps.dispose(false); }
        this.holeSmokePSPool = [];
        this.activeHoleSmokeCount = 0;
    }
}
