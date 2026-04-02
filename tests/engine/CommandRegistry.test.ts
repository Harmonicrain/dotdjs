import { describe, expect, it } from 'vitest';
import { executeCommand } from '../../engine/CommandRegistry';

describe('CommandRegistry', () => {
    it('rejects commands without a slash prefix', () => {
        expect(executeCommand('help', {} as any)).toBe('Commands must start with /');
    });

    it('returns an alphabetized help list from the assembled registry', () => {
        expect(executeCommand('/help', {} as any)).toBe(
            'Commands: /ammo, /bullet_debug, /debug, /debug_controls, /debug_pbr, /give, /god, /kill_all, /noclip, /perk, /points, /pos, /powerup, /render_stats, /round, /scaleweapon, /show_navmesh, /show_pathfinding, /tp, /weapon_ads_debug, /wireframe'
        );
    });

    it('returns an unknown command error for missing commands', () => {
        expect(executeCommand('/missing', {} as any)).toBe('Unknown command: missing. Type /help for list.');
    });
});
