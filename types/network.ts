
import { DoorState } from './world';
import { PowerUpType, ZombieSyncData } from './ui';

// Types for PeerJS (incomplete but sufficient for this usage)

export interface PeerError extends Error {
    type: string;
}

export interface DataConnection {
    open: boolean;
    peer: string;
    serialization: string;
    send: (data: unknown) => void;
    close: () => void;
    on(event: 'data', cb: (data: unknown) => void): void;
    on(event: 'open', cb: () => void): void;
    on(event: 'close', cb: () => void): void;
    on(event: 'error', cb: (err: PeerError) => void): void;
    on(event: string, cb: (...args: any[]) => void): void;
}

export interface Peer {
    id: string;
    disconnected: boolean;
    destroyed: boolean;
    on(event: 'open', cb: (id: string) => void): void;
    on(event: 'connection', cb: (conn: DataConnection) => void): void;
    on(event: 'disconnected', cb: () => void): void;
    on(event: 'error', cb: (err: PeerError) => void): void;
    on(event: string, cb: (...args: any[]) => void): void;
    connect: (id: string, options?: any) => DataConnection;
    reconnect: () => void;
    destroy: () => void;
    removeAllListeners: () => void;
}

export interface StoredPos {
    x: number;
    y: number;
    z: number;
    rot: number;
    pitch: number;
}

export interface CachedHostState {
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
    hostIsSpectating: boolean;
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
    isGameOver: boolean;
    activePowerUps: PowerUpType[];
    mysteryBox: {
        state: number;
        locIndex: number;
        lidAngle: number;
        weaponId: string | null;
        rollIndex: number;
        owner: string | null;
    };
}

export interface CachedClientState {
    pos: StoredPos;
    activeWeaponIndex: number;
    activeWeaponId: string;
    clientHealth: number;
    clientPoints: number;
    clientTotalEarned: number;
    clientPerks: Record<string, boolean>;
    clientIsDowned: boolean;
    clientIsSpectating: boolean;
    clientName: string;
    clientKills: number;
    clientShots: number;
}
