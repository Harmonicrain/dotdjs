
import { SYNC_CONFIG } from '../config';
import { DoorState, PowerUpType, ZombieSyncData } from '../types/index';

// ── Precision helpers ─────────────────────────────────────────────────────────

const MULT = Math.pow(10, SYNC_CONFIG.FLOAT_PRECISION);

/** Round a number to FLOAT_PRECISION decimal places before comparing / sending. */
export function rnd(v: number): number {
    return Math.round(v * MULT) / MULT;
}

export function rndPos(p: { x: number; y: number; z: number; rot: number; pitch: number }) {
    return { x: rnd(p.x), y: rnd(p.y), z: rnd(p.z), rot: rnd(p.rot), pitch: rnd(p.pitch) };
}

// ── Internal snapshot shapes ──────────────────────────────────────────────────

export interface StoredPos { x: number; y: number; z: number; rot: number; pitch: number; }

export interface MysteryBoxSnapshot {
    state: number; locIndex: number; lidAngle: number;
    weaponId: string | null; rollIndex: number; owner: string | null;
}

export interface HostSnapshot {
    doors: Record<string, DoorState>;
    hostPos: StoredPos;
    activeWeaponIndex: number;
    activeWeaponId: string;
    hostHealth: number;
    hostPoints: number;
    hostTotalEarned: number;
    hostName: string;
    hostPerks: Record<string, boolean>;
    hostIsDowned: boolean;
    hostKills: number;
    hostShots: number;
    /** Per-zombie position cache keyed by zombie id. */
    zombiePositions: Record<string, { x: number; y: number; z: number; rot: number; isBurning: boolean }>;
    /** Set of zombie ids known to be alive. */
    zombieIds: Set<string>;
    windowStates: Record<string, number>;
    activeZombiesCount: number;
    totalRoundZombies: number;
    round: number;
    powerOn: boolean;
    isDogRound: boolean;
    activePowerUps: PowerUpType[];
    mysteryBox: MysteryBoxSnapshot;
}

export interface ClientSnapshot {
    pos: StoredPos;
    activeWeaponIndex: number;
    activeWeaponId: string;
    clientHealth: number;
    clientPoints: number;
    clientTotalEarned: number;
    clientPerks: Record<string, boolean>;
    clientIsDowned: boolean;
    clientName: string;
    clientKills: number;
    clientShots: number;
}

// ── Comparison helpers ────────────────────────────────────────────────────────

function posChanged(a: StoredPos, b: StoredPos): boolean {
    return a.x !== b.x || a.y !== b.y || a.z !== b.z || a.rot !== b.rot || a.pitch !== b.pitch;
}

function doorsChanged(a: Record<string, DoorState>, b: Record<string, DoorState>): boolean {
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return true;
    for (const k of aKeys) {
        if (!b[k] || a[k].isOpen !== b[k].isOpen) return true;
    }
    return false;
}

function perksChanged(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return true;
    for (const k of aKeys) {
        if (a[k] !== b[k]) return true;
    }
    return false;
}

function windowsChanged(a: Record<string, number>, b: Record<string, number>): boolean {
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) return true;
    for (const k of aKeys) {
        if (a[k] !== b[k]) return true;
    }
    return false;
}

function powerUpsChanged(a: PowerUpType[], b: PowerUpType[]): boolean {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return true;
    }
    return false;
}

function mysteryBoxChanged(a: MysteryBoxSnapshot, b: MysteryBoxSnapshot): boolean {
    return a.state !== b.state ||
           a.locIndex !== b.locIndex ||
           a.lidAngle !== b.lidAngle ||
           a.weaponId !== b.weaponId ||
           a.rollIndex !== b.rollIndex ||
           a.owner !== b.owner;
}

// ── NetworkDeltaCompressor ────────────────────────────────────────────────────

/**
 * Tracks the last-sent snapshot for both HOST (STATE) and CLIENT (INPUT) roles
 * and produces minimal delta messages each tick.
 *
 * Call reset() on game start/restart to clear stale state.
 */
export class NetworkDeltaCompressor {
    private hostSnap: HostSnapshot | null = null;
    private clientSnap: ClientSnapshot | null = null;
    private hostSeq = 0;
    private clientSeq = 0;
    private lastFullHostAt = 0;
    private lastFullClientAt = 0;

    public reset(): void {
        this.hostSnap = null;
        this.clientSnap = null;
        this.hostSeq = 0;
        this.clientSeq = 0;
        this.lastFullHostAt = 0;
        this.lastFullClientAt = 0;
    }

    // ── HOST → CLIENT (STATE) ────────────────────────────────────────────────

    /**
     * Given the complete current HOST state, return a partial STATE object
     * containing only fields that changed since the last call.
     * Forces a full snapshot every FULL_SYNC_INTERVAL_MS ms.
     */
    public computeHostDelta(now: number, full: {
        doors: Record<string, DoorState>;
        hostPos: { x: number; y: number; z: number; rot: number; pitch: number };
        activeWeaponIndex: number;
        activeWeaponId: string;
        hostHealth: number;
        hostPoints: number;
        hostTotalEarned: number;
        hostName: string;
        hostPerks: Record<string, boolean>;
        hostIsDowned: boolean;
        hostKills: number;
        hostShots: number;
        zombies: ZombieSyncData[];
        windowStates: Record<string, number>;
        activeZombiesCount: number;
        totalRoundZombies: number;
        zombiesSpawned: number;
        zombiesKilledInRound: number;
        round: number;
        powerOn: boolean;
        isDogRound: boolean;
        activePowerUps: PowerUpType[];
        mysteryBox: {
            state: number; locIndex: number; lidAngle: number;
            weaponId: string | null; rollIndex: number; owner: string | null;
        };
    }): Record<string, any> {
        const forceFullSync =
            !this.hostSnap ||
            now - this.lastFullHostAt >= SYNC_CONFIG.FULL_SYNC_INTERVAL_MS;

        const seq = ++this.hostSeq;
        const hostPos = rndPos(full.hostPos);

        // ── Full snapshot path ────────────────────────────────────────────
        if (forceFullSync) {
            const zombiePositions: HostSnapshot['zombiePositions'] = {};
            for (const z of full.zombies) {
                zombiePositions[z.id] = {
                    x: rnd(z.x), y: rnd(z.y), z: rnd(z.z),
                    rot: rnd(z.rot), isBurning: !!z.isBurning,
                };
            }

            this.hostSnap = {
                doors: { ...full.doors },
                hostPos,
                activeWeaponIndex: full.activeWeaponIndex,
                activeWeaponId: full.activeWeaponId ?? '',
                hostHealth: full.hostHealth,
                hostPoints: full.hostPoints,
                hostTotalEarned: full.hostTotalEarned,
                hostName: full.hostName,
                hostPerks: { ...full.hostPerks },
                hostIsDowned: !!full.hostIsDowned,
                hostKills: full.hostKills,
                hostShots: full.hostShots,
                zombiePositions,
                zombieIds: new Set(full.zombies.map(z => z.id)),
                windowStates: { ...full.windowStates },
                activeZombiesCount: full.activeZombiesCount,
                totalRoundZombies: full.totalRoundZombies,
                round: full.round,
                powerOn: full.powerOn,
                isDogRound: full.isDogRound,
                activePowerUps: [ ...full.activePowerUps ],
                mysteryBox: { ...full.mysteryBox },
            };
            this.lastFullHostAt = now;

            return {
                type: 'STATE',
                _seq: seq,
                _full: true,
                doors: full.doors,
                hostPos,
                activeWeaponIndex: full.activeWeaponIndex,
                activeWeaponId: full.activeWeaponId,
                hostHealth: full.hostHealth,
                hostPoints: full.hostPoints,
                hostTotalEarned: full.hostTotalEarned,
                hostName: full.hostName,
                hostPerks: full.hostPerks,
                hostIsDowned: full.hostIsDowned,
                hostKills: full.hostKills,
                hostShots: full.hostShots,
                zombies: full.zombies.map(z => ({
                    id: z.id, type: z.type,
                    x: rnd(z.x), y: rnd(z.y), z: rnd(z.z), rot: rnd(z.rot),
                    isBurning: z.isBurning,
                })),
                removedZombieIds: [],
                windowStates: full.windowStates,
                activeZombiesCount: full.activeZombiesCount,
                totalRoundZombies: full.totalRoundZombies,
                round: full.round,
                powerOn: full.powerOn,
                isDogRound: full.isDogRound,
                activePowerUps: full.activePowerUps,
                mysteryBox: full.mysteryBox,
            };
        }

        // ── Delta path ────────────────────────────────────────────────────
        const snap = this.hostSnap!;
        const delta: Record<string, any> = { type: 'STATE', _seq: seq };

        // Position – almost always changes, so check first and always include if moved
        if (posChanged(hostPos, snap.hostPos)) {
            delta.hostPos = hostPos;
            snap.hostPos = hostPos;
        }

        // Scalar player stats
        if (full.activeWeaponIndex !== snap.activeWeaponIndex) {
            delta.activeWeaponIndex = full.activeWeaponIndex;
            snap.activeWeaponIndex = full.activeWeaponIndex;
        }
        if ((full.activeWeaponId ?? '') !== snap.activeWeaponId) {
            delta.activeWeaponId = full.activeWeaponId;
            snap.activeWeaponId = full.activeWeaponId ?? '';
        }
        if (full.hostHealth !== snap.hostHealth) {
            delta.hostHealth = full.hostHealth;
            snap.hostHealth = full.hostHealth;
        }
        if (full.hostPoints !== snap.hostPoints) {
            delta.hostPoints = full.hostPoints;
            snap.hostPoints = full.hostPoints;
        }
        if (full.hostTotalEarned !== snap.hostTotalEarned) {
            delta.hostTotalEarned = full.hostTotalEarned;
            snap.hostTotalEarned = full.hostTotalEarned;
        }
        if (full.hostName !== snap.hostName) {
            delta.hostName = full.hostName;
            snap.hostName = full.hostName;
        }
        if (!!full.hostIsDowned !== snap.hostIsDowned) {
            delta.hostIsDowned = full.hostIsDowned;
            snap.hostIsDowned = !!full.hostIsDowned;
        }
        if (full.hostKills !== snap.hostKills) {
            delta.hostKills = full.hostKills;
            snap.hostKills = full.hostKills;
        }
        if (full.hostShots !== snap.hostShots) {
            delta.hostShots = full.hostShots;
            snap.hostShots = full.hostShots;
        }
        if (full.activeZombiesCount !== snap.activeZombiesCount) {
            delta.activeZombiesCount = full.activeZombiesCount;
            snap.activeZombiesCount = full.activeZombiesCount;
        }
        if (full.totalRoundZombies !== snap.totalRoundZombies) {
            delta.totalRoundZombies = full.totalRoundZombies;
            snap.totalRoundZombies = full.totalRoundZombies;
        }
        if (full.round !== snap.round) {
            delta.round = full.round;
            snap.round = full.round;
        }
        if (full.powerOn !== snap.powerOn) {
            delta.powerOn = full.powerOn;
            snap.powerOn = full.powerOn;
        }
        if (full.isDogRound !== snap.isDogRound) {
            delta.isDogRound = full.isDogRound;
            snap.isDogRound = full.isDogRound;
        }

        // Object comparisons (cheap stringify / deep-equal helpers)
        if (perksChanged(full.hostPerks, snap.hostPerks)) {
            delta.hostPerks = full.hostPerks;
            snap.hostPerks = { ...full.hostPerks };
        }
        if (doorsChanged(full.doors, snap.doors)) {
            delta.doors = full.doors;
            snap.doors = { ...full.doors };
        }
        if (windowsChanged(full.windowStates, snap.windowStates)) {
            delta.windowStates = full.windowStates;
            snap.windowStates = { ...full.windowStates };
        }

        if (powerUpsChanged(full.activePowerUps, snap.activePowerUps)) {
            delta.activePowerUps = full.activePowerUps;
            snap.activePowerUps = [ ...full.activePowerUps ];
        }

        if (mysteryBoxChanged(full.mysteryBox, snap.mysteryBox)) {
            delta.mysteryBox = full.mysteryBox;
            snap.mysteryBox = { ...full.mysteryBox };
        }

        // ── Zombie delta ──────────────────────────────────────────────────
        const threshold = SYNC_CONFIG.ZOMBIE_POSITION_THRESHOLD;
        const changedZombies: ZombieSyncData[] = [];
        const currentIds = new Set<string>();

        for (const z of full.zombies) {
            currentIds.add(z.id);
            const rx = rnd(z.x), ry = rnd(z.y), rz = rnd(z.z), rrot = rnd(z.rot);
            const prev = snap.zombiePositions[z.id];

            if (!prev) {
                // Brand-new zombie – always include
                changedZombies.push({ id: z.id, type: z.type, x: rx, y: ry, z: rz, rot: rrot, isBurning: z.isBurning });
                snap.zombiePositions[z.id] = { x: rx, y: ry, z: rz, rot: rrot, isBurning: !!z.isBurning };
            } else {
                const moved =
                    Math.abs(rx - prev.x) > threshold ||
                    Math.abs(ry - prev.y) > threshold ||
                    Math.abs(rz - prev.z) > threshold ||
                    Math.abs(rrot - prev.rot) > threshold;
                const burnChanged = !!z.isBurning !== prev.isBurning;

                if (moved || burnChanged) {
                    changedZombies.push({ id: z.id, type: z.type, x: rx, y: ry, z: rz, rot: rrot, isBurning: z.isBurning });
                    snap.zombiePositions[z.id] = { x: rx, y: ry, z: rz, rot: rrot, isBurning: !!z.isBurning };
                }
            }
        }

        // Zombies that have gone from alive → dead since last tick
        const removedZombieIds: string[] = [];
        for (const oldId of snap.zombieIds) {
            if (!currentIds.has(oldId)) {
                removedZombieIds.push(oldId);
                delete snap.zombiePositions[oldId];
            }
        }
        snap.zombieIds = currentIds;

        if (changedZombies.length > 0) delta.zombies = changedZombies;
        if (removedZombieIds.length > 0) delta.removedZombieIds = removedZombieIds;

        return delta;
    }

    // ── CLIENT → HOST (INPUT) ────────────────────────────────────────────────

    /**
     * Given the complete current CLIENT state, return a partial INPUT object
     * containing only fields that changed since the last call.
     */
    public computeClientDelta(now: number, full: {
        pos: { x: number; y: number; z: number; rot: number; pitch: number };
        activeWeaponIndex: number;
        activeWeaponId: string;
        clientHealth: number;
        clientPoints: number;
        clientTotalEarned: number;
        clientPerks: Record<string, boolean>;
        clientIsDowned: boolean;
        clientName: string;
        clientKills: number;
        clientShots: number;
    }): Record<string, any> {
        const forceFullSync =
            !this.clientSnap ||
            now - this.lastFullClientAt >= SYNC_CONFIG.FULL_SYNC_INTERVAL_MS;

        const seq = ++this.clientSeq;
        const pos = rndPos(full.pos);

        if (forceFullSync) {
            this.clientSnap = {
                pos,
                activeWeaponIndex: full.activeWeaponIndex,
                activeWeaponId: full.activeWeaponId ?? '',
                clientHealth: full.clientHealth,
                clientPoints: full.clientPoints,
                clientTotalEarned: full.clientTotalEarned,
                clientPerks: { ...full.clientPerks },
                clientIsDowned: !!full.clientIsDowned,
                clientName: full.clientName,
                clientKills: full.clientKills,
                clientShots: full.clientShots,
            };
            this.lastFullClientAt = now;

            return { type: 'INPUT', _seq: seq, _full: true, ...full, pos };
        }

        const snap = this.clientSnap!;
        const delta: Record<string, any> = { type: 'INPUT', _seq: seq };

        if (posChanged(pos, snap.pos)) { delta.pos = pos; snap.pos = pos; }
        if (full.activeWeaponIndex !== snap.activeWeaponIndex) { delta.activeWeaponIndex = full.activeWeaponIndex; snap.activeWeaponIndex = full.activeWeaponIndex; }
        if ((full.activeWeaponId ?? '') !== snap.activeWeaponId) { delta.activeWeaponId = full.activeWeaponId; snap.activeWeaponId = full.activeWeaponId ?? ''; }
        if (full.clientHealth !== snap.clientHealth) { delta.clientHealth = full.clientHealth; snap.clientHealth = full.clientHealth; }
        if (full.clientPoints !== snap.clientPoints) { delta.clientPoints = full.clientPoints; snap.clientPoints = full.clientPoints; }
        if (full.clientTotalEarned !== snap.clientTotalEarned) { delta.clientTotalEarned = full.clientTotalEarned; snap.clientTotalEarned = full.clientTotalEarned; }
        if (!!full.clientIsDowned !== snap.clientIsDowned) { delta.clientIsDowned = full.clientIsDowned; snap.clientIsDowned = !!full.clientIsDowned; }
        if (full.clientName !== snap.clientName) { delta.clientName = full.clientName; snap.clientName = full.clientName; }
        if (full.clientKills !== snap.clientKills) { delta.clientKills = full.clientKills; snap.clientKills = full.clientKills; }
        if (full.clientShots !== snap.clientShots) { delta.clientShots = full.clientShots; snap.clientShots = full.clientShots; }
        if (perksChanged(full.clientPerks, snap.clientPerks)) { delta.clientPerks = full.clientPerks; snap.clientPerks = { ...full.clientPerks }; }

        return delta;
    }
}
