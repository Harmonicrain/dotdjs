import { GAME_CONFIG, WEAPON_CONFIGS } from '../../config';
import { StateManager } from '../../state/StateManager';

/**
 * Player Damage Utilities
 *
 * Handles damage application, downed-state transitions, and weapon
 * save/restore for the downed flow. Extracted from StateManager so
 * the data container doesn't hold gameplay logic.
 *
 * Imported directly by systems that need it (ZombieDamageSystem,
 * ProjectileSystem, DownedSystem, ReviveSystem, Game.ts EventBus handler).
 */

/**
 * Applies damage to the local player. Handles authority checks, god mode,
 * quick-revive branching, downed-state transitions, and network messaging.
 */
export const applyDamageToLocalPlayer = (ctx: StateManager, amount: number, flashColor: string): void => {
    const isAuthority = ctx.gameModeRef.current === 'SOLO' || ctx.gameModeRef.current === 'HOST';
    if (!isAuthority || ctx.gameState.isGodMode) return;
    if (ctx.gameState.health <= 0 || ctx.gameState.isDowned) return;

    ctx.gameState.lastDamageTime = Date.now();
    ctx.gameState.health = Math.max(0, ctx.gameState.health - amount);
    ctx.setHealth(ctx.gameState.health);
    ctx.setFlashColor(flashColor);

    if (ctx.gameState.health <= 0 && !ctx.gameState.isDowned) {
        const isSolo = ctx.gameModeRef.current === 'SOLO';
        const hasQuickRevive = ctx.gameState.perkStates['quickRevive'];

        if (isSolo && !hasQuickRevive) {
            ctx.setHealth(0);
            ctx.setIsGameOver(true);
        } else {
            ctx.gameState.isDowned = true;
            ctx.gameState.downedStartTime = Date.now();
            ctx.gameState.downedTimeLimit = ctx.configManager.gameplay.DOWNED_BLEED_OUT_TIME;
            ctx.setIsDowned(true);

            // CoD-style: save current weapons and swap to M1911 with limited ammo
            swapToDownedWeapon(ctx);

            if (!isSolo) {
                ctx.send({
                    type: 'PLAYER_DOWNED',
                    playerName: ctx.gameState.playerName || "Survivor",
                    position: { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z }
                });

                // In multiplayer, if both players are now downed, trigger game over
                if (ctx.remote.gameState.isDowned) {
                    ctx.setIsGameOver(true);
                }
            }
        }
    }
};

/** Save current weapons and switch to M1911 with limited ammo while downed */
export const swapToDownedWeapon = (ctx: StateManager): void => {
    const gs = ctx.gameState;

    // Save current weapon loadout
    gs.savedWeapons = gs.weapons.map(w => ({ ...w }));
    gs.savedActiveWeaponIndex = gs.activeWeaponIndex;

    // Find M1911 base config
    const pistolConfig = WEAPON_CONFIGS.find(w => w.id === 'pistol');
    if (!pistolConfig) return;

    // Replace weapons array with a single M1911
    gs.weapons = [{
        ...pistolConfig,
        currentAmmo: pistolConfig.clipSize,
        currentReserve: GAME_CONFIG.DOWNED_PISTOL_RESERVE,
        isPacked: false,
        mesh: gs.weaponMeshes['pistol'] || null,
    }];
    gs.activeWeaponIndex = 0;
    gs.isReloading = false;
    gs.isFiring = false;
    gs.isAiming = false;

    // Sync HUD
    ctx.setActiveWeaponIndex(0);
    ctx.setWeaponName(pistolConfig.name);
    ctx.setAmmo(pistolConfig.clipSize);
    ctx.setReserveAmmo(GAME_CONFIG.DOWNED_PISTOL_RESERVE);
    ctx.setMaxClip(pistolConfig.clipSize);
};

/** Restore the weapons the player had before going downed */
export const restoreWeaponsAfterRevive = (ctx: StateManager): void => {
    const gs = ctx.gameState;
    if (!gs.savedWeapons) return;

    gs.weapons = gs.savedWeapons;
    gs.activeWeaponIndex = gs.savedActiveWeaponIndex;
    gs.savedWeapons = null;

    // Re-link weapon meshes
    for (const w of gs.weapons) {
        w.mesh = gs.weaponMeshes[w.id] || null;
    }

    // Sync HUD with restored weapon
    const active = gs.weapons[gs.activeWeaponIndex];
    if (active) {
        ctx.setActiveWeaponIndex(gs.activeWeaponIndex);
        ctx.setWeaponName(active.name);
        ctx.setAmmo(active.currentAmmo);
        ctx.setReserveAmmo(active.currentReserve);
        ctx.setMaxClip(active.clipSize);
    }
};
