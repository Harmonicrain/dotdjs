import { GAME_CONFIG, ROUND_CONFIG, CONTROLLER_CONFIG, SYNC_CONFIG, ZOMBIE_SPEEDS, POWERUP_CONFIG, COMBAT_CONFIG, VISUAL_CONFIG, ZOMBIE_CONFIG, WEAPON_CONFIGS, UPGRADED_WEAPON_CONFIGS } from '../config';
import { HELLHOUND_CONFIG, MYSTERY_BOX_CONFIG } from '../config/enemies';
import { MapDefinition } from '../types/world';
import { WeaponConfig, WeaponUpgrade } from '../types/player';

/** Config key → [property name on this class, global default] */
const CONFIG_KEYS = [
    ['gameplay', GAME_CONFIG],
    ['round', ROUND_CONFIG],
    ['controller', CONTROLLER_CONFIG],
    ['sync', SYNC_CONFIG],
    ['zombieSpeeds', ZOMBIE_SPEEDS],
    ['zombieAI', ZOMBIE_CONFIG],
    ['powerUps', POWERUP_CONFIG],
    ['combat', COMBAT_CONFIG],
    ['visuals', VISUAL_CONFIG],
    ['hellhound', HELLHOUND_CONFIG],
    ['mysteryBox', MYSTERY_BOX_CONFIG],
] as const;

/**
 * MapConfigManager
 *
 * Responsibility: Merges map-specific configuration overrides with global defaults.
 * Provides a single point of access for systems to get the "effective" config
 * for the current map.
 */
export class MapConfigManager {
    // Current Effective Configs
    public gameplay = { ...GAME_CONFIG };
    public round = { ...ROUND_CONFIG };
    public controller = { ...CONTROLLER_CONFIG };
    public sync = { ...SYNC_CONFIG };
    public zombieSpeeds = { ...ZOMBIE_SPEEDS };
    public zombieAI = { ...ZOMBIE_CONFIG };
    public powerUps = { ...POWERUP_CONFIG };
    public combat = { ...COMBAT_CONFIG };
    public visuals = { ...VISUAL_CONFIG };
    public hellhound = { ...HELLHOUND_CONFIG };
    public mysteryBox = { ...MYSTERY_BOX_CONFIG };
    public weapons: WeaponConfig[] = [ ...WEAPON_CONFIGS ];
    public upgradedWeapons: Record<string, WeaponUpgrade> = { ...UPGRADED_WEAPON_CONFIGS };

    /**
     * Load a map definition and apply its configuration overrides.
     */
    public applyMapConfig(def: MapDefinition): void {
        const mc = def.config;
        if (!mc) return;

        for (const [key, _default] of CONFIG_KEYS) {
            const override = key === 'hellhound' || key === 'mysteryBox'
                ? mc.enemies?.[key]
                : (mc as Record<string, unknown>)[key];
            if (override) {
                Object.assign(this[key], override);
            }
        }

        if (mc.weapons) {
            for (const [weaponId, overrides] of Object.entries(mc.weapons)) {
                // Base
                const baseIdx = this.weapons.findIndex(w => w.id === weaponId);
                if (baseIdx !== -1 && overrides.base) {
                    this.weapons[baseIdx] = { ...this.weapons[baseIdx], ...overrides.base };
                }
                // Upgrade
                if (this.upgradedWeapons[weaponId] && overrides.upgrade) {
                    this.upgradedWeapons[weaponId] = { ...this.upgradedWeapons[weaponId], ...overrides.upgrade };
                }
            }
        }
    }

    /**
     * Reset configs to global defaults.
     */
    public resetToDefaults(): void {
        for (const [key, defaultVal] of CONFIG_KEYS) {
            (this as Record<string, unknown>)[key] = { ...defaultVal };
        }
        this.weapons = [ ...WEAPON_CONFIGS ];
        this.upgradedWeapons = { ...UPGRADED_WEAPON_CONFIGS };
    }
}
