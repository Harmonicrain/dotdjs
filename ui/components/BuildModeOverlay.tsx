
import React from 'react';
import { useGameStore, BuildModeControlsData } from '../../store/useGameStore';

export const BuildModeOverlay: React.FC = () => {
    const buildModeControls = useGameStore(s => s.buildModeControls) as BuildModeControlsData | null;

    if (!buildModeControls) return null;

    return (
        <div className="absolute top-4 right-4 w-64 bg-black/85 border-2 border-blue-600/60 p-3 font-mono text-xs text-white z-[950] select-none pointer-events-none backdrop-blur-sm">
            <div className="text-blue-400 font-bold border-b border-blue-700/40 pb-2 mb-3 uppercase tracking-widest text-sm flex items-center justify-between">
                <span>Build Mode</span>
                <span className="text-[10px] text-blue-500 normal-case tracking-normal font-normal">/build exit</span>
            </div>

            <div className="mb-3">
                <span className="text-gray-400">Entity:</span>{' '}
                <span className="text-blue-200 font-bold">{buildModeControls.entityType}</span>
            </div>

            <div className="mb-3 px-2 py-1.5 bg-blue-900/20 rounded">
                <span className="text-gray-400">Placed:</span>{' '}
                <span className="text-blue-300 font-bold">{buildModeControls.placedCount}</span>
            </div>

            <div className="border-t border-blue-700/30 pt-2 mt-2 space-y-1.5">
                <div className="text-[11px] text-gray-300 mb-2 font-semibold">Controls:</div>
                <div className="flex justify-between text-gray-400">
                    <span><span className="text-blue-400">Q</span> / <span className="text-blue-400">E</span></span>
                    <span>Rotate</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span><span className="text-green-400">R</span> / <span className="text-red-400">F</span></span>
                    <span>Up / Down</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span><span className="text-yellow-400">Click</span></span>
                    <span>Select</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span><span className="text-yellow-400">Shoot</span></span>
                    <span>Place</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span><span className="text-yellow-400">Knife</span></span>
                    <span>Delete</span>
                </div>
                <div className="flex justify-between text-gray-400">
                    <span><span className="text-yellow-400">Walk</span></span>
                    <span>Move</span>
                </div>
            </div>
        </div>
    );
};
