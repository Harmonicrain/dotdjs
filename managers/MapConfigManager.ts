import { GAME_CONFIG, ROUND_CONFIG, CONTROLLER_CONFIG, SYNC_CONFIG, ZOMBIE_SPEEDS, POWERUP_CONFIG, COMBAT_CONFIG, VISUAL_CONFIG, ZOMBIE_CONFIG, WEAPON_CONFIGS, UPGRADED_WEAPON_CONFIGS } from '../config';
import { HELLHOUND_CONFIG, MYSTERY_BOX_CONFIG } from '../config/enemies';
import { MapDefinition } from '../types/world';
import { WeaponConfig, WeaponUpgrade } from '../types/player';

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

        if (mc.gameplay) Object.assign(this.gameplay, mc.gameplay);
        if (mc.round) Object.assign(this.round, mc.round);
        if (mc.controller) Object.assign(this.controller, mc.controller);
        if (mc.sync) Object.assign(this.sync, mc.sync);
        if (mc.zombieSpeeds) Object.assign(this.zombieSpeeds, mc.zombieSpeeds);
        if (mc.zombieAI) Object.assign(this.zombieAI, mc.zombieAI);
        if (mc.powerUps) Object.assign(this.powerUps, mc.powerUps);
        if (mc.combat) Object.assign(this.combat, mc.combat);
        if (mc.visuals) Object.assign(this.visuals, mc.visuals);
        
        if (mc.enemies) {
            if (mc.enemies.hellhound) Object.assign(this.hellhound, mc.enemies.hellhound);
            if (mc.enemies.mysteryBox) Object.assign(this.mysteryBox, mc.enemies.mysteryBox);
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
        this.gameplay = { ...GAME_CONFIG };
        this.round = { ...ROUND_CONFIG };
        this.controller = { ...CONTROLLER_CONFIG };
        this.sync = { ...SYNC_CONFIG };
        this.zombieSpeeds = { ...ZOMBIE_SPEEDS };
        this.zombieAI = { ...ZOMBIE_CONFIG };
        this.powerUps = { ...POWERUP_CONFIG };
        this.combat = { ...COMBAT_CONFIG };
        this.visuals = { ...VISUAL_CONFIG };
        this.hellhound = { ...HELLHOUND_CONFIG };
        this.mysteryBox = { ...MYSTERY_BOX_CONFIG };
        this.weapons = [ ...WEAPON_CONFIGS ];
        this.upgradedWeapons = { ...UPGRADED_WEAPON_CONFIGS };
    }
}
