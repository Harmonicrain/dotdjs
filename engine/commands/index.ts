import { ammoCommand } from './ammo';
import { bulletDebugCommand } from './bullet_debug';
import { debugCommand } from './debug';
import { debugControlsCommand } from './debug_controls';
import { debugPbrCommand } from './debug_pbr';
import { giveCommand } from './give';
import { godCommand } from './god';
import { createHelpCommand } from './help';
import { killAllCommand } from './kill_all';
import { noclipCommand } from './noclip';
import { perkCommand } from './perk';
import { pointsCommand } from './points';
import { posCommand } from './pos';
import { powerupCommand } from './powerup';
import { renderStatsCommand } from './render_stats';
import { roundCommand } from './round';
import { scaleweaponCommand } from './scaleweapon';
import { showNavmeshCommand } from './show_navmesh';
import { showPathfindingCommand } from './show_pathfinding';
import { tpCommand } from './tp';
import { weaponAdsDebugCommand } from './weapon_ads_debug';
import { wireframeCommand } from './wireframe';
import { CommandDefinition, CommandMap } from './types';

const COMMAND_DEFINITIONS: CommandDefinition[] = [
    ammoCommand,
    bulletDebugCommand,
    debugCommand,
    debugControlsCommand,
    debugPbrCommand,
    giveCommand,
    godCommand,
    killAllCommand,
    noclipCommand,
    perkCommand,
    pointsCommand,
    posCommand,
    powerupCommand,
    renderStatsCommand,
    roundCommand,
    scaleweaponCommand,
    showNavmeshCommand,
    showPathfindingCommand,
    tpCommand,
    weaponAdsDebugCommand,
    wireframeCommand,
];

const buildCommandMap = (definitions: CommandDefinition[]): CommandMap => {
    const baseCommands = definitions.reduce<CommandMap>((map, definition) => {
        map[definition.name] = definition.handler;
        return map;
    }, {});

    const baseCommandNames = Object.keys(baseCommands).sort();
    const helpCommand = createHelpCommand(baseCommandNames);

    return {
        ...baseCommands,
        [helpCommand.name]: helpCommand.handler,
    };
};

export const COMMANDS: CommandMap = buildCommandMap(COMMAND_DEFINITIONS);
