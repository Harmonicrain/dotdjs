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
      hipFireOriginCorrection: { up: -0.10, right: 0.15 },
      isExplosive: true,
      splashRadius: 6,
      splashDamage: 1000,
      selfDamageMultiplier: 0.5,
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
