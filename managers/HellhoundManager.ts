import * as BABYLON from '@babylonjs/core';
import { createHellhoundMesh, ZombieMeshResult, preWarmTemplates } from '../meshes';
import { Zombie, ZombieState, HellhoundState, GameStateData, GameMessage, PowerUpType } from '../types/index';
import { ZoneSystem } from '../systems/ZoneSystem';
import { MapConfigManager } from './MapConfigManager';
import { ResourceManager } from './ResourceManager';
import { EventBus } from '../engine/EventBus';
import { VisualManager } from './VisualManager';

/**
 * HellhoundManager
 *
 * Responsible for spawning hellhounds on the HOST and recording kills.
 * Implements enhanced spawn behavior:
 * - Dogs spawn in a poof of smoke at height
 * - Fall down slowly (configurable duration)
 * - Land, then move/turn searching for players
 * - Once eye contact is made, chase and attack
 * - Dogs won't spawn on top of players
 */
export class HellhoundManager {
    private spawnPowerUpCallback: ((pos: BABYLON.Vector3, type?: PowerUpType) => void) | null = null;
    private addPointsCallback: ((amount: number) => void) | null = null;
    private sendNetworkMessage: ((msg: GameMessage) => void) | null = null;
    private setKillsCallback: ((kills: number) => void) | null = null;

    constructor(
        private scene: BABYLON.Scene,
        private gameState: GameStateData,
        private zombies: Zombie[],
        private camera: BABYLON.UniversalCamera,
        private getZone: (pos: BABYLON.Vector3) => number,
        private createSpawnSmokeEffect: (pos: BABYLON.Vector3) => BABYLON.ParticleSystem,
        private getRemotePlayerPos: () => BABYLON.Vector3 | null,
        private isConnected: () => boolean,
        private zoneSystem: ZoneSystem,
        private configManager: MapConfigManager,
        private resourceManager: ResourceManager,
        private eventBus: EventBus,
        private visualManager: VisualManager
    ) {}


    public setDependencies(
        spawnPowerUp: (pos: BABYLON.Vector3, type?: PowerUpType) => void, 
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
     * Pre-initializes and compiles all materials and mesh templates used for hounds.
     */
    public async preWarmAssets() {
        const sm = this.scene;
        const rm = this.resourceManager;

        const houndMat = rm.getMaterial("houndMat", () => {
            const mat = new BABYLON.StandardMaterial("houndMat", sm);
            mat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45);
            mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            return mat;
        });
        const houndDarkMat = rm.getMaterial("houndDarkMat", () => {
            const mat = new BABYLON.StandardMaterial("houndDarkMat", sm);
            mat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
            return mat;
        });

        // Pre-warm templates
        preWarmTemplates(sm, rm);

        // Force compilation if a mesh is available
        const compilerMesh = sm.meshes[0];
        if (compilerMesh) {
            houndMat.forceCompilation(compilerMesh);
            houndDarkMat.forceCompilation(compilerMesh);
        }
    }

    public onHellhoundDeath(z: Zombie, pos: BABYLON.Vector3, killer: 'HOST' | 'CLIENT' = 'HOST') {
        if (z.isDead) return;
        z.isDead = true;
        this.gameState.zombiesAlive--;
        
        // Clean up smoke effect if still active
        if (z.smokeEffect) {
            z.smokeEffect.stop();
            z.smokeEffect.dispose(false); // false = don't dispose shared texture
            z.smokeEffect = undefined;
        }
        
        const baseKillPts = this.configManager.gameplay.POINTS_KILL;
        if (killer === 'HOST') {
            this.gameState.kills++;
            if (this.setKillsCallback) this.setKillsCallback(this.gameState.kills);
            if (this.addPointsCallback) this.addPointsCallback(baseKillPts);
        } else if (this.sendNetworkMessage) {
            this.sendNetworkMessage({ type: 'HIT_CONFIRM', amount: baseKillPts });
        }
        
        this.gameState.lastDeathPos = pos;
        
        this.eventBus.emit('HELLHOUND_DEATH', { id: z.id, position: pos });

        // === HELLHOUND DEATH EXPLOSION (Pooled) ===
        const hc = this.configManager.hellhound;
        const distToPlayer = BABYLON.Vector3.Distance(pos, this.camera.position);
        if (distToPlayer <= (hc.DEATH_EXPLOSION_RADIUS || 1.5)) {
            this.eventBus.emit('PLAYER_DAMAGE', { 
                amount: hc.DEATH_EXPLOSION_DAMAGE || 50, 
                source: 'hellhound_explosion' 
            });
        }
        this.visualManager.createHellhoundDeathExplosion(pos);

        if (this.spawnPowerUpCallback) {

            // Guaranteed power-up on the final dog kill of a dog round
            const isFinalDogKill = this.gameState.isDogRound &&
                                   this.gameState.zombiesToSpawn === 0 &&
                                   this.gameState.zombiesAlive === 0;

            if (isFinalDogKill) {
                // GUARANTEED Max Ammo on final dog (just like CoD Zombies)
                this.spawnPowerUpCallback(pos, PowerUpType.MAX_AMMO);
            } else if (Math.random() < this.configManager.powerUps.DROP_CHANCE) {
                this.spawnPowerUpCallback(pos);
            }
        }
    }

    /**
     * Find a valid spawn position that:

     * 1. Is within an accessible zone
     * 2. Is not too close to any player
     * 3. Is not too far from players
     */
    private findValidSpawnPosition(): BABYLON.Vector3 | null {
        const hc = this.configManager.hellhound;
        const minDist = hc.SPAWN_MIN_DISTANCE_FROM_PLAYER;
        const maxDist = hc.SPAWN_MAX_DISTANCE_FROM_PLAYER;
        
        // Get player positions
        const playerPositions: BABYLON.Vector3[] = [this.camera.position.clone()];
        const remotePos = this.getRemotePlayerPos();
        if (remotePos && this.isConnected()) {
            playerPositions.push(remotePos.clone());
        }

        // Get accessible zones from all players
        const playerZones = new Set<number>();
        playerPositions.forEach(pos => {
            playerZones.add(this.getZone(pos));
        });

        const allowedZonesSet = new Set<number>();
        playerZones.forEach(pz => {
            const accessible = this.zoneSystem.getAccessibleZones(pz, this.gameState.doorStates);
            accessible.forEach(a => allowedZonesSet.add(a));
        });

        const allowedZones = Array.from(allowedZonesSet);
        if (allowedZones.length === 0) allowedZones.push(1);

        // Try multiple times to find a valid spawn point
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Pick a random allowed zone
            const spawnZone = allowedZones[Math.floor(Math.random() * allowedZones.length)];
            
            // Get a random spawn point from that zone
            const randomPoint = this.zoneSystem.getRandomSpawnPoint(spawnZone);
            if (!randomPoint) continue;

            // Add some randomness to the point
            const spawnPos = randomPoint.clone();
            spawnPos.x += (Math.random() - 0.5) * 3;
            spawnPos.z += (Math.random() - 0.5) * 3;

            // Check distance to all players
            let validDistance = true;
            for (const playerPos of playerPositions) {
                const dist = BABYLON.Vector3.Distance(
                    new BABYLON.Vector3(spawnPos.x, 0, spawnPos.z),
                    new BABYLON.Vector3(playerPos.x, 0, playerPos.z)
                );
                
                if (dist < minDist || dist > maxDist) {
                    validDistance = false;
                    break;
                }
            }

            if (validDistance) {
                return spawnPos;
            }
        }

        // Fallback: find midpoint between min and max distance from closest player
        // and offset in a random direction
        const closestPlayer = playerPositions[0];
        const targetDist = (minDist + maxDist) / 2;
        const angle = Math.random() * Math.PI * 2;
        
        return new BABYLON.Vector3(
            closestPlayer.x + Math.cos(angle) * targetDist,
            0,
            closestPlayer.z + Math.sin(angle) * targetDist
        );
    }

    public spawnHellhoundHost(currentRound: number) {
        const scene = this.scene;
        const hc = this.configManager.hellhound;

        // Find a valid spawn position (ground level)
        const spawnPos = this.findValidSpawnPosition();
        if (!spawnPos) {
            console.warn("Could not find valid hellhound spawn position");
            return;
        }

        const id = "hellhound_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
        
        // 1. Create smoke effect using injected VisualManager method (eliminates duplication)
        const lightningEffect = this.createSpawnSmokeEffect(spawnPos);
        lightningEffect.start();
        
        // 2. Schedule actual dog materialization
        setTimeout(() => {
            const newMesh: ZombieMeshResult = createHellhoundMesh(scene, spawnPos, this.resourceManager);
            
            // Initially invulnerable and invisible-ish
            newMesh.mesh.visibility = 0;
            
            const baseSpeed = hc.SPEED_BASE;
            const speedVariation = 0.9 + (Math.random() * 0.2);
            
            // Health scaling with cap
            const health = Math.min(
                hc.HEALTH_BASE + (hc.HEALTH_INC * (currentRound - 1)),
                hc.HEALTH_CAP
            );

            const zEntity: Zombie = {
                id: id,
                type: 'HELLHOUND',
                mesh: newMesh.mesh,
                headMesh: newMesh.head,
                limbs: newMesh.limbs,
                health: health,
                maxHealth: health,
                speed: baseSpeed * speedVariation,
                lastAttackTime: 0,
                isDead: false,
                state: ZombieState.SPAWNING, 
                targetWindowId: null,
                barrierAttackTimer: 0,
                isBurning: false,
                spawnTime: Date.now(),
                missingLimbs: {
                    legL: false, legR: false, armL: false, armR: false
                },
                // Hellhound-specific
                hellhoundState: HellhoundState.SPAWNING,
                stateTimer: hc.SPAWN_INVULN_TIME,
                targetPlayerId: 'HOST', // AI system will refine targeting
                animOffset: Math.random() * Math.PI * 2
            };

            // Fade in mesh
            const fadeAnim = new BABYLON.Animation("dogFadeIn", "visibility", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
            const keys = [{ frame: 0, value: 0 }, { frame: 30, value: 1 }];
            fadeAnim.setKeys(keys);
            newMesh.mesh.animations.push(fadeAnim);
            newMesh.mesh.getScene().beginAnimation(newMesh.mesh, 0, 30, false);

            this.zombies.push(zEntity);
            lightningEffect.stop();
            lightningEffect.dispose(false); // false = don't dispose shared texture
        }, hc.PRE_SPAWN_LIGHTNING_TIME);
    }

    /**
     * Get the position of the target player
     */
    public getTargetPosition(targetId: string | null): BABYLON.Vector3 | null {
        if (targetId === 'HOST') {
            return this.camera.position.clone();
        } else if (targetId === 'CLIENT') {
            return this.getRemotePlayerPos();
        }
        return null;
    }
}
