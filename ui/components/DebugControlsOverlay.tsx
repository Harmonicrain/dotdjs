
import React from 'react';
import { useGameStore } from '../../store/useGameStore';

export const DebugControlsOverlay = () => {
    const debugControls = useGameStore(s => s.debugControls);

    if (!debugControls.isActive) return null;

    const fmt = (val: number) => val.toFixed(3);
    const fmtShort = (val: number) => val.toFixed(1);

    // Color code the input source
    const sourceColor = debugControls.inputSource === 'MOUSE' 
        ? 'text-green-400' 
        : debugControls.inputSource === 'CONTROLLER' 
            ? 'text-blue-400' 
            : 'text-gray-500';

    // Color code FPS (green > 50, yellow 30-50, red < 30)
    const fpsColor = debugControls.fps >= 50 
        ? 'text-green-400' 
        : debugControls.fps >= 30 
            ? 'text-yellow-400' 
            : 'text-red-400';

    return (
        <div className="absolute top-4 right-4 z-[1000] font-mono text-xs select-none pointer-events-none">
            {/* FPS Counter - Large and prominent */}
            <div className="bg-black/90 border border-cyan-500/50 px-3 py-2 mb-2 rounded">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-cyan-400 font-bold text-[10px] uppercase tracking-wider">FPS</span>
                    <span className={`text-2xl font-bold ${fpsColor}`}>{Math.round(debugControls.fps)}</span>
                </div>
            </div>

            {/* Debug Controls Info Panel */}
            <div className="bg-black/90 border border-cyan-500/50 p-3 rounded min-w-[220px]">
                <div className="text-cyan-400 font-bold border-b border-cyan-500/30 pb-1 mb-2 text-[10px] uppercase tracking-wider">
                    Input Debug
                </div>

                {/* Input Source */}
                <div className="flex justify-between items-center mb-2 bg-cyan-950/30 p-2 rounded">
                    <span className="text-gray-400 text-[10px] uppercase">Active Input:</span>
                    <span className={`font-bold ${sourceColor}`}>{debugControls.inputSource}</span>
                </div>

                {/* Camera Rotation */}
                <div className="mb-2">
                    <div className="text-gray-500 text-[9px] uppercase mb-1">Camera Rotation</div>
                    <div className="grid grid-cols-2 gap-2 text-white">
                        <div>X: <span className="text-cyan-300">{fmt(debugControls.cameraRotation.x)}</span></div>
                        <div>Y: <span className="text-cyan-300">{fmt(debugControls.cameraRotation.y)}</span></div>
                    </div>
                </div>

                {/* Mouse Delta */}
                <div className="mb-2">
                    <div className="text-gray-500 text-[9px] uppercase mb-1">Mouse Delta (raw)</div>
                    <div className="grid grid-cols-2 gap-2 text-white">
                        <div>dX: <span className="text-green-300">{fmtShort(debugControls.rawMouseDelta.x)}</span></div>
                        <div>dY: <span className="text-green-300">{fmtShort(debugControls.rawMouseDelta.y)}</span></div>
                    </div>
                </div>

                {/* Controller Look */}
                <div>
                    <div className="text-gray-500 text-[9px] uppercase mb-1">Controller Look</div>
                    <div className="grid grid-cols-2 gap-2 text-white">
                        <div>X: <span className="text-blue-300">{fmt(debugControls.rawControllerLook.x)}</span></div>
                        <div>Y: <span className="text-blue-300">{fmt(debugControls.rawControllerLook.y)}</span></div>
                    </div>
                </div>

                {/* Visual indicator bars for input magnitude */}
                <div className="mt-3 pt-2 border-t border-cyan-500/20">
                    <div className="text-gray-500 text-[9px] uppercase mb-1">Input Magnitude</div>
                    
                    {/* Mouse bar */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-green-400 text-[9px] w-12">MOUSE</span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-green-500 transition-all duration-75"
                                style={{ 
                                    width: `${Math.min(100, Math.sqrt(
                                        debugControls.rawMouseDelta.x ** 2 + 
                                        debugControls.rawMouseDelta.y ** 2
                                    ) * 2)}%` 
                                }}
                            />
                        </div>
                    </div>
                    
                    {/* Controller bar */}
                    <div className="flex items-center gap-2">
                        <span className="text-blue-400 text-[9px] w-12">CTRL</span>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 transition-all duration-75"
                                style={{ 
                                    width: `${Math.min(100, Math.sqrt(
                                        debugControls.rawControllerLook.x ** 2 + 
                                        debugControls.rawControllerLook.y ** 2
                                    ) * 100)}%` 
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
