
import React, { useState } from 'react';
import { OptionsScreen } from './OptionsScreen';

interface PauseScreenProps {
    onResume: () => void;
    onQuit: () => void;
}

// Menu button component with hover effects
const MenuButton: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
}> = ({ onClick, children, variant = 'primary' }) => (
    <button
        onClick={onClick}
        className={`group relative w-64 py-4 overflow-hidden transition-all duration-300
                   border-2 ${variant === 'primary' 
                       ? 'border-stone-600 hover:border-amber-600 bg-black/50 hover:bg-amber-950/20' 
                       : 'border-stone-700 hover:border-red-700 bg-black/30 hover:bg-red-950/20'}`}
    >
        {/* Animated background sweep */}
        <div className={`absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%]
                       transition-transform duration-500 ease-out
                       ${variant === 'primary' 
                           ? 'bg-gradient-to-r from-transparent via-amber-600/20 to-transparent' 
                           : 'bg-gradient-to-r from-transparent via-red-600/20 to-transparent'}`} 
        />
        
        {/* Button text */}
        <span className={`relative text-sm tracking-[0.3em] uppercase font-bold font-mono
                        transition-colors duration-300
                        ${variant === 'primary' 
                            ? 'text-stone-300 group-hover:text-amber-200' 
                            : 'text-stone-400 group-hover:text-red-200'}`}>
            {children}
        </span>
        
        {/* Corner accents */}
        <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 transition-colors duration-300
                        ${variant === 'primary' 
                            ? 'border-stone-600 group-hover:border-amber-500' 
                            : 'border-stone-700 group-hover:border-red-600'}`} />
        <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 transition-colors duration-300
                        ${variant === 'primary' 
                            ? 'border-stone-600 group-hover:border-amber-500' 
                            : 'border-stone-700 group-hover:border-red-600'}`} />
        <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 transition-colors duration-300
                        ${variant === 'primary' 
                            ? 'border-stone-600 group-hover:border-amber-500' 
                            : 'border-stone-700 group-hover:border-red-600'}`} />
        <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 transition-colors duration-300
                        ${variant === 'primary' 
                            ? 'border-stone-600 group-hover:border-amber-500' 
                            : 'border-stone-700 group-hover:border-red-600'}`} />
    </button>
);

export const PauseScreen: React.FC<PauseScreenProps> = ({ onResume, onQuit }) => {
    const [showOptions, setShowOptions] = useState(false);

    const handleBackFromOptions = () => {
        setShowOptions(false);
    };

    if (showOptions) {
        return <OptionsScreen onBack={handleBackFromOptions} />;
    }

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-auto">
            {/* Background overlay */}
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
            <div className="relative z-10 text-center" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {/* PAUSED title */}
                <h1 className="text-7xl font-black text-stone-300 tracking-[0.5em] uppercase mb-4
                             drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
                    style={{ textShadow: '0 4px 0 rgba(0,0,0,0.8)' }}>
                    PAUSED
                </h1>
                
                {/* Decorative line */}
                <div className="flex items-center justify-center gap-4 mb-12">
                    <div className="w-24 h-[1px] bg-gradient-to-r from-transparent to-stone-600" />
                    <div className="w-2 h-2 rotate-45 border border-stone-600" />
                    <div className="w-24 h-[1px] bg-gradient-to-l from-transparent to-stone-600" />
                </div>
                
                {/* Menu buttons */}
                <div className="flex flex-col gap-4 items-center">
                    <MenuButton onClick={onResume} variant="primary">
                        Resume Game
                    </MenuButton>
                    
                    <MenuButton onClick={() => setShowOptions(true)} variant="primary">
                        Options
                    </MenuButton>
                    
                    <MenuButton onClick={onQuit} variant="secondary">
                        Quit to Menu
                    </MenuButton>
                </div>
                
                {/* Help text */}
                <p className="mt-8 text-stone-600 text-xs tracking-[0.2em] uppercase font-mono">
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
