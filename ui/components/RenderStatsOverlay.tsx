
import React from 'react';
import { useGameStore, RenderStatsData } from '../../store/useGameStore';

/** Returns a Tailwind text color class: green = good, yellow = caution, red = bad */
const statColor = (value: number, green: number, yellow: number): string => {
    if (value <= green) return 'text-green-400';
    if (value <= yellow) return 'text-yellow-400';
    return 'text-red-400';
};

/** Inverse: higher is worse (e.g. shadow map size — lower is cheaper) */
const statColorInverse = (value: number, green: number, yellow: number): string => {
    if (value <= green) return 'text-green-400';
    if (value <= yellow) return 'text-yellow-400';
    return 'text-red-400';
};

interface StatRowProps {
    label: string;
    value: string | number;
    colorClass: string;
}

const StatRow: React.FC<StatRowProps> = ({ label, value, colorClass }) => (
    <div className="flex justify-between items-center">
        <span className="text-gray-400 text-[10px] uppercase">{label}</span>
        <span className={`font-bold tabular-nums ${colorClass}`}>{value}</span>
    </div>
);

interface StatBarProps {
    label: string;
    value: number;
    max: number;
    thresholds: [number, number]; // [green, yellow] — above yellow = red
}

const StatBar: React.FC<StatBarProps> = ({ label, value, max, thresholds }) => {
    const pct = Math.min(100, (value / max) * 100);
    const color = value <= thresholds[0]
        ? 'bg-green-500'
        : value <= thresholds[1]
            ? 'bg-yellow-500'
            : 'bg-red-500';

    return (
        <div className="mb-1.5">
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-gray-400 text-[10px] uppercase">{label}</span>
                <span className={`font-bold tabular-nums text-[11px] ${
                    value <= thresholds[0] ? 'text-green-400' : value <= thresholds[1] ? 'text-yellow-400' : 'text-red-400'
                }`}>{value.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-150`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

const formatK = (n: number): string => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export const RenderStatsOverlay: React.FC = () => {
    const stats: RenderStatsData = useGameStore(s => s.renderStats);

    if (!stats.isActive) return null;

    return (
        <div className="absolute top-4 left-4 z-[1000] font-mono text-xs select-none pointer-events-none">
            <div className="bg-black/90 border border-orange-500/50 p-3 rounded min-w-[260px]">
                <div className="flex justify-between items-center border-b border-orange-500/30 pb-1 mb-2">
                    <span className="text-orange-400 font-bold text-[10px] uppercase tracking-wider">
                        Render Stats
                    </span>
                    <span className={`font-bold text-[10px] uppercase tracking-wider ${
                        stats.rendererType === 'WebGPU' ? 'text-green-400' : 'text-blue-400'
                    }`}>
                        {stats.rendererType}
                    </span>
                </div>

                {/* Draw Calls — the #1 GPU performance metric */}
                <StatBar label="Draw Calls" value={stats.drawCalls} max={500} thresholds={[100, 250]} />

                {/* Active Meshes */}
                <StatBar label="Active Meshes" value={stats.activeMeshes} max={1000} thresholds={[200, 500]} />

                {/* Triangles */}
                <StatBar label="Triangles" value={stats.totalFaces} max={500000} thresholds={[100000, 300000]} />

                {/* Vertices */}
                <div className="mb-2">
                    <StatRow
                        label="Vertices"
                        value={formatK(stats.totalVertices)}
                        colorClass={statColor(stats.totalVertices, 150000, 400000)}
                    />
                </div>

                {/* Divider */}
                <div className="border-t border-orange-500/20 my-2" />

                {/* Lighting & Shadows */}
                <div className="text-gray-500 text-[9px] uppercase mb-1">Lighting & Shadows</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                    <StatRow
                        label="Lights"
                        value={`${stats.activeLights} / ${stats.totalLights}`}
                        colorClass={statColorInverse(stats.activeLights, 4, 8)}
                    />
                    <StatRow
                        label="Shadow Gens"
                        value={stats.shadowGenerators}
                        colorClass={statColorInverse(stats.shadowGenerators, 1, 3)}
                    />
                    <StatRow
                        label="Shadow Map"
                        value={stats.shadowMapSize > 0 ? `${stats.shadowMapSize}px` : 'none'}
                        colorClass={stats.shadowMapSize === 0 ? 'text-green-400' : statColorInverse(stats.shadowMapSize, 1024, 2048)}
                    />
                </div>

                {/* Divider */}
                <div className="border-t border-orange-500/20 my-2" />

                {/* Materials & Textures */}
                <div className="text-gray-500 text-[9px] uppercase mb-1">Materials & Textures</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                    <StatRow
                        label="PBR Mats"
                        value={stats.pbrMaterials}
                        colorClass={statColorInverse(stats.pbrMaterials, 20, 50)}
                    />
                    <StatRow
                        label="Total Mats"
                        value={stats.totalMaterials}
                        colorClass={statColorInverse(stats.totalMaterials, 30, 80)}
                    />
                    <StatRow
                        label="Textures"
                        value={stats.textures}
                        colorClass={statColorInverse(stats.textures, 30, 60)}
                    />
                    <StatRow
                        label="Particles"
                        value={stats.particleSystems}
                        colorClass={statColorInverse(stats.particleSystems, 10, 30)}
                    />
                </div>

                {/* Total meshes (informational) */}
                <div className="border-t border-orange-500/20 pt-1.5">
                    <StatRow
                        label="Total Meshes (scene)"
                        value={stats.totalMeshes}
                        colorClass="text-gray-300"
                    />
                </div>
            </div>
        </div>
    );
};
