import { CommandDefinition } from './types';

export const renderStatsCommand: CommandDefinition = {
    name: 'render_stats',
    handler: (args, sm) => {
        sm.renderStatsMode.isActive = !sm.renderStatsMode.isActive;

        if (sm.renderStatsMode.isActive) {
            return 'Render Stats: ON — Showing draw calls, materials, shadows, lights';
        }
        sm.ui.setRenderStats({ isActive: false });
        return 'Render Stats: OFF';
    },
};
