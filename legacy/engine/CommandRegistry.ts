import { StateManager } from '../state/StateManager';
import { COMMANDS } from './commands';
import { CommandHandler } from './commands/types';

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
