
import React from 'react';
import { useGameStore } from '../../store/useGameStore';

interface OptionsScreenProps {
    onBack: () => void;
}

// Reusable row wrapper for each option
const OptionRow: React.FC<{ children: React.ReactNode; muted?: boolean }> = ({ children, muted }) => (
    <div className={`flex flex-col gap-2 transition-opacity duration-300 ${muted ? 'opacity-40 hover:opacity-100' : ''}`}>
        {children}
    </div>
);

// Label + value display for sliders
const SliderHeader: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-center">
        <span className="text-stone-400 text-xs tracking-[0.3em] uppercase font-mono">{label}</span>
        <span className="text-stone-300 text-xs tracking-[0.2em] font-mono">{value}</span>
    </div>
);

// Styled range slider
const Slider: React.FC<{
    min: number; max: number; step: number;
    value: number; disabled?: boolean;
    onChange: (v: number) => void;
}> = ({ min, max, step, value, disabled, onChange }) => (
    <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-[3px] accent-red-600 bg-stone-700 appearance-none cursor-pointer disabled:cursor-not-allowed"
    />
);

export const OptionsScreen: React.FC<OptionsScreenProps> = ({ onBack }) => {
    const settings = useGameStore(s => s.settings);
    const updateSettings = useGameStore(s => s.updateSettings);
    const resetSettings = useGameStore(s => s.resetSettings);

    const isController = settings.inputDevice === 'CONTROLLER';

    return (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-auto">
            {/* Background */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Noise texture */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'url("https://playground.babylonjs.com/textures/noise.png")',
                    backgroundSize: '200px'
                }}
            />

            {/* Vignette */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/30 to-black/70 pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center" style={{ animation: 'fadeIn 0.3s ease-out' }}>

                {/* Title */}
                <h1 className="text-7xl font-black text-stone-300 tracking-[0.5em] uppercase mb-4
                              drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
                    style={{ textShadow: '0 4px 0 rgba(0,0,0,0.8)' }}>
                    OPTIONS
                </h1>

                {/* Decorative line */}
                <div className="flex items-center justify-center gap-4 mb-10">
                    <div className="w-24 h-[1px] bg-gradient-to-r from-transparent to-stone-600" />
                    <div className="w-2 h-2 rotate-45 border border-stone-600" />
                    <div className="w-24 h-[1px] bg-gradient-to-l from-transparent to-stone-600" />
                </div>

                {/* Options panel */}
                <div className="relative w-[480px] bg-black/50 border-2 border-stone-700 p-8 flex flex-col gap-7">
                    {/* Panel corner brackets */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-stone-500" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-stone-500" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-stone-500" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-stone-500" />

                    {/* Control scheme toggle */}
                    <OptionRow>
                        <div className="flex justify-between items-center">
                            <span className="text-stone-400 text-xs tracking-[0.3em] uppercase font-mono">Control Scheme</span>
                            <button
                                onClick={() => updateSettings({ inputDevice: isController ? 'KM' : 'CONTROLLER' })}
                                className="group relative overflow-hidden border-2 border-stone-600 hover:border-amber-600
                                           bg-black/50 hover:bg-amber-950/20 px-5 py-2 transition-all duration-300 min-w-[160px]"
                            >
                                <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%]
                                               transition-transform duration-500 ease-out
                                               bg-gradient-to-r from-transparent via-amber-600/20 to-transparent" />
                                <span className="relative text-xs tracking-[0.3em] uppercase font-bold font-mono
                                                text-stone-300 group-hover:text-amber-200 transition-colors duration-300">
                                    {isController ? 'Controller' : 'Mouse & KB'}
                                </span>
                            </button>
                        </div>
                    </OptionRow>

                    {/* Divider */}
                    <div className="h-[1px] bg-stone-800" />

                    {/* Mouse sensitivity */}
                    <OptionRow>
                        <SliderHeader
                            label="Mouse Sensitivity"
                            value={settings.mouseSensitivity.toFixed(1)}
                        />
                        <Slider
                            min={0.1} max={5.0} step={0.1}
                            value={settings.mouseSensitivity}
                            onChange={v => updateSettings({ mouseSensitivity: v })}
                        />
                    </OptionRow>

                    {/* Stick sensitivity */}
                    <OptionRow muted={!isController}>
                        <SliderHeader
                            label="Stick Sensitivity"
                            value={settings.controllerSensitivity.toFixed(1)}
                        />
                        <Slider
                            min={0.1} max={10.0} step={0.1}
                            value={settings.controllerSensitivity}
                            disabled={!isController}
                            onChange={v => updateSettings({ controllerSensitivity: v })}
                        />
                    </OptionRow>

                    {/* Stick deadzone */}
                    <OptionRow muted={!isController}>
                        <SliderHeader
                            label="Stick Deadzone"
                            value={settings.controllerDeadzone.toFixed(2)}
                        />
                        <Slider
                            min={0.05} max={0.30} step={0.01}
                            value={settings.controllerDeadzone}
                            disabled={!isController}
                            onChange={v => updateSettings({ controllerDeadzone: v })}
                        />
                    </OptionRow>

                    {/* Reset */}
                    <div className="flex justify-end pt-1">
                        <button
                            onClick={resetSettings}
                            className="text-stone-600 hover:text-red-400 text-[10px] uppercase tracking-[0.3em] font-mono transition-colors duration-300"
                        >
                            Reset to Defaults
                        </button>
                    </div>
                </div>

                {/* Back button */}
                <div className="mt-8">
                    <button
                        onClick={onBack}
                        className="group relative w-64 py-4 overflow-hidden transition-all duration-300
                                   border-2 border-stone-700 hover:border-red-700 bg-black/30 hover:bg-red-950/20"
                    >
                        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%]
                                       transition-transform duration-500 ease-out
                                       bg-gradient-to-r from-transparent via-red-600/20 to-transparent" />
                        <span className="relative text-sm tracking-[0.3em] uppercase font-bold font-mono
                                        text-stone-400 group-hover:text-red-200 transition-colors duration-300">
                            Back
                        </span>
                        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-stone-700 group-hover:border-red-600 transition-colors duration-300" />
                        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-stone-700 group-hover:border-red-600 transition-colors duration-300" />
                        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-stone-700 group-hover:border-red-600 transition-colors duration-300" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-stone-700 group-hover:border-red-600 transition-colors duration-300" />
                    </button>
                </div>

                {/* Help text */}
                <p className="mt-6 text-stone-600 text-xs tracking-[0.2em] uppercase font-mono">
                    Press ESC to resume
                </p>
            </div>

            {/* Ambient corner decorations */}
            <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-stone-800/50" />
            <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-stone-800/50" />
            <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-stone-800/50" />
            <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-stone-800/50" />
        </div>
    );
};
