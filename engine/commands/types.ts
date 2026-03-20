import { StateManager } from '../../state/StateManager';

export type CommandHandler = (args: string[], sm: StateManager) => string | null;
export type CommandMap = Record<string, CommandHandler>;
