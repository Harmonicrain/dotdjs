import { describe, expect, it } from 'vitest';
import { NetworkDeltaCompressor } from '../../network/NetworkDeltaCompressor';

describe('NetworkDeltaCompressor', () => {
    it('includes round progression and game-over fields in full host syncs', () => {
        const compressor = new NetworkDeltaCompressor();

        const message = compressor.computeHostDelta(1000, {
            doors: {},
            hostPos: { x: 1, y: 2, z: 3, rot: 4, pitch: 5 },
            activeWeaponIndex: 1,
            activeWeaponId: 'rifle',
            hostHealth: 90,
            hostPoints: 1230,
            hostTotalEarned: 1400,
            hostName: 'Host',
            hostPerks: { juggernog: true },
            hostIsDowned: false,
            hostIsSpectating: false,
            hostKills: 12,
            hostShots: 34,
            zombies: [],
            windowStates: {},
            activeZombiesCount: 5,
            totalRoundZombies: 24,
            zombiesSpawned: 9,
            zombiesKilledInRound: 7,
            round: 3,
            powerOn: true,
            isDogRound: false,
            isGameOver: true,
            activePowerUps: [],
            mysteryBox: {
                state: 1,
                locIndex: 2,
                lidAngle: 0.5,
                weaponId: 'raygun',
                rollIndex: 3,
                owner: 'Host',
            },
        });

        expect(message._full).toBe(true);
        expect(message.zombiesSpawned).toBe(9);
        expect(message.zombiesKilledInRound).toBe(7);
        expect(message.isGameOver).toBe(true);
    });

    it('emits changed round progression and game-over fields in host deltas', () => {
        const compressor = new NetworkDeltaCompressor();

        compressor.computeHostDelta(1000, {
            doors: {},
            hostPos: { x: 0, y: 0, z: 0, rot: 0, pitch: 0 },
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            hostHealth: 100,
            hostPoints: 500,
            hostTotalEarned: 500,
            hostName: 'Host',
            hostPerks: {},
            hostIsDowned: false,
            hostIsSpectating: false,
            hostKills: 0,
            hostShots: 0,
            zombies: [],
            windowStates: {},
            activeZombiesCount: 0,
            totalRoundZombies: 6,
            zombiesSpawned: 1,
            zombiesKilledInRound: 0,
            round: 1,
            powerOn: false,
            isDogRound: false,
            isGameOver: false,
            activePowerUps: [],
            mysteryBox: {
                state: 0,
                locIndex: 0,
                lidAngle: 0,
                weaponId: null,
                rollIndex: 0,
                owner: null,
            },
        });

        const message = compressor.computeHostDelta(1100, {
            doors: {},
            hostPos: { x: 0, y: 0, z: 0, rot: 0, pitch: 0 },
            activeWeaponIndex: 0,
            activeWeaponId: 'pistol',
            hostHealth: 100,
            hostPoints: 500,
            hostTotalEarned: 500,
            hostName: 'Host',
            hostPerks: {},
            hostIsDowned: false,
            hostIsSpectating: false,
            hostKills: 0,
            hostShots: 0,
            zombies: [],
            windowStates: {},
            activeZombiesCount: 0,
            totalRoundZombies: 10,
            zombiesSpawned: 3,
            zombiesKilledInRound: 2,
            round: 2,
            powerOn: false,
            isDogRound: false,
            isGameOver: true,
            activePowerUps: [],
            mysteryBox: {
                state: 0,
                locIndex: 0,
                lidAngle: 0,
                weaponId: null,
                rollIndex: 0,
                owner: null,
            },
        });

        expect(message._full).toBeUndefined();
        expect(message.zombiesSpawned).toBe(3);
        expect(message.zombiesKilledInRound).toBe(2);
        expect(message.round).toBe(2);
        expect(message.totalRoundZombies).toBe(10);
        expect(message.isGameOver).toBe(true);
    });
});
