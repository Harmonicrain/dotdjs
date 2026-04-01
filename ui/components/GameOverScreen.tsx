
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MenuPanel } from '../menus/MenuPrimitives';

interface GameOverScreenProps {
    onQuit: () => void;
}

// Count-up animation for numeric stat values
const useCountUp = (target: number, active: boolean, duration = 1000) => {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!active || target === 0) {
            if (active) setValue(target);
            return;
        }

        const steps = 30;
        const increment = target / steps;
        let current = 0;

        const interval = setInterval(() => {
            current += increment;
            if (current >= target) {
                setValue(target);
                clearInterval(interval);
            } else {
                setValue(Math.floor(current));
            }
        }, duration / steps);

        return () => clearInterval(interval);
    }, [active, target, duration]);

    return value;
};

const MENU_BUTTON_STYLE = (isActive: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '4px 0 4px 26px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    position: 'relative',
    fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
    fontSize: isActive ? 'clamp(28px, 3.1vw, 44px)' : 'clamp(22px, 2.6vw, 34px)',
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: isActive ? '#FF9A00' : '#E5E5E5',
    textTransform: 'uppercase',
    textShadow: isActive
        ? '0 0 15px rgba(255,154,0,0.5), 0 0 30px rgba(255,100,0,0.2)'
        : '2px 2px 4px rgba(0,0,0,0.8)',
    transform: isActive ? 'scale(1.03)' : 'scale(1)',
    transformOrigin: 'left center',
    transition: 'color 0.1s ease, text-shadow 0.1s ease, font-size 0.15s ease, transform 0.2s ease',
    userSelect: 'none',
    WebkitUserSelect: 'none',
});

const panelContentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
};

const sectionLabelStyle: React.CSSProperties = {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '11px',
    letterSpacing: '0.2em',
    color: '#777',
    textTransform: 'uppercase',
};

// Single stat row inside a MenuPanel
const StatRow = ({ label, value, highlight, startDelay, ready }: {
    label: string;
    value: number | string;
    highlight?: boolean;
    startDelay: number;
    ready: boolean;
}) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!ready) return;
        const t = setTimeout(() => setVisible(true), startDelay);
        return () => clearTimeout(t);
    }, [ready, startDelay]);

    const counted = useCountUp(
        typeof value === 'number' ? value : 0,
        visible,
    );

    const displayValue = typeof value === 'number'
        ? counted.toLocaleString()
        : value;

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid rgba(139,0,0,0.22)',
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.35s ease',
            }}
        >
            <span
                style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.18em',
                    color: '#888',
                    textTransform: 'uppercase',
                }}
            >
                {label}
            </span>
            <span
                style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '18px',
                    color: highlight ? '#FF9A00' : '#D0D0D0',
                    letterSpacing: '0.05em',
                }}
            >
                {displayValue}
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

    const [ready, setReady] = useState(false);
    const accuracy = shotsFired > 0 ? ((kills / shotsFired) * 100).toFixed(1) : '0.0';
    const remoteAccuracy = remoteShots && remoteShots > 0
        ? ((remoteKills! / remoteShots) * 100).toFixed(1)
        : '0.0';
    const isCoop = gameMode !== 'SOLO';
    const summaryDelay = isCoop ? '0.55s' : '0.45s';

    useEffect(() => {
        const t = setTimeout(() => setReady(true), 60);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (document.pointerLockElement && document.exitPointerLock) {
            document.exitPointerLock();
        }
    }, []);

    // ESC key handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onQuit();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onQuit]);

    return (
        <div className="absolute inset-0 z-50 overflow-hidden pointer-events-auto select-none">
            <div
                className="absolute inset-0"
                style={{ background: 'rgba(0, 0, 0, 0.58)' }}
            />
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.82) 34%, rgba(0,0,0,0.56) 62%, rgba(0,0,0,0.38) 100%)',
                }}
            />
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
                }}
            />
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle at 12% 50%, rgba(140,30,0,0.22) 0%, rgba(140,30,0,0.08) 20%, transparent 46%)',
                }}
            />

            <div
                className="absolute inset-0 game-over-layout"
                style={{
                    zIndex: 10,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 440px) minmax(420px, 720px)',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'clamp(24px, 3vw, 48px)',
                    padding: 'clamp(32px, 6vw, 72px) 6% clamp(48px, 8vh, 96px)',
                }}
            >
                <div
                    className="game-over-hero"
                    style={{
                        maxWidth: '440px',
                    }}
                >
                    <div
                        style={{
                            opacity: ready ? 0.72 : 0,
                            transition: 'opacity 0.45s ease 0.2s',
                        }}
                    >
                        <span
                            style={{
                                fontFamily: "'Share Tech Mono', monospace",
                                fontSize: '11px',
                                letterSpacing: '0.28em',
                                color: '#FF8C00',
                                textTransform: 'uppercase',
                            }}
                        >
                            Mission Failed
                        </span>
                        <div
                            style={{
                                marginTop: '6px',
                                width: '42px',
                                height: '1px',
                                background: 'rgba(255,140,0,0.5)',
                            }}
                        />
                    </div>

                    <div
                        style={{
                            marginTop: '20px',
                            opacity: ready ? 1 : 0,
                            transition: 'opacity 0.55s ease 0.25s',
                        }}
                    >
                        <h1
                            className="game-over-title"
                            style={{
                                fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
                                fontSize: 'clamp(52px, 7vw, 96px)',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                color: '#E5E5E5',
                                margin: 0,
                                lineHeight: 0.92,
                                whiteSpace: 'nowrap',
                                textTransform: 'uppercase',
                                textShadow: '2px 2px 4px rgba(0,0,0,0.85), 0 0 18px rgba(255,154,0,0.08)',
                            }}
                        >
                            Game Over
                        </h1>
                    </div>

                    <div
                        style={{
                            marginTop: '42px',
                            opacity: ready ? 1 : 0,
                            transition: 'opacity 0.55s ease 0.35s',
                        }}
                    >
                        <div
                            className="game-over-actions"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                width: 'min(420px, 86vw)',
                            }}
                        >
                            <button onClick={onQuit} style={MENU_BUTTON_STYLE(true)}>
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: '16%',
                                        bottom: '16%',
                                        width: '5px',
                                        background: '#FF9A00',
                                        boxShadow: '0 0 12px rgba(255,154,0,0.7)',
                                    }}
                                />
                                <span style={{ whiteSpace: 'nowrap' }}>Return to Menu</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    className="game-over-summary"
                    style={{
                        opacity: ready ? 1 : 0,
                        transition: `opacity 0.6s ease ${summaryDelay}`,
                        justifySelf: 'end',
                        width: '100%',
                    }}
                >
                    <div style={{ width: 'min(100%, 720px)' }}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: isCoop ? 'repeat(auto-fit, minmax(280px, 1fr))' : 'minmax(320px, 1fr)',
                                gap: '20px',
                            }}
                        >
                            <MenuPanel
                                title="Session Report"
                                titleRight={(
                                    <span style={sectionLabelStyle}>
                                        Round {round}
                                    </span>
                                )}
                                maxWidth="100%"
                            >
                                <div style={panelContentStyle}>
                                    <div>
                                        <div style={sectionLabelStyle}>Primary Survivor</div>
                                        <div
                                            style={{
                                                marginTop: '8px',
                                                fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
                                                fontSize: '28px',
                                                fontWeight: 600,
                                                letterSpacing: '0.08em',
                                                color: '#E5E5E5',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            {playerName || 'Survivor'}
                                        </div>
                                        <div style={{ marginTop: '12px' }}>
                                            <StatRow label="Score" value={score} highlight ready={ready} startDelay={550} />
                                            <StatRow label="Kills" value={kills} ready={ready} startDelay={700} />
                                            <StatRow label="Shots Fired" value={shotsFired} ready={ready} startDelay={850} />
                                            <StatRow label="Accuracy" value={`${accuracy}%`} ready={ready} startDelay={1000} />
                                        </div>
                                    </div>

                                    {isCoop && (
                                        <div
                                            style={{
                                                borderTop: '1px solid rgba(139,0,0,0.3)',
                                                paddingTop: '18px',
                                            }}
                                        >
                                            <div style={sectionLabelStyle}>Secondary Survivor</div>
                                            <div
                                                style={{
                                                    marginTop: '8px',
                                                    fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
                                                    fontSize: '28px',
                                                    fontWeight: 600,
                                                    letterSpacing: '0.08em',
                                                    color: '#E5E5E5',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {remotePlayerName || 'Survivor 2'}
                                            </div>
                                            <div style={{ marginTop: '12px' }}>
                                                <StatRow label="Score" value={remoteScore || 0} highlight ready={ready} startDelay={650} />
                                                <StatRow label="Kills" value={remoteKills || 0} ready={ready} startDelay={800} />
                                                <StatRow label="Shots Fired" value={remoteShots || 0} ready={ready} startDelay={950} />
                                                <StatRow label="Accuracy" value={`${remoteAccuracy}%`} ready={ready} startDelay={1100} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </MenuPanel>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media (max-width: 1700px) {
                    .game-over-title {
                        font-size: clamp(42px, 4.8vw, 76px) !important;
                    }

                    .game-over-actions button {
                        font-size: clamp(22px, 2.5vw, 34px) !important;
                    }
                }

                @media (max-width: 1500px) {
                    .game-over-layout {
                        grid-template-columns: minmax(0, 1fr) !important;
                        justify-content: stretch !important;
                        align-items: start !important;
                    }

                    .game-over-hero {
                        max-width: none !important;
                        width: 100% !important;
                    }

                    .game-over-summary {
                        max-width: none !important;
                        width: 100% !important;
                        justify-self: stretch !important;
                    }

                    .game-over-summary > div {
                        width: 100% !important;
                    }

                    .game-over-actions {
                        width: min(420px, 100%) !important;
                    }

                    .game-over-title {
                        font-size: clamp(44px, 6vw, 76px) !important;
                    }
                }

                @media (max-width: 1100px) {
                    .game-over-title {
                        white-space: normal !important;
                    }
                }
            `}</style>

            <div
                className="absolute bottom-4 left-5"
                style={{
                    color: '#444',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.18em',
                    opacity: ready ? 1 : 0,
                    transition: 'opacity 0.6s ease 0.4s',
                    zIndex: 10,
                }}
            >
                BUILD 2024.1 • CLASSIFIED
            </div>
            <div
                className="absolute bottom-4 right-5"
                style={{
                    color: '#444',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    opacity: ready ? 1 : 0,
                    transition: 'opacity 0.6s ease 0.4s',
                    zIndex: 10,
                }}
            >
                [ESC] MAIN MENU  [CLICK] SELECT
            </div>
        </div>
    );
};
