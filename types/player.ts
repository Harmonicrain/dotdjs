
import * as BABYLON from '@babylonjs/core';

export interface WeaponConfig {
    id: string;
    name: string;
    clipSize: number;
    maxReserve: number;
    fireRate: number;
    /** Hold-to-fire (true) vs single-shot-per-press (false). Not a weapon class label. */
    automatic: boolean;
    damage: number;
    scale: number;
    pellets: number;
    price?: number;
    hipPos: { x: number, y: number, z: number };
    adsPos: { x: number, y: number, z: number };
    barrelOffset?: number;
    barrelLength: number;
    reloadTime: number;
    hipFireOriginCorrection?: { up: number; right: number };
    /** Is this an explosive projectile weapon (Ray Gun)? */
    isExplosive?: boolean;
    /** Splash damage radius in units */
    splashRadius?: number;
    /** Maximum splash damage at center */
    splashDamage?: number;
    /** Self damage multiplier when player hits themselves */
    selfDamageMultiplier?: number;
    /** Custom projectile speed override (default uses COMBAT_CONFIG) */
    projectileSpeedOverride?: number;
    /** Sound name to play on fire (defaults to 'M1911' for backward compat) */
    fireSound?: string;
    /** Per-weapon recoil configuration for camera kick and weapon mesh kick */
    recoil?: {
        verticalMin: number;    // min upward camera kick per shot (radians)
        verticalMax: number;    // max upward camera kick per shot
        horizontalRange: number; // +/- horizontal camera drift per shot
        recoverySpeed: number;  // how fast camera returns (radians/sec)
        adsMultiplier: number;  // recoil reduction when ADS (0.4 = 60% less)
        kickBackZ: number;      // weapon mesh backward kick distance
        kickRotX: number;       // weapon mesh upward tilt (radians)
    };
}

export type WeaponUpgrade = Partial<WeaponConfig> & { name: string };

export type WeaponState = WeaponConfig & {
    currentAmmo: number;
    currentReserve: number;
    mesh: BABYLON.TransformNode | null;
    isPacked: boolean;
    packedName?: string;
};

export interface RemoteGameState {
  health: number;
  points: number;
  perks: Record<string, boolean>;
  isDowned: boolean;
  kills: number;
  shots: number;
}

export interface SpawnPoints {
    host: BABYLON.Vector3;
    client: BABYLON.Vector3;
    rotation: number;
    clientRotation?: number; // Optional override for client
}
