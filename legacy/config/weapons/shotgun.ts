import { WeaponDefinition } from './types';

export const shotgunWeapons: WeaponDefinition[] = [
  {
    base: {
      id: "shotgun",
      name: "OLYMPIA",
      clipSize: 2,
      maxReserve: 38,
      fireRate: 200,
      automatic: false,
      damage: 60,
      scale: 1.0,
      pellets: 8,
      price: 500,
      hipPos: { x: 0.25, y: -0.20, z: 0.45 },
      adsPos: { x: 0, y: -0.112, z: 0.35 },
      barrelLength: 0.6,
      hipFireOriginCorrection: { right: -0.0823, up: 0.0875 },
      reloadTime: 2500,
      recoil: { verticalMin: 0.040, verticalMax: 0.060, horizontalRange: 0.010, recoverySpeed: 2.0, adsMultiplier: 0.6, kickBackZ: 0.12, kickRotX: 0.08 }
    },
    upgrade: {
      name: "Hades",
      damage: 150,
      clipSize: 6,
      maxReserve: 60,
      fireRate: 300,
      automatic: false,
      reloadTime: 2000
    }
  }
];
