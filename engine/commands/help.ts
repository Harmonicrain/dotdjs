import { CommandDefinition } from './types';

export const createHelpCommand = (allCommandNames: string[]): CommandDefinition => ({
    name: 'help',
    handler: () => `Commands: ${allCommandNames.map((name) => `/${name}`).join(', ')}`,
});
