import { pistolWeapons }     from './pistol';
import { shotgunWeapons }    from './shotgun';
import { fullAutoWeapons }   from './fullauto';
import { semiAutoWeapons }   from './semiauto';
import { wonderWeapons }     from './wonderweapons';
import { WeaponUpgrade }     from './types';
import { WeaponConfig }      from '../../types/player';

const allDefinitions = [
  ...pistolWeapons,
  ...shotgunWeapons,
  ...fullAutoWeapons,
  ...semiAutoWeapons,
  ...wonderWeapons,
];

export const WEAPON_CONFIGS: WeaponConfig[] =
  allDefinitions.map(d => d.base);

export const UPGRADED_WEAPON_CONFIGS: Record<string, WeaponUpgrade> =
  Object.fromEntries(
    allDefinitions
      .filter(d => d.upgrade)
      .map(d => [d.base.id, d.upgrade!])
  );
