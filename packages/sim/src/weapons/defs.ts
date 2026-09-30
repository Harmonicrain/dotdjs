/**
 * Weapon data. Damage, magazine, fire-rate and reload numbers (and the Pack-a-Punch upgrades)
 * come from the original prototype's config/weapons. Spread, range and head multipliers are new.
 * Angles are in radians, times in seconds, fire rate in rounds per minute.
 */

export interface WeaponRecoil {
  /** Upward kick per shot, randomised between the two values. */
  pitch: readonly [number, number];
  /** Maximum sideways kick per shot in either direction. */
  yaw: number;
  /** How quickly the view settles back, per second. */
  recovery: number;
  /** Recoil scale while aiming down sights. */
  adsMultiplier: number;
}

export interface WeaponUpgrade {
  name: string;
  damage: number;
  clipSize: number;
  maxReserve: number;
  rpm: number;
  automatic: boolean;
  reloadTime: number;
}

export interface WeaponDef {
  name: string;
  clipSize: number;
  maxReserve: number;
  rpm: number;
  automatic: boolean;
  damage: number;
  pellets: number;
  headshotMultiplier: number;
  range: number;
  hipSpread: number;
  adsSpread: number;
  reloadTime: number;
  drawTime: number;
  /** Wall-buy price, if the weapon can be bought off a wall. */
  price?: number;
  recoil: WeaponRecoil;
  upgrade?: WeaponUpgrade;
}

export const WEAPONS = {
  m1911: {
    name: 'M1911',
    clipSize: 8,
    maxReserve: 80,
    rpm: 400,
    automatic: false,
    damage: 34,
    pellets: 1,
    headshotMultiplier: 2,
    range: 60,
    hipSpread: 0.03,
    adsSpread: 0.004,
    reloadTime: 2.0,
    drawTime: 0.35,
    recoil: { pitch: [0.015, 0.025], yaw: 0.005, recovery: 3, adsMultiplier: 0.5 },
    upgrade: {
      name: 'PAIN',
      damage: 400,
      clipSize: 12,
      maxReserve: 100,
      rpm: 500,
      automatic: true,
      reloadTime: 1.5,
    },
  },
  olympia: {
    name: 'OLYMPIA',
    clipSize: 2,
    maxReserve: 38,
    rpm: 200,
    automatic: false,
    damage: 60,
    pellets: 8,
    headshotMultiplier: 1.5,
    range: 30,
    hipSpread: 0.075,
    adsSpread: 0.05,
    reloadTime: 2.5,
    drawTime: 0.5,
    price: 500,
    recoil: { pitch: [0.04, 0.06], yaw: 0.01, recovery: 2, adsMultiplier: 0.6 },
    upgrade: {
      name: 'Hades',
      damage: 150,
      clipSize: 6,
      maxReserve: 60,
      rpm: 300,
      automatic: false,
      reloadTime: 2.0,
    },
  },
  stg44: {
    name: 'STG-44',
    clipSize: 30,
    maxReserve: 300,
    rpm: 600,
    automatic: true,
    damage: 25,
    pellets: 1,
    headshotMultiplier: 2,
    range: 80,
    hipSpread: 0.045,
    adsSpread: 0.006,
    reloadTime: 2.2,
    drawTime: 0.5,
    recoil: { pitch: [0.008, 0.015], yaw: 0.008, recovery: 4, adsMultiplier: 0.4 },
    upgrade: {
      name: 'Spatz-447',
      damage: 50,
      clipSize: 60,
      maxReserve: 360,
      rpm: 750,
      automatic: true,
      reloadTime: 1.8,
    },
  },
  famas: {
    name: 'FAMAS',
    clipSize: 30,
    maxReserve: 150,
    rpm: 900,
    automatic: true,
    damage: 30,
    pellets: 1,
    headshotMultiplier: 2,
    range: 80,
    hipSpread: 0.045,
    adsSpread: 0.006,
    reloadTime: 2.0,
    drawTime: 0.5,
    price: 1200,
    recoil: { pitch: [0.006, 0.012], yaw: 0.01, recovery: 5, adsMultiplier: 0.35 },
    upgrade: {
      name: 'G16-GL35',
      damage: 55,
      clipSize: 45,
      maxReserve: 270,
      rpm: 1200,
      automatic: true,
      reloadTime: 1.5,
    },
  },
  fnfal: {
    name: 'FN FAL',
    clipSize: 20,
    maxReserve: 200,
    rpm: 450,
    automatic: false,
    damage: 40,
    pellets: 1,
    headshotMultiplier: 2.5,
    range: 100,
    hipSpread: 0.04,
    adsSpread: 0.003,
    reloadTime: 2.4,
    drawTime: 0.55,
    price: 1500,
    recoil: { pitch: [0.02, 0.03], yaw: 0.008, recovery: 3.5, adsMultiplier: 0.45 },
    upgrade: {
      name: 'EPC WN',
      damage: 75,
      clipSize: 30,
      maxReserve: 300,
      rpm: 600,
      automatic: false,
      reloadTime: 1.8,
    },
  },
  garand: {
    name: 'M1 Garand',
    clipSize: 8,
    maxReserve: 96,
    rpm: 600,
    automatic: false,
    damage: 55,
    pellets: 1,
    headshotMultiplier: 2.5,
    range: 100,
    hipSpread: 0.04,
    adsSpread: 0.003,
    reloadTime: 2.2,
    drawTime: 0.55,
    price: 1200,
    recoil: { pitch: [0.025, 0.035], yaw: 0.008, recovery: 3, adsMultiplier: 0.45 },
    upgrade: {
      name: 'Punisher 30',
      damage: 80,
      clipSize: 15,
      maxReserve: 180,
      rpm: 700,
      automatic: false,
      reloadTime: 1.8,
    },
  },
} as const satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;

/** Stable ordering used to encode weapon ids on the wire. Append only. */
export const WEAPON_IDS: readonly WeaponId[] = [
  'm1911',
  'olympia',
  'stg44',
  'famas',
  'fnfal',
  'garand',
];

export const STARTING_WEAPON: WeaponId = 'm1911';

export const getWeapon = (id: WeaponId): WeaponDef => WEAPONS[id];
