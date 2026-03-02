import * as BABYLON from '@babylonjs/core';
import { createZombieMesh, ZombieMeshResult } from '../meshes';
import { Zombie, ZombieState, WindowBarrier, GameStateData, GameMessage } from '../types/index';
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
        private camera: BABYLON.UniversalCamera,
        private getZone: (pos: BABYLON.Vector3) => number,
        private createSpawnEffect: (pos: BABYLON.Vector3) => void,
        private createExplosion: (pos: BABYLON.Vector3) => void,
        private createHeadExplosion: ((pos: BABYLON.Vector3) => void) | null = null,
        private getRemotePlayerPos: () => BABYLON.Vector3 | null,
        private isConnected: () => boolean,
        private zoneSystem: ZoneSystem,
        private configManager: MapConfigManager,
        private resourceManager: ResourceManager,
        private eventBus: EventBus,
        private soundManager: SoundManager | null
    ) {
        this.windows = windows;
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
     * Pre-initializes and compiles all materials used for zombies.
     */
    public async preWarmAssets() {
        const sm = this.scene;
        const rm = this.resourceManager;

        // Force creation/caching of zombie materials
        rm.getMaterial("zombieBodyMat", () => {
            const mat = new BABYLON.StandardMaterial("zombieBodyMat", sm);
            mat.diffuseColor = new BABYLON.Color3(0.1, 0.18, 0.12);
            mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.02); 
            mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            mat.specularPower = 32;
            mat.maxSimultaneousLights = 8;
            return mat;
        });
        rm.getMaterial("zombieHeadMat", () => {
            const mat = new BABYLON.StandardMaterial("zombieHeadMat", sm);
            mat.diffuseColor = new BABYLON.Color3(0.15, 0.2, 0.15);
            mat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.02);
            mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            mat.maxSimultaneousLights = 8;
            return mat;
        });
        rm.getMaterial("zombieEyeMat", () => {
            const mat = new BABYLON.StandardMaterial("zombieEyeMat", sm);
            mat.emissiveColor = new BABYLON.Color3(1, 1, 0.5);
            mat.specularColor = BABYLON.Color3.Black();
            mat.maxSimultaneousLights = 8;
            return mat;
        });
    }

    public onZombieDeath(z: Zombie, pos: BABYLON.Vector3, killer: 'HOST' | 'CLIENT' = 'HOST', isHeadshot: boolean = false, headPos?: BABYLON.Vector3) {
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
             this.createHeadExplosion(headPos);
         } else {
             this.createExplosion(pos);
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

        const validWindows = this.windows.filter(w => accessibleZones.has(w.zone));
        
        if (validWindows.length > 0) {
                const w = validWindows[Math.floor(Math.random() * validWindows.length)];
                spawnPos = w.spawnPoint.clone();
                spawnPos.x += (Math.random() - 0.5); 
                spawnPos.z += (Math.random() - 0.5); 
                validSpawnFound = true;
                selectedWindow = w;
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

             this.createSpawnEffect(spawnPos);
             
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
