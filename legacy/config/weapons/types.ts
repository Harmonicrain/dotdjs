import { WeaponConfig } from '../../types/player';

export type WeaponUpgrade = Partial<WeaponConfig> & { name: string };

export interface WeaponDefinition {
  base: WeaponConfig;
  upgrade?: WeaponUpgrade;
  /** Per-weapon muzzle origin correction at hip-fire only. */
  hipFireOriginCorrection?: { up: number; right: number };
}
