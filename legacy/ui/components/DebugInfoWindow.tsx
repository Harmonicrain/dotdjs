
import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const DebugInfoWindow = () => {
    const debugInfo = useGameStore(s => s.debugInfo);

    if (!debugInfo) return null;

    const fmt = (val: number) => val.toFixed(2);

    return (
        <div className="absolute bottom-10 right-10 w-80 bg-black/80 border-2 border-red-900/50 p-4 font-mono text-xs text-white z-[900]">
            <div className="text-red-500 font-bold border-b border-red-900/30 pb-1 mb-2 uppercase tracking-widest">
                Debug Inspector
            </div>
            
            <div className="space-y-2">
                <div>
                    <span className="text-gray-400">Name:</span> {debugInfo.name}
                </div>
                
                <div>
                    <div className="text-gray-400 mb-1 text-[10px] uppercase">Position</div>
                    <div className="grid grid-cols-3 gap-1">
                        <div className="bg-red-950/30 p-1 rounded">X: {fmt(debugInfo.position.x)}</div>
                        <div className="bg-green-950/30 p-1 rounded">Y: {fmt(debugInfo.position.y)}</div>
                        <div className="bg-blue-950/30 p-1 rounded">Z: {fmt(debugInfo.position.z)}</div>
                    </div>
                </div>

                <div>
                    <div className="text-gray-400 mb-1 text-[10px] uppercase">Rotation</div>
                    <div className="grid grid-cols-3 gap-1">
                        <div className="bg-white/5 p-1 rounded">X: {fmt(debugInfo.rotation.x)}</div>
                        <div className="bg-white/5 p-1 rounded">Y: {fmt(debugInfo.rotation.y)}</div>
                        <div className="bg-white/5 p-1 rounded">Z: {fmt(debugInfo.rotation.z)}</div>
                    </div>
                </div>

                <div>
                    <div className="text-gray-400 mb-1 text-[10px] uppercase">Scaling</div>
                    <div className="grid grid-cols-3 gap-1">
                        <div className="bg-white/5 p-1 rounded">X: {fmt(debugInfo.scaling.x)}</div>
                        <div className="bg-white/5 p-1 rounded">Y: {fmt(debugInfo.scaling.y)}</div>
                        <div className="bg-white/5 p-1 rounded">Z: {fmt(debugInfo.scaling.z)}</div>
                    </div>
                </div>

                <div>
                    <span className="text-gray-400">Material:</span> {debugInfo.material}
                </div>

                {debugInfo.parent && (
                    <div>
                        <span className="text-gray-400">Parent:</span> {debugInfo.parent}
                    </div>
                )}

                {debugInfo.metadata && (
                    <div className="mt-2 pt-2 border-t border-red-900/20">
                        <div className="text-gray-400 mb-1 text-[10px] uppercase">Metadata</div>
                        <pre className="text-[10px] text-green-400 overflow-hidden text-ellipsis">
                            {JSON.stringify(debugInfo.metadata, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
            
            <div className="mt-4 text-[9px] text-gray-500 italic text-center">
                Shoot another object to inspect
            </div>
        </div>
    );
};
