import { StateManager } from '../state/StateManager';
import { CHEAT_COMMANDS } from './commands/cheatCommands';
import { DEBUG_COMMANDS } from './commands/debugCommands';
import { buildSystemCommands } from './commands/systemCommands';
import { CommandHandler, CommandMap } from './commands/types';
import { VISUAL_COMMANDS } from './commands/visualCommands';

const BASE_COMMANDS: CommandMap = {
    ...DEBUG_COMMANDS,
    ...VISUAL_COMMANDS,
    ...CHEAT_COMMANDS,
};

const COMMANDS: CommandMap = {
    ...BASE_COMMANDS,
    ...buildSystemCommands(Object.keys(BASE_COMMANDS).sort()),
};

export type { CommandHandler };

export const executeCommand = (input: string, sm: StateManager): string => {
    if (!input.startsWith('/')) return 'Commands must start with /';

    const parts = input.substring(1).split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    const handler: CommandHandler | undefined = COMMANDS[cmd];
    if (handler) {
        try {
            return handler(args, sm) || 'Command executed.';
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return `Error executing command: ${message}`;
        }
    }

    return `Unknown command: ${cmd}. Type /help for list.`;
};
