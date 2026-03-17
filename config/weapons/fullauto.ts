import { WeaponDefinition } from './types';

export const fullAutoWeapons: WeaponDefinition[] = [
  {
    base: {
      id: "rifle",
      name: "STG-44",
      clipSize: 30,
      maxReserve: 300,
      fireRate: 600,
      automatic: true,
      damage: 25,
      scale: 1.0,
      pellets: 1,
      hipPos: { x: 0.3, y: -0.32, z: 0.3 },
      adsPos: { x: 0, y: -0.28, z: 0.55 },
      barrelLength: 0.65,
      reloadTime: 2200,
      hipFireOriginCorrection: { up: 0.15, right: 0.0 }
    },
    upgrade: {
      name: "Spatz-447",
      damage: 50,
      clipSize: 60,
      maxReserve: 360,
      fireRate: 750,
      automatic: true,
      reloadTime: 1800
    }
  },
  {
    base: {
      id: "famas",
      name: "FAMAS",
      clipSize: 30,
      maxReserve: 150,
      fireRate: 900,
      automatic: true,
      damage: 30,
      scale: 1.0,
      pellets: 1,
      price: 1200,
      hipPos: { x: 0.25, y: -0.18, z: 0.45 },
      adsPos: { x: 0, y: -0.14, z: 0.45 },
      barrelLength: 0.5,
      reloadTime: 2000
    },
    upgrade: {
      name: "G16-GL35",
      damage: 55,
      clipSize: 45,
      maxReserve: 270,
      fireRate: 1200,
      automatic: true,
      reloadTime: 1500
    }
  }
];
