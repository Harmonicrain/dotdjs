import { WeaponDefinition } from './types';

export const pistolWeapons: WeaponDefinition[] = [
  {
    base: {
      id: "pistol",
      name: "M1911",
      clipSize: 8,
      maxReserve: 80,
      fireRate: 400,
      automatic: false,
      damage: 34,
      scale: 1.0,
      pellets: 1,
      hipPos: { x: 0.2, y: -0.25, z: 0.5 },
      adsPos: { x: 0, y: -0.15, z: 0.5 },
      barrelLength: 0.6,
      reloadTime: 2000,
      hipFireOriginCorrection: { up: -0.10, right: 0.15 }
    },
    upgrade: {
      name: "PAIN",
      damage: 400,
      clipSize: 12,
      maxReserve: 100,
      fireRate: 500,
      automatic: true,
      reloadTime: 1500
    }
  }
];
