
import React from 'react';
import { useGameStore } from '../../store/useGameStore';

interface OptionsScreenProps {
    onBack: () => void;
}

export const OptionsScreen: React.FC<OptionsScreenProps> = ({ onBack }) => {
    const settings = useGameStore(s => s.settings);
    const updateSettings = useGameStore(s => s.updateSettings);
    const resetSettings = useGameStore(s => s.resetSettings);

    const handleToggleInput = () => {
        updateSettings({ inputDevice: settings.inputDevice === 'KM' ? 'CONTROLLER' : 'KM' });
    };

    return (
        <div className="absolute inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center font-serif pointer-events-auto backdrop-blur-md">
            <h2 className="text-5xl text-stone-200 font-bold mb-10 tracking-[0.1em] border-b border-red-900/30 pb-4">OPTIONS</h2>
            
            <div className="flex flex-col gap-8 w-[500px] bg-stone-900/20 p-8 border border-white/5 shadow-2xl">
                
                {/* Input Device Toggle */}
                <div className="flex justify-between items-center group">
                    <span className="text-stone-400 text-xl tracking-wider group-hover:text-stone-200 transition-colors">CONTROL SCHEME</span>
                    <button 
                        onClick={handleToggleInput}
                        className="bg-red-900/20 border border-red-900/50 px-6 py-2 text-red-500 hover:bg-red-500 hover:text-white transition-all min-w-[180px] font-bold tracking-widest"
                    >
                        {settings.inputDevice === 'KM' ? 'MOUSE & KB' : 'CONTROLLER'}
                    </button>
                </div>

                {/* Mouse Sensitivity */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-stone-400 text-sm tracking-widest uppercase">
                        <span>Mouse Sensitivity</span>
                        <span>{settings.mouseSensitivity.toFixed(1)}</span>
                    </div>
                    <input 
                        type="range" min="0.1" max="5.0" step="0.1"
                        value={settings.mouseSensitivity}
                        onChange={(e) => updateSettings({ mouseSensitivity: parseFloat(e.target.value) })}
                        className="w-full accent-red-600 bg-stone-800 h-2 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Controller Sensitivity */}
                <div className="flex flex-col gap-2 opacity-50 hover:opacity-100 transition-opacity">
                    <div className="flex justify-between text-stone-400 text-sm tracking-widest uppercase">
                        <span>Stick Sensitivity</span>
                        <span>{settings.controllerSensitivity.toFixed(1)}</span>
                    </div>
                    <input 
                        type="range" min="0.1" max="10.0" step="0.1"
                        value={settings.controllerSensitivity}
                        onChange={(e) => updateSettings({ controllerSensitivity: parseFloat(e.target.value) })}
                        disabled={settings.inputDevice === 'KM'}
                        className="w-full accent-red-600 bg-stone-800 h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                </div>

                {/* Controller Deadzone */}
                <div className="flex flex-col gap-2 opacity-50 hover:opacity-100 transition-opacity">
                    <div className="flex justify-between text-stone-400 text-sm tracking-widest uppercase">
                        <span>Stick Deadzone</span>
                        <span>{settings.controllerDeadzone.toFixed(2)}</span>
                    </div>
                    <input 
                        type="range" min="0.05" max="0.30" step="0.01"
                        value={settings.controllerDeadzone}
                        onChange={(e) => updateSettings({ controllerDeadzone: parseFloat(e.target.value) })}
                        disabled={settings.inputDevice === 'KM'}
                        className="w-full accent-red-600 bg-stone-800 h-2 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                </div>

                <button 
                    onClick={resetSettings}
                    className="mt-4 text-red-900/60 hover:text-red-500 text-xs uppercase tracking-[0.2em] transition-colors self-end"
                >
                    Reset to Defaults
                </button>

            </div>

            <button 
                onClick={onBack}
                className="mt-12 text-stone-600 hover:text-white text-xl uppercase tracking-[0.3em] transition-all py-2 px-10 border border-transparent hover:border-white/10"
            >
                Back to Pause
            </button>
        </div>
    );
};
