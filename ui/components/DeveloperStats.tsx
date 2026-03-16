
import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const DeveloperStats: React.FC = () => {
    const isDebugActive = useGameStore(s => s.isDebugActive);
    const currentZone = useGameStore(s => s.currentZone);
    const pos = useGameStore(s => s.playerPosition);
    const round = useGameStore(s => s.round);
    const zombiesAlive = useGameStore(s => s.activeZombiesCount);
    const totalZombies = useGameStore(s => s.totalRoundZombies);
    const gameMode = useGameStore(s => s.gameMode);
    const connection = useGameStore(s => s.connectionStatus);

    if (!isDebugActive) return null;

    const fmt = (val: number) => val.toFixed(3);

    return (
        <div className="absolute top-10 right-10 w-72 bg-black/80 border-2 border-blue-900/50 p-4 font-mono text-[10px] text-white z-[900]">
            <div className="text-blue-400 font-bold border-b border-blue-900/30 pb-1 mb-2 uppercase tracking-widest flex justify-between">
                <span>World Stats</span>
                <span className="text-gray-500 text-[8px]">{gameMode}</span>
            </div>
            
            <div className="space-y-3">
                <div className="flex justify-between items-center bg-blue-950/20 p-2 border border-blue-900/20">
                    <span className="text-blue-300 font-bold uppercase">Current Zone:</span>
                    <span className="text-xl text-white">{currentZone === 0 ? 'NONE' : currentZone}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <div className="text-gray-400 uppercase text-[8px]">Coordinates</div>
                        <div className="text-white">X: {fmt(pos.x)}</div>
                        <div className="text-white">Y: {fmt(pos.y)}</div>
                        <div className="text-white">Z: {fmt(pos.z)}</div>
                    </div>
                    <div className="space-y-1 text-right">
                        <div className="text-gray-400 uppercase text-[8px]">Orientation</div>
                        <div className="text-white">RY: {fmt(pos.rot)}</div>
                        <div className="text-gray-400 mt-2 uppercase text-[8px]">Round Info</div>
                        <div className="text-white">R: {round}</div>
                    </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-blue-900/20">
                    <div className="flex justify-between text-gray-400 uppercase text-[8px]">
                        <span>Entities</span>
                        <span>{zombiesAlive} / {totalZombies}</span>
                    </div>
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-500" 
                            style={{ width: `${(zombiesAlive / Math.max(1, totalZombies)) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="text-[8px] text-gray-500 italic pt-1">
                    <span>Signal: {connection}</span>
                </div>
            </div>
        </div>
    );
};
