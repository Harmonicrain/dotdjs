
import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const WeaponAdsDebugOverlay = () => {
    const info = useGameStore(s => s.weaponAdsDebugInfo);

    if (!info) return null;

    const fmt = (val: number) => val.toFixed(4);

    return (
        <div className="absolute top-10 right-10 w-96 bg-black/90 border-2 border-cyan-500/60 p-4 font-mono text-xs text-white z-[950] select-none">
            <div className="text-cyan-400 font-bold border-b border-cyan-500/30 pb-1 mb-3 uppercase tracking-widest text-sm">
                Weapon ADS Debug
            </div>

            <div className="text-gray-400 text-[10px] mb-2">
                Weapon: <span className="text-white">{info.weaponName}</span>
                {' '}(<span className="text-cyan-300">{info.weaponId}</span>)
            </div>

            <div className="space-y-2 mb-4">
                <div className="text-gray-400 text-[10px] uppercase mb-1">ADS Position</div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-red-950/40 border border-red-800/30 p-2 rounded text-center">
                        <div className="text-red-400 text-[9px] uppercase mb-1">X (right)</div>
                        <div className="text-white text-sm font-bold">{fmt(info.x)}</div>
                    </div>
                    <div className="bg-green-950/40 border border-green-800/30 p-2 rounded text-center">
                        <div className="text-green-400 text-[9px] uppercase mb-1">Y (up)</div>
                        <div className="text-white text-sm font-bold">{fmt(info.y)}</div>
                    </div>
                    <div className="bg-blue-950/40 border border-blue-800/30 p-2 rounded text-center">
                        <div className="text-blue-400 text-[9px] uppercase mb-1">Z (fwd)</div>
                        <div className="text-white text-sm font-bold">{fmt(info.z)}</div>
                    </div>
                </div>
            </div>

            <div className="border-t border-cyan-500/20 pt-2 space-y-1">
                <div className="text-gray-400 text-[10px] uppercase mb-1">Config Value (copy this)</div>
                <div className="bg-gray-900 border border-gray-700 rounded p-2 text-cyan-300 text-[11px]">
                    adsPos: {'{'} x: {fmt(info.x)}, y: {fmt(info.y)}, z: {fmt(info.z)} {'}'}
                </div>
            </div>

            <div className="mt-2 text-[10px] text-gray-500">
                Step: <span className="text-cyan-400">{info.step === 0.02 ? '0.02 (fast)' : '0.005 (normal)'}</span>
            </div>

            <div className="mt-3 pt-2 border-t border-cyan-500/20 text-[9px] text-gray-500 space-y-1">
                <div><span className="text-cyan-400">A/D</span> — move left/right (x)</div>
                <div><span className="text-cyan-400">W/S</span> — move up/down (y)</div>
                <div><span className="text-cyan-400">E/Q</span> — move forward/back (z)</div>
                <div><span className="text-cyan-400">Shift</span> — hold for fast mode (4x speed)</div>
            </div>
        </div>
    );
};
