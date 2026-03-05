
import { GameStateData, PowerUpType, DebugInfo } from '../types/index';
import { PlayerFields, GameFields, ScaleWeaponModeData, DebugControlsData, useGameStore } from '../store/useGameStore';

type UpdatePlayer = (updates: Partial<PlayerFields>) => void;
type UpdateGame   = (updates: Partial<GameFields>)   => void;

/**
 * UIBridge
 *
 * Bridges authoritative game-loop state to the Zustand store consumed by the
 * React HUD.  High-frequency values (points, health, zombie counts) are
 * throttled and cached to avoid excessive React re-renders.
 *
 * Receives `gameState` by reference so mutations are visible to both
 * UIBridge and StateManager without copying.
 */
export class UIBridge {
    // ── Throttle / cache internals ───────────────────────────────────────
    private readonly UI_UPDATE_THROTTLE = 50; // ms
    private lastUiUpdate: Record<string, number> = {};
    private uiCache = {
        points:             -1,
        totalEarnedPoints:  -1,
        health:             -1,
        ammo:               -1,
        reserveAmmo:        -1,
        activeWeaponIndex:  -1,
        weaponName:         '',
        activeZombiesCount: -1,
        totalRoundZombies:  -1,
        hoverMsg:           null as string | null,
        interactionMsg:     null as string | null,
        isBeingRevived:     false,
        kills:              -1,
        shotsFired:         -1,
        playerName:         '',
        debugInfo:          null as DebugInfo | null,
    };

    private checkThrottle(key: string): boolean {
        const now  = Date.now();
        const last = this.lastUiUpdate[key] ?? 0;
        if (now - last > this.UI_UPDATE_THROTTLE) {
            this.lastUiUpdate[key] = now;
            return true;
        }
        return false;
    }

    constructor(
        private readonly gameState: GameStateData,
        private readonly _updatePlayer: UpdatePlayer,
        private readonly _updateGame: UpdateGame,
    ) {}

    // ── Player setters ───────────────────────────────────────────────────

    public setPoints(v: number) {
        this.gameState.points = v;
        if (this.uiCache.points !== v) {
            const delta = Math.abs(v - this.uiCache.points);
            if (this.checkThrottle('points') || delta > 100) {
                this.uiCache.points = v;
                this._updatePlayer({ points: v });
            }
        }
    }

    public setTotalEarnedPoints(v: number) {
        this.gameState.totalEarnedPoints = v;
        if (this.uiCache.totalEarnedPoints !== v) {
            if (this.checkThrottle('totalPoints')) {
                this.uiCache.totalEarnedPoints = v;
                this._updatePlayer({ totalEarnedPoints: v });
            }
        }
    }

    public setHealth(v: number) {
        const intV = Math.ceil(v);
        this.gameState.health = intV;
        if (this.uiCache.health !== intV) {
            if (intV <= 0 || intV >= this.gameState.maxHealth || this.checkThrottle('health')) {
                this.uiCache.health = intV;
                this._updatePlayer({ health: intV });
            }
        }
    }

    public setAmmo(v: number) {
        if (this.uiCache.ammo !== v) {
            // Throttle ammo updates for automatic weapons
            if (this.checkThrottle('ammo')) {
                this.uiCache.ammo = v;
                this._updatePlayer({ ammo: v });
            }
        }
    }


    public setReserveAmmo(v: number) {
        if (this.uiCache.reserveAmmo !== v) {
            this.uiCache.reserveAmmo = v;
            this._updatePlayer({ reserveAmmo: v });
        }
    }

    public setActiveWeaponIndex(v: number) {
        this.gameState.activeWeaponIndex = v;
        if (this.uiCache.activeWeaponIndex !== v) {
            this.uiCache.activeWeaponIndex = v;
            this._updatePlayer({ activeWeaponIndex: v });
        }
    }

    public setWeaponName(v: string) {
        if (this.uiCache.weaponName !== v) {
            this.uiCache.weaponName = v;
            this._updatePlayer({ weaponName: v });
        }
    }

    public setMaxClip(v: number) {
        this._updatePlayer({ maxClip: v });
    }

    public setPerks(v: Record<string, boolean>) {
        this.gameState.perkStates = v;
        this._updatePlayer({ perks: v });
    }

    public setIsDowned(v: boolean) {
        this.gameState.isDowned = v;
        this._updatePlayer({ isDowned: v });
    }

    public setIsBeingRevived(v: boolean) {
        if (this.uiCache.isBeingRevived !== v) {
            this.uiCache.isBeingRevived = v;
            this.gameState.isBeingRevived = v;
            this._updatePlayer({ isBeingRevived: v });
        }
    }

    public setKills(v: number) {
        if (this.uiCache.kills !== v) {
            this.uiCache.kills = v;
            this._updatePlayer({ kills: v });
        }
    }

    public setShotsFired(v: number) {
        if (this.uiCache.shotsFired !== v) {
            // Throttle — shots fire at high frequency
            if (this.checkThrottle('shotsFired')) {
                this.uiCache.shotsFired = v;
                this._updatePlayer({ shotsFired: v });
            }
        }
    }

    public setFlashColor(v: string | null) {
        this._updatePlayer({ flashColor: v });
    }

    public setPlayerName(v: string) {
        this.gameState.playerName = v;
        if (this.uiCache.playerName !== v) {
            this.uiCache.playerName = v;
            this._updatePlayer({ playerName: v });
        }
    }

    // ── Game setters ─────────────────────────────────────────────────────

    public setIsSpectating(v: boolean) {
        this.gameState.isSpectating = v;
        this._updateGame({ isSpectating: v });
    }

    public setIsGameOver(v: boolean) {
        this.gameState.isGameOver = v;
        this._updateGame({ isGameOver: v });
    }

    public setReviveProgress(v: number) {
        this.gameState.reviveProgress = v;
        this._updatePlayer({ reviveProgress: v });
    }

    public setInteractionMsg(v: string | null) {

        if (this.uiCache.interactionMsg !== v) {
            this.uiCache.interactionMsg = v;
            this._updateGame({ interactionMsg: v });
        }
    }

    public setHoverMsg(v: string | null) {
        if (this.uiCache.hoverMsg !== v) {
            this.uiCache.hoverMsg = v;
            this._updateGame({ hoverMsg: v });
        }
    }

    public setRound(v: number) {
        this.gameState.round = v;
        this._updateGame({ round: v });
    }

    public setShowRoundIntro(v: boolean) {
        this._updateGame({ showRoundIntro: v });
    }

    public setActivePowerUps(v: Partial<Record<PowerUpType, number>>) {
        this.gameState.activePowerUps = v;
        this._updateGame({ activePowerUps: v });
    }

    public setActiveZombiesCount(v: number) {
        if (this.uiCache.activeZombiesCount !== v) {
            this.uiCache.activeZombiesCount = v;
            if (this.checkThrottle('zombieCount')) {
                this._updateGame({ activeZombiesCount: v });
            }
        }
    }

    public setTotalRoundZombies(v: number) {
        if (this.uiCache.totalRoundZombies !== v) {
            this.uiCache.totalRoundZombies = v;
            this._updateGame({ totalRoundZombies: v });
        }
    }

    public setZombiesSpawned(v: number) {
        this.gameState.zombiesSpawned = v;
        this._updateGame({ zombiesSpawned: v });
    }

    public setZombiesKilledInRound(v: number) {
        this.gameState.zombiesKilledInRound = v;
        this._updateGame({ zombiesKilledInRound: v });
    }

    public setZombiesToSpawn(v: number) {
        this.gameState.zombiesToSpawn = v;
        this._updateGame({ zombiesToSpawn: v });
    }

    public setIsConsoleOpen(v: boolean) {
        this._updateGame({ isConsoleOpen: v });
    }

    public setConsoleResult(v: string | null) {
        this._updateGame({ consoleResult: v });
    }

    public setIsDebugMode(v: boolean) {
        this._updateGame({ isDebugMode: v });
    }

    public setIsDebugActive(v: boolean) {
        this._updateGame({ isDebugActive: v });
    }

    public setDebugInfo(v: DebugInfo | null) {
        if (JSON.stringify(this.uiCache.debugInfo) !== JSON.stringify(v)) {
            this.uiCache.debugInfo = v;
            this._updateGame({ debugInfo: v });
        }
    }

    public setScaleWeaponMode(v: ScaleWeaponModeData | null) {
        this._updateGame({ scaleWeaponMode: v });
    }

    public setPlayerStats(zone: number, pos: { x: number, y: number, z: number, rot: number }) {
        // Position is high frequency, throttle it
        if (this.checkThrottle('playerStats')) {
            this._updateGame({ 
                currentZone: zone,
                playerPosition: pos 
            });
        }
    }

    public setDebugControls(data: Partial<DebugControlsData>) {
        // Only update if debug controls is active or we're toggling it
        if (this.checkThrottle('debugControls') || data.isActive !== undefined) {
            this._updateGame({ 
                debugControls: {
                    isActive: data.isActive ?? false,
                    fps: data.fps ?? 0,
                    inputSource: data.inputSource ?? 'NONE',
                    cameraRotation: data.cameraRotation ?? { x: 0, y: 0 },
                    rawMouseDelta: data.rawMouseDelta ?? { x: 0, y: 0 },
                    rawControllerLook: data.rawControllerLook ?? { x: 0, y: 0 },
                }
            });
        }
    }

    // ── Store getters (read Zustand directly to avoid stale closures) ──

    public getGameMode(): string {
        return useGameStore.getState().gameMode;
    }

    public getConnectionStatus(): string {
        return useGameStore.getState().connectionStatus;
    }

    public getIsSpectating(): boolean {
        return useGameStore.getState().isSpectating;
    }
}
