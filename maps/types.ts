import { GAME_CONFIG, ROUND_CONFIG, CONTROLLER_CONFIG, SYNC_CONFIG, ZOMBIE_SPEEDS, POWERUP_CONFIG, COMBAT_CONFIG, VISUAL_CONFIG, ZOMBIE_CONFIG } from '../config/gameplay';
import { HELLHOUND_CONFIG, MYSTERY_BOX_CONFIG } from '../config/enemies';
import { WeaponConfig, WeaponUpgrade } from '../types/player';

export type MapGameplayConfig = Partial<typeof GAME_CONFIG>;
export type MapRoundConfig = Partial<typeof ROUND_CONFIG>;
export type MapControllerConfig = Partial<typeof CONTROLLER_CONFIG>;
export type MapSyncConfig = Partial<typeof SYNC_CONFIG>;
export type MapZombieSpeeds = Partial<typeof ZOMBIE_SPEEDS>;
export type MapPowerUpConfig = Partial<typeof POWERUP_CONFIG>;
export type MapCombatConfig = Partial<typeof COMBAT_CONFIG>;
export type MapVisualConfig = Partial<typeof VISUAL_CONFIG>;
export type MapHellhoundConfig = Partial<typeof HELLHOUND_CONFIG>;
export type MapMysteryBoxConfig = Partial<typeof MYSTERY_BOX_CONFIG>;
export type MapZombieAIConfig = Partial<typeof ZOMBIE_CONFIG>;

export interface MapWeaponOverride {
    base?: Partial<WeaponConfig>;
    upgrade?: Partial<WeaponUpgrade>;
}

export interface MapConfiguration {
    gameplay?: MapGameplayConfig;
    round?: MapRoundConfig;
    controller?: MapControllerConfig;
    sync?: MapSyncConfig;
    zombieSpeeds?: MapZombieSpeeds;
    zombieAI?: MapZombieAIConfig;
    powerUps?: MapPowerUpConfig;
    combat?: MapCombatConfig;
    visuals?: MapVisualConfig;
    enemies?: {
        hellhound?: MapHellhoundConfig;
        mysteryBox?: MapMysteryBoxConfig;
    };
    weapons?: Record<string, MapWeaponOverride>;
}
