
import React from 'react';
import { useGameStore, ScaleWeaponModeData } from '../../store/useGameStore';

export const ScaleWeaponOverlay: React.FC = () => {
    const mode = useGameStore(s => s.scaleWeaponMode) as ScaleWeaponModeData | null;

    if (!mode) return null;

    const fmt = (v: number) => parseFloat(v.toPrecision(5)).toString();
    const isAll = mode.axis === 'all';

    return (
        <div className="absolute top-1/2 left-6 -translate-y-1/2 w-72 bg-black/85 border-2 border-amber-700/60 p-4 font-mono text-xs text-white z-[950] select-none pointer-events-none backdrop-blur-sm">
            <div className="text-amber-400 font-bold border-b border-amber-700/40 pb-1.5 mb-3 uppercase tracking-widest text-sm flex items-center justify-between">
                <span>Scale Tool</span>
                <span className="text-[10px] text-amber-600 normal-case tracking-normal font-normal">ESC to exit</span>
            </div>

            <div className="mb-3">
                <span className="text-gray-400">Weapon:</span>{' '}
                <span className="text-amber-200 font-bold">{mode.weaponId}</span>
            </div>

            <div className="space-y-1.5 mb-3">
                <div className="text-gray-400 text-[10px] uppercase mb-1">Scale Values</div>
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded ${mode.axis === 'x' ? 'bg-red-900/40 border border-red-500/50' : isAll ? 'bg-white/5 border border-white/10' : 'bg-white/5 border border-transparent'}`}>
                    <span className="text-red-400 font-bold w-4">X</span>
                    <span className="flex-1 text-right text-white font-bold tabular-nums">{fmt(mode.scale.x)}</span>
                </div>
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded ${mode.axis === 'y' ? 'bg-green-900/40 border border-green-500/50' : isAll ? 'bg-white/5 border border-white/10' : 'bg-white/5 border border-transparent'}`}>
                    <span className="text-green-400 font-bold w-4">Y</span>
                    <span className="flex-1 text-right text-white font-bold tabular-nums">{fmt(mode.scale.y)}</span>
                </div>
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded ${mode.axis === 'z' ? 'bg-blue-900/40 border border-blue-500/50' : isAll ? 'bg-white/5 border border-white/10' : 'bg-white/5 border border-transparent'}`}>
                    <span className="text-blue-400 font-bold w-4">Z</span>
                    <span className="flex-1 text-right text-white font-bold tabular-nums">{fmt(mode.scale.z)}</span>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-white/5 rounded">
                <span className="text-gray-400">Axis:</span>
                <span className={`font-bold ${isAll ? 'text-amber-300' : mode.axis === 'x' ? 'text-red-400' : mode.axis === 'y' ? 'text-green-400' : 'text-blue-400'}`}>
                    {mode.axis.toUpperCase()}
                </span>
                <span className="text-gray-500 ml-auto text-[10px]">X / Y / Z to toggle</span>
            </div>

            <div className="flex items-center gap-2 mb-4 px-2 py-1.5 bg-white/5 rounded">
                <span className="text-gray-400">Step:</span>
                <span className="text-amber-300 font-bold">{mode.step}</span>
                <span className="text-gray-500 ml-auto text-[10px]">[ / ] to change</span>
            </div>

            <div className="border-t border-amber-700/30 pt-2 mt-2 space-y-1">
                <div className="text-[10px] text-gray-500">
                    <span className="text-amber-500/70">Scroll</span> adjust scale
                </div>
                <div className="text-[10px] text-gray-500">
                    <span className="text-amber-500/70">X / Y / Z</span> lock axis (press again for all)
                </div>
                <div className="text-[10px] text-gray-500">
                    <span className="text-amber-500/70">[ / ]</span> step size (0.001 - 1)
                </div>
            </div>

            <div className="mt-3 pt-2 border-t border-amber-700/30">
                <div className="text-[10px] text-gray-400 uppercase mb-1">Copy-Paste Config</div>
                <div className="bg-black/60 px-2 py-1.5 rounded text-green-400 text-[11px] font-bold">
                    scaling: [{fmt(mode.scale.x)}, {fmt(mode.scale.y)}, {fmt(mode.scale.z)}]
                </div>
            </div>
        </div>
    );
};
