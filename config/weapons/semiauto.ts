import { WeaponDefinition } from './types';

export const semiAutoWeapons: WeaponDefinition[] = [
  {
    base: {
      id: "fn_fal",
      name: "FN FAL",
      clipSize: 20,
      maxReserve: 200,
      fireRate: 450,
      automatic: false,
      damage: 40,
      scale: 1.0,
      pellets: 1,
      price: 1500,
      hipPos: { x: 0.24, y: -0.27, z: 0.58 },
      adsPos: { x: 0.0077, y: -0.1996, z: 0.74 },
      barrelLength: 0.7,
      reloadTime: 2400,
      hipFireOriginCorrection: { up: 0.2135, right: -0.0898 },
      recoil: { verticalMin: 0.018, verticalMax: 0.028, horizontalRange: 0.004, recoverySpeed: 3.5, adsMultiplier: 0.45, kickBackZ: 0.05, kickRotX: 0.035 }
    },
    upgrade: {
      name: "EPC WN",
      damage: 75,
      clipSize: 30,
      maxReserve: 300,
      fireRate: 600,
      automatic: false,
      reloadTime: 1800
    }
  },
  {
    base: {
      id: "m1_garand",
      name: "M1 Garand",
      clipSize: 8,
      maxReserve: 96,
      fireRate: 600,
      automatic: false,
      damage: 55,
      scale: 1.0,
      pellets: 1,
      price: 1200,
      hipPos: { x: 0.24, y: -0.27, z: 0.58 },
      adsPos: { x: -0.0001, y: -0.2170, z: 0.7400 },
      barrelLength: 0.7,
      reloadTime: 2200,
      hipFireOriginCorrection: { up: 0.1493, right: 0.0589 },
      recoil: { verticalMin: 0.012, verticalMax: 0.020, horizontalRange: 0.003, recoverySpeed: 4.0, adsMultiplier: 0.4, kickBackZ: 0.045, kickRotX: 0.03 }
    },
    upgrade: {
      name: "Punisher 30",
      damage: 80,
      clipSize: 15,
      maxReserve: 180,
      fireRate: 700,
      automatic: false,
      reloadTime: 1800
    }
  }
];
