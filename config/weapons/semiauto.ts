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
      hipFireOriginCorrection: { up: 0.2135, right: -0.0898 }
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
      hipFireOriginCorrection: { up: 0.1493, right: 0.0589 }
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
