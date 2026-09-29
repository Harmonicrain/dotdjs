import { WeaponDefinition } from './types';

export const wonderWeapons: WeaponDefinition[] = [
  {
    base: {
      id: "ray_gun",
      name: "Ray Gun",
      clipSize: 20,
      maxReserve: 100,
      fireRate: 400,
      automatic: true,
      damage: 1000,
      scale: 1.0,
      pellets: 1,
      hipPos: { x: 0.25, y: -0.3, z: 0.5 },
      adsPos: { x: -0.001, y: -0.189, z: 0.5 },
      barrelLength: 0.8,
      reloadTime: 2500,
      hipFireOriginCorrection: { up: -0.0082, right: 0.2310 },
      isExplosive: true,
      splashRadius: 6,
      splashDamage: 1000,
      selfDamageMultiplier: 0.5,
      recoil: { verticalMin: 0.020, verticalMax: 0.030, horizontalRange: 0.006, recoverySpeed: 2.5, adsMultiplier: 0.5, kickBackZ: 0.08, kickRotX: 0.05 }
    },
    upgrade: {
      name: "Porter's X2",
      damage: 2000,
      clipSize: 30,
      maxReserve: 150,
      fireRate: 350,
      splashRadius: 8,
      splashDamage: 2000,
      selfDamageMultiplier: 0.5,
    }
  }
];
