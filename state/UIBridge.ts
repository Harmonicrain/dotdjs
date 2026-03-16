
import { GameStateData, PowerUpType, DebugInfo } from '../types/index';
import { PlayerFields, GameFields, ScaleWeaponModeData, DebugControlsData, RenderStatsData, KillEvent, useGameStore } from '../store/useGameStore';

type UpdatePlayer = (updates: Partial<PlayerFields>) => void;
type UpdateGame = (updates: Partial<GameFields>) => void;

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
        points: -1,
        totalEarnedPoints: -1,
        health: -1,
        ammo: -1,
        reserveAmmo: -1,
        activeWeaponIndex: -1,
        weaponName: '',
        activeZombiesCount: -1,
        totalRoundZombies: -1,
        hoverMsg: null as string | null,
        interactionMsg: null as string | null,
        isBeingRevived: false,
        kills: -1,
        shotsFired: -1,
        playerName: '',
        debugInfo: null as DebugInfo | null,
        flashColor: null as string | null,
        zombiesSpawned: -1,
        zombiesKilledInRound: -1,
        zombiesToSpawn: -1,
        debugControlsFps: 0,
        debugControlsSource: 'NONE' as string,
    };

    private checkThrottle(key: string): boolean {
        const now = Date.now();
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
    ) { }

    // ── Player setters ───────────────────────────────────────────────────

    public setPoints(v: number) {
        this.gameState.points = v;
        // Points must always flush immediately — no throttle.
        // They are event-driven (kills, purchases), not per-frame, so the cost
        // is negligible. Throttling caused the store to lag behind gameState,
        // making the PlayerStatus diff animation show wrong deltas (e.g. -490
        // instead of -500 when a buffered +10 kill bonus hadn't been pushed yet).
        if (this.uiCache.points !== v) {
            this.uiCache.points = v;
            this._updatePlayer({ points: v });
        }
    }

    public setTotalEarnedPoints(v: number) {
        this.gameState.totalEarnedPoints = v;
        if (this.uiCache.totalEarnedPoints !== v) {
            // Throttled: updated on every point gain (high frequency), but only
            // used for end-of-game stats — no visual urgency.
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
            // Throttled: automatic weapons fire every ~75ms, producing per-frame updates.
            if (this.checkThrottle('ammo')) {
                this.uiCache.ammo = v;
                this._updatePlayer({ ammo: v });
            }
        }
    }


    public setReserveAmmo(v: number) {
        // Not throttled: only changes on reload or max-ammo pickup (low frequency).
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
        // Not throttled: kill events are spaced by gameplay (not per-frame) and
        // drive visible HUD updates (kill feed).
        if (this.uiCache.kills !== v) {
            this.uiCache.kills = v;
            this._updatePlayer({ kills: v });
        }
    }

    public pushKillEvent(event: KillEvent) {
        const current = useGameStore.getState().killEvents;
        // Keep only the last 5 events to avoid unbounded growth
        const updated = [...current.slice(-4), event];
        this._updatePlayer({ killEvents: updated });
    }

    public clearKillEvents() {
        this._updatePlayer({ killEvents: [] });
    }

    public setShotsFired(v: number) {
        if (this.uiCache.shotsFired !== v) {
            // Throttled: increments every shot — only used for accuracy stats, no visual urgency.
            if (this.checkThrottle('shotsFired')) {
                this.uiCache.shotsFired = v;
                this._updatePlayer({ shotsFired: v });
            }
        }
    }

    public setFlashColor(v: string | null) {
        if (this.uiCache.flashColor !== v) {
            this.uiCache.flashColor = v;
            this._updatePlayer({ flashColor: v });
        }
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
        if (this.uiCache.zombiesSpawned !== v) {
            this.uiCache.zombiesSpawned = v;
            this._updateGame({ zombiesSpawned: v });
        }
    }

    public setZombiesKilledInRound(v: number) {
        this.gameState.zombiesKilledInRound = v;
        if (this.uiCache.zombiesKilledInRound !== v) {
            this.uiCache.zombiesKilledInRound = v;
            this._updateGame({ zombiesKilledInRound: v });
        }
    }

    public setZombiesToSpawn(v: number) {
        this.gameState.zombiesToSpawn = v;
        if (this.uiCache.zombiesToSpawn !== v) {
            this.uiCache.zombiesToSpawn = v;
            this._updateGame({ zombiesToSpawn: v });
        }
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
        const cached = this.uiCache.debugInfo;
        if (cached === v) return;
        if (cached && v &&
            cached.name === v.name &&
            cached.position.x === v.position.x &&
            cached.position.y === v.position.y &&
            cached.position.z === v.position.z) return;
        this.uiCache.debugInfo = v;
        this._updateGame({ debugInfo: v });
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
        const fps = data.fps ?? 0;
        const src = data.inputSource ?? 'NONE';
        const isToggle = data.isActive !== undefined;
        if (!isToggle &&
            this.uiCache.debugControlsFps === fps &&
            this.uiCache.debugControlsSource === src) return;
        if (isToggle || this.checkThrottle('debugControls')) {
            this.uiCache.debugControlsFps = fps;
            this.uiCache.debugControlsSource = src;
            this._updateGame({
                debugControls: {
                    isActive: data.isActive ?? false,
                    fps,
                    inputSource: src,
                    cameraRotation: data.cameraRotation ?? { x: 0, y: 0 },
                    rawMouseDelta: data.rawMouseDelta ?? { x: 0, y: 0 },
                    rawControllerLook: data.rawControllerLook ?? { x: 0, y: 0 },
                }
            });
        }
    }

    public setRenderStats(data: Partial<RenderStatsData>) {
        const isToggle = data.isActive !== undefined;
        if (isToggle || this.checkThrottle('renderStats')) {
            this._updateGame({
                renderStats: {
                    isActive: data.isActive ?? false,
                    rendererType: data.rendererType ?? 'WebGL',
                    drawCalls: data.drawCalls ?? 0,
                    activeMeshes: data.activeMeshes ?? 0,
                    totalMeshes: data.totalMeshes ?? 0,
                    totalVertices: data.totalVertices ?? 0,
                    totalFaces: data.totalFaces ?? 0,
                    activeLights: data.activeLights ?? 0,
                    totalLights: data.totalLights ?? 0,
                    pbrMaterials: data.pbrMaterials ?? 0,
                    totalMaterials: data.totalMaterials ?? 0,
                    shadowGenerators: data.shadowGenerators ?? 0,
                    shadowMapSize: data.shadowMapSize ?? 0,
                    textures: data.textures ?? 0,
                    particleSystems: data.particleSystems ?? 0,
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

    public getIsDebugActive(): boolean {
        return useGameStore.getState().isDebugActive;
    }
}
