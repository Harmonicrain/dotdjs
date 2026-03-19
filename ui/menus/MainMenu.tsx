
import React, { useState, useEffect } from 'react';
import { MAPS } from '../../config';

interface MainMenuProps {
    selectedMap: string;
    onSelectMap: (id: string) => void;
    onStartSolo: () => void;
    onHost: () => void;
    onJoin: () => void;
    isLoading?: boolean;
}

export const MainMenu = ({ selectedMap, onSelectMap, onStartSolo, onHost, onJoin, isLoading }: MainMenuProps) => {
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);
    const [titleVisible, setTitleVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [pulseIntensity, setPulseIntensity] = useState(0);
    
    useEffect(() => {
        setTimeout(() => setTitleVisible(true), 200);
        setTimeout(() => setMenuVisible(true), 800);
    }, []);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setPulseIntensity(Math.sin(Date.now() / 1000) * 0.5 + 0.5);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    const selectedIndex = MAPS.findIndex(m => m.id === selectedMap);

    return (
        <div className="absolute inset-0 z-50 flex flex-col bg-black font-serif pointer-events-auto cursor-default overflow-hidden select-none">
            <div className="absolute inset-0 bg-gradient-to-b from-black via-stone-950 to-black" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-[200%] h-[200%] -left-1/2 -top-1/2 animate-drift opacity-10"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(139, 0, 0, 0.4) 0%, transparent 50%)',
                    }}
                />
                <div className="absolute w-[150%] h-[150%] -right-1/4 -bottom-1/4 animate-drift-slow opacity-20"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(80, 0, 0, 0.5) 0%, transparent 40%)',
                    }}
                />
            </div>
            <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-900 to-transparent animate-pulse" />
                <div className="absolute top-0 left-1/4 w-1 h-8 bg-gradient-to-b from-red-800 to-transparent animate-drip" style={{ animationDelay: '0s' }} />
                <div className="absolute top-0 left-1/2 w-1 h-12 bg-gradient-to-b from-red-900 to-transparent animate-drip" style={{ animationDelay: '1.5s' }} />
                <div className="absolute top-0 right-1/3 w-1 h-6 bg-gradient-to-b from-red-800 to-transparent animate-drip" style={{ animationDelay: '3s' }} />
            </div>
            <div 
                className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
                style={{
                    boxShadow: `inset 0 0 ${150 + pulseIntensity * 50}px ${80 + pulseIntensity * 30}px rgba(0,0,0,0.95)`,
                }}
            />
            <div className="absolute inset-0 pointer-events-none opacity-[0.04] animate-scanline"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.4) 1px, rgba(0,0,0,0.4) 2px)',
                    backgroundSize: '100% 3px'
                }}
            />

            <div className="relative flex flex-col items-center justify-between h-full py-12 z-10">
                <div className={`text-center transition-all duration-1000 ease-out ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
                    <div className="relative">
                        <h1 
                            className="text-[140px] font-black leading-none tracking-tight animate-title-glow"
                            style={{ 
                                color: '#e5e5e5',
                                textShadow: `
                                    0 0 ${40 + pulseIntensity * 20}px rgba(180, 0, 0, ${0.4 + pulseIntensity * 0.3}),
                                    0 0 80px rgba(100, 0, 0, 0.3),
                                    2px 2px 0 #2a0a0a,
                                    4px 4px 0 #1a0505,
                                    0 0 2px #8b0000
                                `,
                                WebkitTextStroke: '2px #8b0000',
                                fontFamily: 'Georgia, Times New Roman, serif',
                            }}
                        >
                            DOM
                        </h1>
                        <div className="flex items-center justify-center gap-4 my-2">
                            <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-red-900 to-red-800 animate-expand-right" />
                            <span className="text-red-900 text-2xl animate-pulse">☠</span>
                            <div className="h-[1px] w-20 bg-gradient-to-l from-transparent via-red-900 to-red-800 animate-expand-left" />
                        </div>
                        <h2 
                            className="text-4xl font-bold tracking-[0.5em] uppercase animate-subtitle-flicker"
                            style={{
                                color: '#8b0000',
                                textShadow: '0 0 30px rgba(139, 0, 0, 0.8), 0 0 60px rgba(139, 0, 0, 0.4)',
                                fontFamily: 'Georgia, Times New Roman, serif',
                            }}
                        >
                            of the Dead
                        </h2>
                    </div>
                </div>

                <div className={`flex-1 flex items-center justify-center w-full px-8 transition-all duration-1000 delay-300 ${menuVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="w-full max-w-4xl min-h-[420px] flex flex-col">
                        <div className="h-10 mb-8">
                            <div className="flex items-center gap-6">
                                <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-red-900/50" />
                                <span className="text-red-800/80 text-xs tracking-[0.5em] uppercase font-sans font-semibold animate-pulse">
                                    Select Your Grave
                                </span>
                                <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-red-900/50" />
                            </div>
                        </div>

                        <div className="flex justify-center gap-6 pt-2 min-h-[240px]">
                            {MAPS.map((map, idx) => {
                                const isSelected = selectedMap === map.id;
                                
                                return (
                                    <button
                                        key={map.id}
                                        onClick={() => onSelectMap(map.id)}
                                        disabled={isLoading}
                                        className={`group relative transition-all duration-500 ease-out disabled:opacity-50 ${
                                            isSelected ? 'scale-110 z-20' : 'scale-100 hover:scale-105 opacity-70 hover:opacity-100'
                                        }`}
                                        style={{
                                            transitionDelay: `${idx * 100}ms`
                                        }}
                                    >
                                        <div className={`relative w-48 transition-all duration-500 ${
                                            isSelected ? 'filter-none' : 'grayscale-[30%]'
                                        }`}>
                                            {isSelected && (
                                                <div className="absolute -inset-4 bg-red-900/30 blur-xl rounded-full animate-pulse" />
                                            )}
                                            <div className={`relative overflow-hidden transition-all duration-300 ${
                                                isSelected 
                                                    ? 'bg-gradient-to-b from-stone-900 via-stone-950 to-black' 
                                                    : 'bg-gradient-to-b from-stone-950 to-black group-hover:from-stone-900'
                                            }`}
                                            style={{
                                                clipPath: 'polygon(0% 15%, 5% 5%, 20% 0%, 80% 0%, 95% 5%, 100% 15%, 100% 100%, 0% 100%)',
                                                border: isSelected ? '2px solid rgba(139, 0, 0, 0.6)' : '1px solid rgba(68, 64, 60, 0.3)',
                                            }}>
                                                <div className="relative p-6 pt-10 pb-8">
                                                    <div className={`absolute top-3 left-1/2 -translate-x-1/2 text-2xl transition-colors duration-300 ${
                                                        isSelected ? 'text-red-700' : 'text-stone-700'
                                                    }`}>
                                                        ✝
                                                    </div>
                                                    <h3 className={`text-center font-bold tracking-wider uppercase transition-all duration-300 mt-2 ${
                                                        isSelected ? 'text-lg text-red-100' : 'text-sm text-stone-400 group-hover:text-stone-300'
                                                    }`}
                                                    style={{ fontFamily: 'Georgia, serif' }}>
                                                        {map.name}
                                                    </h3>
                                                    <div className={`overflow-hidden transition-all duration-500 ${
                                                        isSelected ? 'max-h-24 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'
                                                    }`}>
                                                        <p className="text-stone-500 text-xs text-center leading-relaxed font-sans">
                                                            {map.description}
                                                        </p>
                                                    </div>
                                                    {!isSelected && (
                                                        <p className="text-stone-700 text-xs text-center mt-3 tracking-widest">
                                                            R.I.P.
                                                        </p>
                                                    )}
                                                </div>
                                                <div className={`h-1 transition-colors duration-300 ${
                                                    isSelected ? 'bg-gradient-to-r from-transparent via-red-800 to-transparent' : 'bg-stone-900'
                                                }`} />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex justify-center gap-3 mt-8 h-6">
                            {MAPS.map((map) => (
                                <button
                                    key={map.id}
                                    onClick={() => onSelectMap(map.id)}
                                    disabled={isLoading}
                                    className={`transition-all duration-300 rounded-full ${
                                        selectedMap === map.id 
                                            ? 'w-8 h-2 bg-red-700 shadow-lg shadow-red-900/50' 
                                            : 'w-2 h-2 bg-stone-700 hover:bg-stone-500'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className={`w-full max-w-lg px-8 transition-all duration-1000 delay-500 ${menuVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-4 py-6">
                            <div className="relative w-8 h-8">
                                <div className="absolute inset-0 border-2 border-red-900/30 rounded-full" />
                                <div className="absolute inset-0 border-2 border-transparent border-t-red-700 rounded-full animate-spin" />
                            </div>
                            <span className="text-red-800/80 text-sm tracking-[0.3em] uppercase font-sans animate-pulse">
                                Raising the Dead...
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={onStartSolo}
                                onMouseEnter={() => setHoveredButton('solo')}
                                onMouseLeave={() => setHoveredButton(null)}
                                className="group relative overflow-hidden"
                            >
                                <div className="relative py-5 transition-all duration-300 group-hover:py-6"
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(127, 29, 29, 0.8) 0%, rgba(80, 10, 10, 0.9) 50%, rgba(40, 5, 5, 1) 100%)',
                                        boxShadow: hoveredButton === 'solo' 
                                            ? '0 0 40px rgba(139, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)' 
                                            : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                                    }}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                    <div className="absolute inset-0 border border-red-800/50 group-hover:border-red-600/70 transition-colors" />
                                    <span className="relative block text-center text-stone-200 text-xl font-bold tracking-[0.3em] uppercase group-hover:tracking-[0.4em] transition-all duration-300"
                                        style={{ fontFamily: 'Georgia, serif', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                        Enter Alone
                                    </span>
                                </div>
                            </button>

                            <div className="flex gap-4">
                                {['host', 'join'].map((type) => (
                                    <button 
                                        key={type}
                                        onClick={type === 'host' ? onHost : onJoin}
                                        onMouseEnter={() => setHoveredButton(type)}
                                        onMouseLeave={() => setHoveredButton(null)}
                                        className="group flex-1 relative overflow-hidden"
                                    >
                                        <div className="relative py-4 bg-gradient-to-b from-stone-900 to-black border border-stone-800 group-hover:border-stone-600 transition-all duration-300">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <span className="relative block text-center text-stone-500 group-hover:text-stone-300 text-sm font-semibold tracking-[0.2em] uppercase transition-colors font-sans">
                                                {type === 'host' ? 'Host Game' : 'Join Game'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute bottom-3 left-4 text-stone-800 text-[10px] font-mono tracking-wider z-20">
                BUILD 2024.1 • CLASSIFIED
            </div>
            
            <style>{`
                @keyframes drift {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    25% { transform: translate(5%, 3%) rotate(1deg); }
                    50% { transform: translate(-3%, 5%) rotate(-1deg); }
                    75% { transform: translate(-5%, -3%) rotate(0.5deg); }
                }
                @keyframes drift-slow {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(-8%, 5%); }
                }
                @keyframes drip {
                    0%, 100% { transform: translateY(-100%); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(800%); opacity: 0; }
                }
                @keyframes scanline {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(3px); }
                }
                @keyframes expand-right {
                    0% { transform: scaleX(0); transform-origin: left; }
                    100% { transform: scaleX(1); transform-origin: left; }
                }
                @keyframes expand-left {
                    0% { transform: scaleX(0); transform-origin: right; }
                    100% { transform: scaleX(1); transform-origin: right; }
                }
                @keyframes subtitle-flicker {
                    0%, 100% { opacity: 1; }
                    92% { opacity: 1; }
                    93% { opacity: 0.8; }
                    94% { opacity: 1; }
                    95% { opacity: 0.9; }
                    96% { opacity: 1; }
                }
                .animate-drift { animation: drift 20s ease-in-out infinite; }
                .animate-drift-slow { animation: drift-slow 30s ease-in-out infinite; }
                .animate-drip { animation: drip 4s ease-in infinite; }
                .animate-scanline { animation: scanline 0.1s linear infinite; }
                .animate-expand-right { animation: expand-right 1s ease-out forwards; animation-delay: 0.5s; transform: scaleX(0); }
                .animate-expand-left { animation: expand-left 1s ease-out forwards; animation-delay: 0.5s; transform: scaleX(0); }
                .animate-subtitle-flicker { animation: subtitle-flicker 5s ease-in-out infinite; }
            `}</style>
        </div>
    );
};
