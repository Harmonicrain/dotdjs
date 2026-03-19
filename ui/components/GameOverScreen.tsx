
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';

interface GameOverScreenProps {
    onQuit: () => void;
}

// Animated stat reveal component
const StatReveal = ({ label, value, delay, highlight }: {
    label: string;
    value: number | string;
    delay: number;
    highlight?: boolean;
}) => {
    const [show, setShow] = useState(false);
    const [countedValue, setCountedValue] = useState(0);

    useEffect(() => {
        const showTimer = setTimeout(() => setShow(true), delay);
        return () => clearTimeout(showTimer);
    }, [delay]);

    // Count-up animation for numbers
    useEffect(() => {
        if (!show || typeof value !== 'number') return;

        const duration = 1000;
        const steps = 30;
        const increment = value / steps;
        let current = 0;

        const interval = setInterval(() => {
            current += increment;
            if (current >= value) {
                setCountedValue(value);
                clearInterval(interval);
            } else {
                setCountedValue(Math.floor(current));
            }
        }, duration / steps);

        return () => clearInterval(interval);
    }, [show, value]);

    if (!show) return <div className="h-8" />;

    return (
        <div
            className="flex justify-between items-center py-2 border-b border-stone-800/50"
            style={{ animation: 'statSlideIn 0.4s ease-out' }}
        >
            <span className="text-stone-500 text-sm uppercase tracking-wider font-mono">{label}</span>
            <span className={`text-xl font-bold font-mono tracking-wider
                           ${highlight ? 'text-amber-400' : 'text-stone-200'}`}>
                {typeof value === 'number' ? countedValue.toLocaleString() : value}
            </span>
        </div>
    );
};

export const GameOverScreen = ({ onQuit }: GameOverScreenProps) => {
    const round = useGameStore(s => s.round);
    const playerName = useGameStore(s => s.playerName);
    const kills = useGameStore(s => s.kills);
    const shotsFired = useGameStore(s => s.shotsFired);
    const score = useGameStore(s => s.totalEarnedPoints);
    const gameMode = useGameStore(s => s.gameMode);
    const remotePlayerName = useGameStore(s => s.remotePlayerName);
    const remoteKills = useGameStore(s => s.remoteKills);
    const remoteShots = useGameStore(s => s.remoteShots);
    const remoteScore = useGameStore(s => s.remoteTotalEarnedPoints);
    const [phase, setPhase] = useState(0);
    const accuracy = shotsFired > 0 ? ((kills / shotsFired) * 100).toFixed(1) : '0.0';
    const remoteAccuracy = remoteShots && remoteShots > 0
        ? ((remoteKills! / remoteShots) * 100).toFixed(1)
        : '0.0';

    // Phase progression for cinematic reveal
    useEffect(() => {
        const timers = [
            setTimeout(() => setPhase(1), 500),   // Show title
            setTimeout(() => setPhase(2), 1200),  // Show round
            setTimeout(() => setPhase(3), 2000),  // Show stats
            setTimeout(() => setPhase(4), 3500),  // Show button
        ];
        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center 
                      pointer-events-auto overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 bg-black">
                {/* Noise texture */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'url("https://playground.babylonjs.com/textures/noise.png")',
                        backgroundSize: '200px'
                    }}
                />

                {/* Vignette */}
                <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/50 to-black" />

                {/* Blood drip effect at top */}
                <div className="absolute top-0 left-0 right-0 h-32 overflow-hidden">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-0 w-1 bg-gradient-to-b from-red-900 to-transparent rounded-full"
                            style={{
                                left: `${8 + i * 8}%`,
                                height: `${30 + Math.random() * 70}px`,
                                animation: `bloodDrip ${2 + Math.random() * 2}s ease-in ${i * 0.2}s infinite`,
                                opacity: 0.3 + Math.random() * 0.4
                            }}
                        />
                    ))}
                </div>

                {/* Ambient particles */}
                <div className="absolute inset-0">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1 h-1 bg-red-900/30 rounded-full"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animation: `floatParticle ${5 + Math.random() * 5}s ease-in-out ${Math.random() * 5}s infinite`
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Content container */}
            <div className="relative w-full max-w-4xl px-8">
                {/* GAME OVER title */}
                {phase >= 1 && (
                    <div className="text-center mb-8" style={{ animation: 'titleReveal 1s ease-out' }}>
                        <h1 className="text-[120px] font-black text-red-700 leading-none tracking-tighter
                                     drop-shadow-[0_0_60px_rgba(127,29,29,0.5)]"
                            style={{
                                textShadow: '0 8px 0 rgba(0,0,0,0.8), 0 0 100px rgba(127,29,29,0.3)',
                                animation: 'glitchText 0.3s ease-in-out 0.5s 3'
                            }}>
                            GAME OVER
                        </h1>

                        {/* Glitch layers */}
                        <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
                            <h1 className="text-[120px] font-black text-red-500/30 leading-none tracking-tighter
                                         translate-x-[3px]"
                                style={{ clipPath: 'inset(30% 0 50% 0)', animation: 'glitchLeft 0.2s ease-in-out 0.5s 5' }}>
                                GAME OVER
                            </h1>
                        </div>
                        <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
                            <h1 className="text-[120px] font-black text-cyan-500/20 leading-none tracking-tighter
                                         -translate-x-[3px]"
                                style={{ clipPath: 'inset(60% 0 20% 0)', animation: 'glitchRight 0.2s ease-in-out 0.6s 5' }}>
                                GAME OVER
                            </h1>
                        </div>
                    </div>
                )}

                {/* Round survived */}
                {phase >= 2 && (
                    <div className="text-center mb-12" style={{ animation: 'fadeSlideUp 0.6s ease-out' }}>
                        <div className="inline-flex items-center gap-6">
                            <div className="w-24 h-[1px] bg-gradient-to-r from-transparent to-stone-700" />
                            <div>
                                <p className="text-stone-600 text-xs tracking-[0.5em] uppercase mb-1 font-mono">
                                    SURVIVED
                                </p>
                                <p className="text-5xl font-black text-stone-300 font-mono">
                                    {round}
                                    <span className="text-xl text-stone-500 ml-2">ROUNDS</span>
                                </p>
                            </div>
                            <div className="w-24 h-[1px] bg-gradient-to-l from-transparent to-stone-700" />
                        </div>
                    </div>
                )}

                {/* Stats cards */}
                {phase >= 3 && (
                    <div className={`grid gap-8 mb-12 ${gameMode !== 'SOLO' ? 'grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
                        {/* Player 1 stats */}
                        <div
                            className="bg-stone-950/80 border border-stone-800 rounded-lg p-6
                                     backdrop-blur-sm"
                            style={{ animation: 'cardSlideIn 0.5s ease-out' }}
                        >
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-800">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                <h3 className="text-lg font-bold text-stone-200 tracking-wider uppercase">
                                    {playerName}
                                </h3>
                            </div>

                            <StatReveal label="Score" value={score} delay={0} highlight />
                            <StatReveal label="Kills" value={kills} delay={200} />
                            <StatReveal label="Shots Fired" value={shotsFired} delay={400} />
                            <StatReveal label="Accuracy" value={`${accuracy}%`} delay={600} />
                        </div>

                        {/* Player 2 stats (co-op) */}
                        {gameMode !== 'SOLO' && (
                            <div
                                className="bg-stone-950/80 border border-stone-800 rounded-lg p-6
                                         backdrop-blur-sm"
                                style={{ animation: 'cardSlideIn 0.5s ease-out 0.2s both' }}
                            >
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-800">
                                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                    <h3 className="text-lg font-bold text-stone-400 tracking-wider uppercase">
                                        {remotePlayerName || '---'}
                                    </h3>
                                </div>

                                <StatReveal label="Score" value={remoteScore || 0} delay={100} highlight />
                                <StatReveal label="Kills" value={remoteKills || 0} delay={300} />
                                <StatReveal label="Shots Fired" value={remoteShots || 0} delay={500} />
                                <StatReveal label="Accuracy" value={`${remoteAccuracy}%`} delay={700} />
                            </div>
                        )}
                    </div>
                )}

                {/* Return button */}
                {phase >= 4 && (
                    <div className="text-center" style={{ animation: 'fadeSlideUp 0.5s ease-out' }}>
                        <button
                            onClick={onQuit}
                            className="group relative px-12 py-4 overflow-hidden
                                     bg-transparent border-2 border-stone-700
                                     hover:border-red-700 transition-all duration-300"
                        >
                            {/* Button background effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-red-950/0 via-red-950/50 to-red-950/0
                                          translate-x-[-100%] group-hover:translate-x-[100%]
                                          transition-transform duration-500" />

                            <span className="relative text-stone-400 group-hover:text-red-100
                                           text-sm tracking-[0.3em] uppercase font-bold
                                           transition-colors duration-300">
                                Return to Main Menu
                            </span>
                        </button>

                        <p className="mt-6 text-stone-700 text-xs tracking-widest uppercase font-mono">
                            Press ESC or click to continue
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
