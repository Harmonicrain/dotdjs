import * as BABYLON from '@babylonjs/core';
import { createZombieMesh, ZombieMeshResult, preWarmTemplates } from '../factories';
import { Zombie, ZombieState, WindowBarrier, GroundSpawn, GameStateData, GameMessage } from '../types/index';

import { ZoneSystem } from '../systems/ZoneSystem';
import { MapConfigManager } from './MapConfigManager';
import { ResourceManager } from './ResourceManager';
import { EventBus } from '../engine/EventBus';
import { tagZombieMeshes } from '../systems/zombie/zombieAIUtils';

import { SoundManager } from './SoundManager';

/**
 * ZombieManager
 *
 * Responsible for spawning zombies on the HOST and recording kills.
 * Spawn logic uses the ZoneSystem to restrict spawns to zones that are
 * currently reachable by at least one player.
 */
export class ZombieManager {
    public windows: WindowBarrier[];
    private windowsByZone: Map<number, WindowBarrier[]> = new Map();
    public groundSpawns: GroundSpawn[];
    private groundSpawnsByZone: Map<number, GroundSpawn[]> = new Map();
    private groundSpawnById: Map<string, GroundSpawn> = new Map();
    private spawnPowerUpCallback: ((pos: BABYLON.Vector3) => void) | null = null;

    private addPointsCallback: ((amount: number) => void) | null = null;
    private sendNetworkMessage: ((msg: GameMessage) => void) | null = null;
    private setKillsCallback: ((kills: number) => void) | null = null;
    private pushKillEventCallback: ((event: import('../store/useGameStore').KillEvent) => void) | null = null;
    private lastSpawnSoundTime: number = 0;
    private pendingSpawnQueue: { round: number }[] = [];

    // ── Cached spawn-point arrays (rebuilt only when door state changes) ──
    private cachedValidWindows: WindowBarrier[] = [];
    private cachedValidGroundSpawns: GroundSpawn[] = [];
    private cachedDoorStateKey: string = '\x00UNINITIALIZED';
    private static readonly _scratchSpawnPos = new BABYLON.Vector3();
    private static readonly _scratchAccessible = new Set<number>();

    constructor(
        private scene: BABYLON.Scene,
        private gameState: GameStateData,
        private zombies: Zombie[],
        windows: WindowBarrier[],
        groundSpawns: GroundSpawn[],
        private camera: BABYLON.UniversalCamera,
        private getZone: (pos: BABYLON.Vector3) => number,
        private createSpawnEffect: (pos: BABYLON.Vector3, type: 'window' | 'ground') => void,
        private createExplosion: (pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3) => void,
        private createHeadExplosion: ((pos: BABYLON.Vector3, hitDir?: BABYLON.Vector3) => void) | null = null,
        private getRemotePlayerPos: () => BABYLON.Vector3 | null,
        private isConnected: () => boolean,
        private zoneSystem: ZoneSystem,
        private configManager: MapConfigManager,
        private resourceManager: ResourceManager,
        private eventBus: EventBus,
        private soundManager: SoundManager | null
    ) {
        this.windows = windows;
        this.groundSpawns = groundSpawns;
        this.initWindowsByZone();
        this.initGroundSpawnsByZone();
    }

    private initWindowsByZone() {
        this.windowsByZone.clear();
        for (const w of this.windows) {
            if (!this.windowsByZone.has(w.zone)) {
                this.windowsByZone.set(w.zone, []);
            }
            this.windowsByZone.get(w.zone)!.push(w);
        }
    }

    private initGroundSpawnsByZone() {
        this.groundSpawnsByZone.clear();
        this.groundSpawnById.clear();
        for (const gs of this.groundSpawns) {
            if (!this.groundSpawnsByZone.has(gs.zone)) {
                this.groundSpawnsByZone.set(gs.zone, []);
            }
            this.groundSpawnsByZone.get(gs.zone)!.push(gs);
            this.groundSpawnById.set(gs.id, gs);
        }
    }


    public setDependencies(
        spawnPowerUp: (pos: BABYLON.Vector3) => void,
        addPoints: (amount: number) => void,
        send: (msg: GameMessage) => void,
        setKills: (kills: number) => void,
        pushKillEvent?: (event: import('../store/useGameStore').KillEvent) => void
    ) {
        this.spawnPowerUpCallback = spawnPowerUp;
        this.addPointsCallback = addPoints;
        this.sendNetworkMessage = send;
        this.setKillsCallback = setKills;
        this.pushKillEventCallback = pushKillEvent ?? null;
    }

    /**
     * Pre-initializes and compiles all materials and mesh templates used for zombies.
     */
    public async preWarmAssets() {
        const sm = this.scene;
        const rm = this.resourceManager;

        preWarmTemplates(sm, rm);

        const bodyMat = rm.getMaterial("zombieBodyMat", () => new BABYLON.StandardMaterial("zombieBodyMat", sm));
        const clothesMat = rm.getMaterial("zombieClothesMat", () => new BABYLON.StandardMaterial("zombieClothesMat", sm));
        const headMat = rm.getMaterial("zombieHeadMat", () => new BABYLON.StandardMaterial("zombieHeadMat", sm));
        const eyeMat = rm.getMaterial("zombieEyeMat", () => new BABYLON.StandardMaterial("zombieEyeMat", sm));
        const boneMat = rm.getMaterial("zombieBoneMat", () => new BABYLON.StandardMaterial("zombieBoneMat", sm));

        const compilerMesh = sm.meshes[0];
        if (compilerMesh) {
            bodyMat.forceCompilation(compilerMesh);
            clothesMat.forceCompilation(compilerMesh);
            headMat.forceCompilation(compilerMesh);
            eyeMat.forceCompilation(compilerMesh);
            boneMat.forceCompilation(compilerMesh);
        }
    }


    public onZombieDeath(z: Zombie, pos: BABYLON.Vector3, killer: 'HOST' | 'CLIENT' = 'HOST', isHeadshot: boolean = false, headPos?: BABYLON.Vector3, hitDir?: BABYLON.Vector3) {
        if (z.isDead) return;
        z.isDead = true;
        this.gameState.zombiesAlive--;

        // If this zombie was occupying a ground spawn hole (killed mid-emergence),
        // release it now so the next queued zombie can come through.
        if (z.spawnHoleId) {
            this.releaseGroundSpawnHole(z.spawnHoleId);
            z.spawnHoleId = undefined;
        }

        const baseKillPts = this.configManager.gameplay.POINTS_KILL;
        if (killer === 'HOST') {
            this.gameState.kills++;
            if (this.setKillsCallback) this.setKillsCallback(this.gameState.kills);
            if (this.addPointsCallback) this.addPointsCallback(baseKillPts);
            if (this.pushKillEventCallback) {
                this.pushKillEventCallback({
                    id: z.id,
                    enemyType: 'zombie',
                    isHeadshot,
                    points: baseKillPts + (isHeadshot ? this.configManager.gameplay.POINTS_HEADSHOT : 0),
                    timestamp: Date.now(),
                });
            }
        } else if (this.sendNetworkMessage) {
            this.sendNetworkMessage({ type: 'HIT_CONFIRM', amount: baseKillPts });
        }

        this.gameState.lastDeathPos = pos;
        this.eventBus.emit('ZOMBIE_DEATH', { id: z.id, position: pos });

        if (isHeadshot && headPos && z.type === 'ZOMBIE' && this.createHeadExplosion) {
            this.createHeadExplosion(headPos, hitDir);
        } else {
            this.createExplosion(pos, hitDir);
        }

        if (this.spawnPowerUpCallback && Math.random() < this.configManager.powerUps.DROP_CHANCE) {
            this.spawnPowerUpCallback(pos);
        }
    }

    /**
     * Builds a compact key from door open/closed states so we can detect
     * when the spawn-point cache needs rebuilding.
     */
    private buildDoorStateKey(): string {
        const ds = this.gameState.doorStates;
        let key = '';
        for (const id in ds) {
            if (ds[id]?.isOpen) key += id;
        }
        return key;
    }

    /**
     * Rebuilds the cached valid-windows and valid-ground-spawns arrays.
     * Called only when door-state changes (detected via key comparison).
     */
    private rebuildSpawnCache(): void {
        // Ensure zone maps are initialized
        if (this.windowsByZone.size === 0 && this.windows.length > 0) this.initWindowsByZone();
        if (this.groundSpawnsByZone.size === 0 && this.groundSpawns.length > 0) this.initGroundSpawnsByZone();

        const accessible = ZombieManager._scratchAccessible;
        accessible.clear();

        // Local player zones
        const playerZone = this.getZone(this.camera.position);
        const pZones = this.zoneSystem.getAccessibleZones(playerZone, this.gameState.doorStates);
        for (let i = 0; i < pZones.length; i++) accessible.add(pZones[i]);

        // Remote player zones
        const remotePos = this.getRemotePlayerPos();
        if (remotePos && this.isConnected()) {
            const rZone = this.getZone(remotePos);
            const rZones = this.zoneSystem.getAccessibleZones(rZone, this.gameState.doorStates);
            for (let i = 0; i < rZones.length; i++) accessible.add(rZones[i]);
        }

        // Rebuild valid windows (reuse array, clear + push instead of new array + spread)
        this.cachedValidWindows.length = 0;
        accessible.forEach(zoneId => {
            const zw = this.windowsByZone.get(zoneId);
            if (zw) for (let i = 0; i < zw.length; i++) this.cachedValidWindows.push(zw[i]);
        });

        // Rebuild valid ground spawns
        this.cachedValidGroundSpawns.length = 0;
        accessible.forEach(zoneId => {
            const gh = this.groundSpawnsByZone.get(zoneId);
            if (gh) for (let i = 0; i < gh.length; i++) this.cachedValidGroundSpawns.push(gh[i]);
        });

        this.cachedDoorStateKey = this.buildDoorStateKey();
    }

    public spawnZombieHost(currentRound: number) {
        const scene = this.scene;
        const spawnPos = ZombieManager._scratchSpawnPos;
        spawnPos.set(0, 0, 0);
        let validSpawnFound = false;
        let selectedWindow: WindowBarrier | null = null;

        const gc = this.configManager.gameplay;
        const rc = this.configManager.round;
        const zs = this.configManager.zombieSpeeds;
        const zc = this.configManager.zombieAI;

        // Rebuild spawn cache when door states change OR when the map has been reloaded
        // (same-map reload produces new GroundSpawn instances with the same IDs)
        const currentKey = this.buildDoorStateKey();
        
        const groundSpawnsStale = (this.groundSpawns.length > 0 && this.groundSpawnById.get(this.groundSpawns[0].id) !== this.groundSpawns[0]) || 
                                  (this.groundSpawns.length === 0 && this.groundSpawnsByZone.size > 0);
        
        let windowsStale = false;
        if (this.windows.length > 0) {
            const firstWindow = this.windows[0];
            const cachedZoneWindows = this.windowsByZone.get(firstWindow.zone);
            windowsStale = !cachedZoneWindows || cachedZoneWindows[0] !== firstWindow;
        } else if (this.windowsByZone.size > 0) {
            windowsStale = true;
        }

        const isMapStale = groundSpawnsStale || windowsStale;

        if (currentKey !== this.cachedDoorStateKey || isMapStale) {
            if (isMapStale) {
                // Map was reloaded — force re-init of zone/id maps so we don't
                // hold stale GroundSpawn references (wrong hasLid, lingering queues)
                this.initWindowsByZone();
                this.initGroundSpawnsByZone();
            }
            this.rebuildSpawnCache();
        }

        const validWindows = this.cachedValidWindows;
        const validGroundSpawns = this.cachedValidGroundSpawns;

        let spawnSourceType: 'window' | 'ground' = 'window';

        // Pick randomly from all valid spawn points (windows + ground holes)
        const totalSpawnPoints = validWindows.length + validGroundSpawns.length;
        if (totalSpawnPoints > 0) {
            const pick = Math.floor(Math.random() * totalSpawnPoints);
            if (pick < validWindows.length) {
                // Window spawn — copy instead of clone
                const w = validWindows[pick];
                spawnPos.copyFrom(w.spawnPoint);
                spawnPos.x += (Math.random() - 0.5);
                spawnPos.z += (Math.random() - 0.5);
                validSpawnFound = true;
                selectedWindow = w;
                spawnSourceType = 'window';
            } else {
                // Ground hole spawn — one zombie per hole at a time
                const gs = validGroundSpawns[pick - validWindows.length];
                if (gs.occupyingZombieId) {
                    // Hole is busy — queue this spawn and return
                    if (!gs.spawnQueue) gs.spawnQueue = [];
                    gs.spawnQueue.push({ round: currentRound });
                } else {
                    this._createZombieAtHole(gs, currentRound);
                }
                return; // ground path is fully handled (queued or created)
            }
        } else {
            // FALLBACK: If no windows or holes, use zone spawn bounds (e.g. for open test maps)
            const playerZone = this.getZone(this.camera.position);
            const randomPoint = this.zoneSystem.getRandomSpawnPoint(playerZone);
            if (randomPoint) {
                spawnPos.copyFrom(randomPoint);
                validSpawnFound = true;
                selectedWindow = null;
                spawnSourceType = 'window'; // Treat as window/default so it doesn't start underground
            }
        }

        if (validSpawnFound) {
            const id = "zombie_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);

            const newZ = createZombieMesh(scene, spawnPos, this.resourceManager);

            const baseSpeed = zs.WALKER + (currentRound * rc.ZOMBIE_SPEED_INC);
            const speedVariation = zc.SPEED_VARIATION_MIN + (Math.random() * zc.SPEED_VARIATION_RANGE); // 90%–110% of base speed

            const zEntity: Zombie = {
                id: id,
                type: 'ZOMBIE',
                mesh: newZ.mesh,
                headMesh: newZ.head,
                torsoMesh: newZ.torso,
                limbs: newZ.limbs,
                health: gc.ZOMBIE_HEALTH_BASE + (gc.ZOMBIE_HEALTH_INC * (currentRound - 1)),
                maxHealth: gc.ZOMBIE_HEALTH_BASE + (gc.ZOMBIE_HEALTH_INC * (currentRound - 1)),
                speed: baseSpeed * speedVariation,
                lastAttackTime: 0,
                isDead: false,
                state: ZombieState.SPAWNING,
                targetWindowId: selectedWindow ? selectedWindow.id : null,
                barrierAttackTimer: 0,
                isBurning: false,
                spawnTime: Date.now(),
                missingLimbs: {
                    legL: false,
                    legR: false,
                    armL: false,
                    armR: false
                }
            };

            this.createSpawnEffect(spawnPos, spawnSourceType);

            // Play spawn sound with cooldown
            const now = Date.now();
            if (this.soundManager &&
                now - this.lastSpawnSoundTime >= zc.SPAWN_SOUND_COOLDOWN_MS &&
                !this.soundManager.isPlaying('zombie_spawn')) {
                const distToPlayer = BABYLON.Vector3.Distance(spawnPos, this.camera.position);
                if (distToPlayer <= zc.SPAWN_SOUND_MAX_DIST) {
                    this.soundManager.play('zombie_spawn', { volume: zc.SPAWN_SOUND_VOLUME });
                    this.lastSpawnSoundTime = now;
                }
            }

            if (selectedWindow) {
                zEntity.state = ZombieState.APPROACHING_WINDOW;
            } else {
                zEntity.state = ZombieState.CHASING;
            }

            if (zEntity.speed > zs.SUPER_SPRINTER) zEntity.speed = zs.SUPER_SPRINTER;

            tagZombieMeshes(zEntity);
            this.zombies.push(zEntity);
        }
    }

    /**
     * Creates a zombie entity at a specific ground spawn hole and marks it occupied.
     * Also handles the spawn sound and visual effect.
     * Called both from spawnZombieHost (initial pick) and releaseGroundSpawnHole (queue processing).
     */
    private _createZombieAtHole(gs: GroundSpawn, round: number) {
        const gc = this.configManager.gameplay;
        const rc = this.configManager.round;
        const zs = this.configManager.zombieSpeeds;
        const zc = this.configManager.zombieAI;

        const id = "zombie_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
        const spawnPos = gs.position;

        const newZ = createZombieMesh(this.scene, spawnPos, this.resourceManager);

        const baseSpeed = zs.WALKER + (round * rc.ZOMBIE_SPEED_INC);
        const speedVariation = zc.SPEED_VARIATION_MIN + (Math.random() * zc.SPEED_VARIATION_RANGE);

        const zEntity: Zombie = {
            id: id,
            type: 'ZOMBIE',
            mesh: newZ.mesh,
            headMesh: newZ.head,
            torsoMesh: newZ.torso,
            limbs: newZ.limbs,
            health: gc.ZOMBIE_HEALTH_BASE + (gc.ZOMBIE_HEALTH_INC * (round - 1)),
            maxHealth: gc.ZOMBIE_HEALTH_BASE + (gc.ZOMBIE_HEALTH_INC * (round - 1)),
            speed: Math.min(baseSpeed * speedVariation, zs.SUPER_SPRINTER),
            lastAttackTime: 0,
            isDead: false,
            state: ZombieState.SPAWNING,
            targetWindowId: null,
            barrierAttackTimer: 0,
            isBurning: false,
            spawnTime: Date.now(),
            spawnHoleId: gs.id,
            missingLimbs: { legL: false, legR: false, armL: false, armR: false }
        };

        if (gs.hasLid) {
            zEntity.state = ZombieState.BREAKING_LID;
            zEntity.targetLidId = gs.id;
            zEntity.lidBreakTimer = 0;
        } else {
            zEntity.state = ZombieState.SPAWNING;
        }
        zEntity.mesh.position.y = -1.5;

        gs.occupyingZombieId = id;

        this.createSpawnEffect(spawnPos, 'ground');

        const now = Date.now();
        if (this.soundManager &&
            now - this.lastSpawnSoundTime >= zc.SPAWN_SOUND_COOLDOWN_MS &&
            !this.soundManager.isPlaying('zombie_spawn')) {
            const distToPlayer = BABYLON.Vector3.Distance(spawnPos, this.camera.position);
            if (distToPlayer <= zc.SPAWN_SOUND_MAX_DIST) {
                this.soundManager.play('zombie_spawn', { volume: zc.SPAWN_SOUND_VOLUME });
                this.lastSpawnSoundTime = now;
            }
        }

        tagZombieMeshes(zEntity);
        this.zombies.push(zEntity);
    }

    /**
     * Called by ZombieAISystem when a zombie finishes emerging from a ground hole
     * (SPAWNING → CHASING transition). Clears the hole's occupant and spawns the
     * next queued zombie if one is waiting. O(1) hole lookup via groundSpawnById.
     */
    public releaseGroundSpawnHole(holeId: string) {
        const gs = this.groundSpawnById.get(holeId);
        if (!gs) return;

        gs.occupyingZombieId = null;

        if (gs.spawnQueue && gs.spawnQueue.length > 0) {
            const next = gs.spawnQueue.shift()!;
            this._createZombieAtHole(gs, next.round);
        }
    }
}
