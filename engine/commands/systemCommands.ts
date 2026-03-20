import { CommandMap } from './types';

export const buildSystemCommands = (allCommandNames: string[]): CommandMap => ({
    help: () => `Commands: ${allCommandNames.map((name) => `/${name}`).join(', ')}`,
});
