
import { DoorState } from './world';
import { PowerUpType, ZombieSyncData } from './ui';

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
