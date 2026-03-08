import * as BABYLON from '@babylonjs/core';
import { createZombieMesh, ZombieMeshResult, preWarmTemplates } from '../meshes';
import { Zombie, ZombieState, WindowBarrier, GroundSpawn, GameStateData, GameMessage } from '../types/index';

import { ZoneSystem } from '../systems/ZoneSystem';
import { MapConfigManager } from './MapConfigManager';
import { ResourceManager } from './ResourceManager';
import { EventBus } from '../engine/EventBus';

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
    private spawnPowerUpCallback: ((pos: BABYLON.Vector3) => void) | null = null;

    private addPointsCallback: ((amount: number) => void) | null = null;
    private sendNetworkMessage: ((msg: GameMessage) => void) | null = null;
    private setKillsCallback: ((kills: number) => void) | null = null;
    private lastSpawnSoundTime: number = 0;

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
        for (const gs of this.groundSpawns) {
            if (!this.groundSpawnsByZone.has(gs.zone)) {
                this.groundSpawnsByZone.set(gs.zone, []);
            }
            this.groundSpawnsByZone.get(gs.zone)!.push(gs);
        }
    }


    public setDependencies(
        spawnPowerUp: (pos: BABYLON.Vector3) => void, 
        addPoints: (amount: number) => void,
        send: (msg: GameMessage) => void,
        setKills: (kills: number) => void
    ) {
        this.spawnPowerUpCallback = spawnPowerUp;
        this.addPointsCallback = addPoints;
        this.sendNetworkMessage = send;
        this.setKillsCallback = setKills;
    }

    /**
     * Pre-initializes and compiles all materials and mesh templates used for zombies.
     */
    public async preWarmAssets() {
        const sm = this.scene;
        const rm = this.resourceManager;

        // 1. Pre-warm materials
        const bodyMat = rm.getMaterial("zombieBodyMat", () => {
            const mat = new BABYLON.StandardMaterial("zombieBodyMat", sm);
            mat.diffuseColor = new BABYLON.Color3(0.1, 0.18, 0.12);
            mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.02); 
            mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            mat.specularPower = 32;
            mat.maxSimultaneousLights = 8;
            return mat;
        });
        const headMat = rm.getMaterial("zombieHeadMat", () => {
            const mat = new BABYLON.StandardMaterial("zombieHeadMat", sm);
            mat.diffuseColor = new BABYLON.Color3(0.15, 0.2, 0.15);
            mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.02);
            mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            mat.maxSimultaneousLights = 8;
            return mat;
        });
        const eyeMat = rm.getMaterial("zombieEyeMat", () => {
            const mat = new BABYLON.StandardMaterial("zombieEyeMat", sm);
            mat.emissiveColor = new BABYLON.Color3(1, 1, 0.5);
            mat.specularColor = BABYLON.Color3.Black();
            mat.maxSimultaneousLights = 8;
            return mat;
        });

        // 2. Pre-warm Mesh Templates
        preWarmTemplates(sm, rm);

        // 3. Force compilation if a mesh is available
        const compilerMesh = sm.meshes[0];
        if (compilerMesh) {
            bodyMat.forceCompilation(compilerMesh);
            headMat.forceCompilation(compilerMesh);
            eyeMat.forceCompilation(compilerMesh);
        }
    }


    public onZombieDeath(z: Zombie, pos: BABYLON.Vector3, killer: 'HOST' | 'CLIENT' = 'HOST', isHeadshot: boolean = false, headPos?: BABYLON.Vector3, hitDir?: BABYLON.Vector3) {
         if (z.isDead) return;
         z.isDead = true;
         this.gameState.zombiesAlive--;
         
         const baseKillPts = this.configManager.gameplay.POINTS_KILL;
        if (killer === 'HOST') {
            this.gameState.kills++;
            if (this.setKillsCallback) this.setKillsCallback(this.gameState.kills);
            if (this.addPointsCallback) this.addPointsCallback(baseKillPts);
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

    public spawnZombieHost(currentRound: number) {
        const scene = this.scene;
        let spawnPos = new BABYLON.Vector3(0, 0, 0);
        let validSpawnFound = false;
        let selectedWindow: WindowBarrier | null = null;

        const gc = this.configManager.gameplay;
        const rc = this.configManager.round;
        const zs = this.configManager.zombieSpeeds;
        const zc = this.configManager.zombieAI;

        // Find windows in valid zones (Accessible from player location)
        const playerZone = this.getZone(this.camera.position);
        const accessibleZones = new Set(this.zoneSystem.getAccessibleZones(playerZone, this.gameState.doorStates));
        
        // Also add remote player's zones
        const remotePos = this.getRemotePlayerPos();
        if (remotePos && this.isConnected()) {
            const rZone = this.getZone(remotePos);
            const rAccessible = this.zoneSystem.getAccessibleZones(rZone, this.gameState.doorStates);
            rAccessible.forEach(z => accessibleZones.add(z));
        }

        // Handle case where zone maps might not be initialized yet
        if (this.windowsByZone.size === 0 && this.windows.length > 0) {
            this.initWindowsByZone();
        }
        if (this.groundSpawnsByZone.size === 0 && this.groundSpawns.length > 0) {
            this.initGroundSpawnsByZone();
        }

        // Collect valid windows from accessible zones
        const validWindows: WindowBarrier[] = [];
        accessibleZones.forEach(zoneId => {
            const zoneWindows = this.windowsByZone.get(zoneId);
            if (zoneWindows) {
                validWindows.push(...zoneWindows);
            }
        });

        let spawnSourceType: 'window' | 'ground' = 'window';

        // Collect valid ground spawns from accessible zones
        const validGroundSpawns: GroundSpawn[] = [];
        accessibleZones.forEach(zoneId => {
            const zoneHoles = this.groundSpawnsByZone.get(zoneId);
            if (zoneHoles) {
                validGroundSpawns.push(...zoneHoles);
            }
        });

        // Pick randomly from all valid spawn points (windows + ground holes)
        const totalSpawnPoints = validWindows.length + validGroundSpawns.length;
        if (totalSpawnPoints > 0) {
            const pick = Math.floor(Math.random() * totalSpawnPoints);
            if (pick < validWindows.length) {
                // Window spawn
                const w = validWindows[pick];
                spawnPos = w.spawnPoint.clone();
                spawnPos.x += (Math.random() - 0.5);
                spawnPos.z += (Math.random() - 0.5);
                validSpawnFound = true;
                selectedWindow = w;
                spawnSourceType = 'window';
            } else {
                // Ground hole spawn
                const gs = validGroundSpawns[pick - validWindows.length];
                spawnPos = gs.position.clone();
                spawnPos.x += (Math.random() - 0.5);
                spawnPos.z += (Math.random() - 0.5);
                validSpawnFound = true;
                selectedWindow = null;
                spawnSourceType = 'ground';
            }
        }
        
        if (validSpawnFound) {
             const id = "zombie_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
             
             const newZ = createZombieMesh(scene, spawnPos, this.resourceManager);

             const baseSpeed = zs.WALKER + (currentRound * rc.ZOMBIE_SPEED_INC);
             const speedVariation = 0.9 + (Math.random() * 0.2); // 90% to 110% of base speed
             
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
             
             // Play spawn sound with cooldown - only play if sound isn't already playing
             const now = Date.now();
             if (this.soundManager && 
                 now - this.lastSpawnSoundTime >= zc.SPAWN_SOUND_COOLDOWN_MS &&
                 !this.soundManager.isPlaying('zombie_spawn')) {
                 const distToPlayer = BABYLON.Vector3.Distance(spawnPos, this.camera.position);
                 if (distToPlayer <= zc.SPAWN_SOUND_MAX_DIST) {
                     this.soundManager.play('zombie_spawn', { volume: zc.SPAWN_SOUND_VOLUME });
                     this.lastSpawnSoundTime = now;
                     console.log(`[ZombieManager] Played spawn sound, cooldown set: ${zc.SPAWN_SOUND_COOLDOWN_MS}ms`);
                 }
             }

             if (selectedWindow) {
                 zEntity.state = ZombieState.APPROACHING_WINDOW;
             } else {
                 zEntity.state = ZombieState.CHASING;
             }

             if (zEntity.speed > zs.SUPER_SPRINTER) zEntity.speed = zs.SUPER_SPRINTER;

             this.zombies.push(zEntity);
        }
    }
}
