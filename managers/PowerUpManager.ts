import * as BABYLON from '@babylonjs/core';
import { createPowerUpMesh } from '../meshes';
import { PowerUpType, GameStateData, WindowBarrier, WeaponState, Zombie, GameMessage } from '../types/index';
import { MapConfigManager } from './MapConfigManager';

// Forward-declare only the subset of StateManager used here to avoid a
// circular-import cycle (StateManager → PowerUpManager → StateManager).
interface UISetters {
    setAmmo: (v: number) => void;
    setReserveAmmo: (v: number) => void;
}

export class PowerUpManager {
    public windows: WindowBarrier[];
    private onZombieDeathCallback: ((z: Zombie, pos: BABYLON.Vector3, killer: 'HOST' | 'CLIENT') => void) | null = null;

    constructor(
        private scene: BABYLON.Scene,
        private gameState: GameStateData,
        private gameModeRef: { current: string },
        private send: (data: GameMessage) => void,
        private addPoints: (amount: number) => void,
        windows: WindowBarrier[],
        private zombies: Zombie[],
        private sm: UISetters,
        private configManager: MapConfigManager
    ) {
        this.windows = windows;
    }

    public setZombieKiller(cb: (z: Zombie, pos: BABYLON.Vector3, killer: 'HOST' | 'CLIENT') => void) {
        this.onZombieDeathCallback = cb;
    }

    public spawnPowerUp(pos: BABYLON.Vector3, specificType?: PowerUpType) {
        const types = Object.values(PowerUpType);
        const type = specificType || types[Math.floor(Math.random() * types.length)];
        const id = "pu_" + Date.now();
        
        // Float slightly above ground
        const spawnPos = new BABYLON.Vector3(pos.x, Math.max(pos.y, 0), pos.z);
        const mesh = createPowerUpMesh(this.scene, type, spawnPos);
        
        this.gameState.powerUps.push({ id, type, mesh, position: spawnPos, spawnTime: Date.now(), isCollected: false });
        
        if (this.gameModeRef.current !== 'SOLO') { 
            this.send({ type: 'SPAWN_POWERUP', id, pType: type, x: spawnPos.x, y: spawnPos.y, z: spawnPos.z }); 
        }
    }

    public activatePowerUp(type: PowerUpType) {
        const now = Date.now();
        const pc = this.configManager.powerUps;
        const endTime = now + pc.EFFECT_DURATION;

        if (type === PowerUpType.MAX_AMMO) {
            this.gameState.weapons.forEach((w: WeaponState) => { w.currentAmmo = w.clipSize; w.currentReserve = w.maxReserve; });
            const activeW = this.gameState.weapons[this.gameState.activeWeaponIndex];
            this.sm.setAmmo(activeW.currentAmmo);
            this.sm.setReserveAmmo(activeW.currentReserve);
        } else if (type === PowerUpType.NUKE) {
            if (this.onZombieDeathCallback) {
                this.zombies.forEach(z => { 
                    z.isBurning = true; 
                    z.health = 0; 
                    this.onZombieDeathCallback!(z, z.mesh.position, 'HOST'); 
                });
            }
            this.addPoints(pc.NUKE_POINTS);
        } else if (type === PowerUpType.CARPENTER) {
            this.windows.forEach(w => { 
                w.boards.forEach((b: BABYLON.AbstractMesh) => b.setEnabled(true)); 
            });
            this.addPoints(pc.CARPENTER_POINTS);
        } else { 
            this.gameState.activePowerUps[type] = endTime; 
        }
        
        if (this.gameModeRef.current !== 'SOLO') { 
            this.send({ type: 'ACTIVATE_POWERUP_EFFECT', pType: type }); 
        }
    }
}
