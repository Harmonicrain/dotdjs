
import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const BulletDebugOverlay = () => {
    const info = useGameStore(s => s.bulletDebugInfo);

    if (!info) return null;

    const fmt = (val: number) => val.toFixed(4);

    return (
        <div className="absolute top-10 left-10 w-96 bg-black/90 border-2 border-yellow-500/60 p-4 font-mono text-xs text-white z-[950] select-none">
            <div className="text-yellow-400 font-bold border-b border-yellow-500/30 pb-1 mb-3 uppercase tracking-widest text-sm">
                Bullet Spawn Debug
            </div>

            <div className="text-gray-400 text-[10px] mb-2">
                Weapon: <span className="text-white">{info.weaponName}</span>
                {' '}({info.isAds ? 'ADS' : 'Hip-fire'})
            </div>

            <div className="space-y-2 mb-4">
                <div className="text-gray-400 text-[10px] uppercase mb-1">Camera-Relative Offset</div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-red-950/40 border border-red-800/30 p-2 rounded text-center">
                        <div className="text-red-400 text-[9px] uppercase mb-1">Right</div>
                        <div className="text-white text-sm font-bold">{fmt(info.right)}</div>
                    </div>
                    <div className="bg-green-950/40 border border-green-800/30 p-2 rounded text-center">
                        <div className="text-green-400 text-[9px] uppercase mb-1">Up</div>
                        <div className="text-white text-sm font-bold">{fmt(info.up)}</div>
                    </div>
                    <div className="bg-blue-950/40 border border-blue-800/30 p-2 rounded text-center">
                        <div className="text-blue-400 text-[9px] uppercase mb-1">Forward</div>
                        <div className="text-white text-sm font-bold">{fmt(info.forward)}</div>
                    </div>
                </div>
            </div>

            <div className="border-t border-yellow-500/20 pt-2 space-y-1">
                <div className="text-gray-400 text-[10px] uppercase mb-1">Suggested Config Values</div>
                <div className="text-yellow-300 text-[11px]">
                    hipPos.x: <span className="text-white">{fmt(info.right)}</span>
                </div>
                <div className="text-yellow-300 text-[11px]">
                    hipPos.y: <span className="text-white">{fmt(info.up)}</span>
                </div>
                <div className="text-yellow-300 text-[11px]">
                    hipPos.z + barrelLength: <span className="text-white">{fmt(info.forward)}</span>
                </div>
            </div>

            <div className="mt-3 pt-2 border-t border-yellow-500/20 text-[9px] text-gray-500 space-y-1">
                <div><span className="text-yellow-400">A/D</span> — move left/right</div>
                <div><span className="text-yellow-400">W/S</span> — move up/down</div>
                <div><span className="text-yellow-400">E/Q</span> — move forward/back (depth)</div>
                <div><span className="text-yellow-400">Shift</span> — hold for fast movement (4x speed)</div>
                <div>Fire to respawn bullet at current muzzle</div>
            </div>
        </div>
    );
};
