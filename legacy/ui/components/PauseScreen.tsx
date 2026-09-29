import React, { useEffect, useState } from 'react';
import { SettingsMenu } from '../menus/SettingsMenu';
import { BackHeader } from '../menus/MenuPrimitives';

interface PauseScreenProps {
    onResume: () => void;
    onQuit: () => void;
}

type PauseActionId = 'resume' | 'options' | 'quit';

const PAUSE_MENU_ITEMS: { id: PauseActionId; label: string }[] = [
    { id: 'resume', label: 'RESUME' },
    { id: 'options', label: 'SETTINGS' },
    { id: 'quit', label: 'QUIT TO MENU' },
];

const MainMenuStylePauseButton = ({
    label,
    onClick,
    isActive,
    onHover,
}: {
    label: string;
    onClick: () => void;
    isActive: boolean;
    onHover: () => void;
}) => (
    <button
        onClick={onClick}
        onMouseEnter={onHover}
        onFocus={onHover}
        style={{
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
        }}
    >
        <div
            style={{
                position: 'absolute',
                left: 0,
                top: '16%',
                bottom: '16%',
                width: '5px',
                background: '#FF9A00',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'scaleY(1)' : 'scaleY(0)',
                transition: 'opacity 0.12s ease, transform 0.15s ease',
                boxShadow: '0 0 12px rgba(255,154,0,0.7)',
            }}
        />
        {label}
    </button>
);

export const PauseScreen = ({ onResume, onQuit }: PauseScreenProps) => {
    const [showSettings, setShowSettings] = useState(false);
    const [ready, setReady] = useState(false);
    const [hoveredAction, setHoveredAction] = useState<PauseActionId>('resume');

    useEffect(() => {
        const t = setTimeout(() => setReady(true), 60);
        return () => clearTimeout(t);
    }, []);

    const handleBackFromSettings = () => {
        setShowSettings(false);
    };

    const runAction = (id: PauseActionId) => {
        if (id === 'resume') onResume();
        else if (id === 'options') setShowSettings(true);
        else onQuit();
    };

    useEffect(() => {
        if (showSettings) return;

        const handler = (e: KeyboardEvent) => {
            const currentIdx = PAUSE_MENU_ITEMS.findIndex((i) => i.id === hoveredAction);

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHoveredAction(PAUSE_MENU_ITEMS[Math.max(0, currentIdx - 1)].id);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHoveredAction(PAUSE_MENU_ITEMS[Math.min(PAUSE_MENU_ITEMS.length - 1, currentIdx + 1)].id);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                runAction(hoveredAction);
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [hoveredAction, showSettings]);

    return (
        <div className="absolute inset-0 z-50 overflow-hidden pointer-events-auto select-none">
            <div
                className="absolute inset-0"
                style={{ background: 'rgba(0, 0, 0, 0.42)' }}
            />
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle at center, transparent 24%, rgba(0, 0, 0, 0.8) 100%)',
                }}
            />
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
                }}
            />

            {showSettings ? (
                <>
                    <div
                        className="absolute"
                        style={{
                            top: '32px',
                            left: '7%',
                            zIndex: 20,
                            opacity: ready ? 1 : 0,
                            transition: 'opacity 0.45s ease 0.2s',
                        }}
                    >
                        <BackHeader onBack={handleBackFromSettings} breadcrumb="PAUSE MENU / SETTINGS" />
                    </div>
                    <SettingsMenu />
                </>
            ) : (
                <>
                    <div
                        className="absolute"
                        style={{
                            top: '40%',
                            left: '7%',
                            zIndex: 10,
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
                            Session Paused
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
                        className="absolute"
                        style={{
                            top: '46%',
                            left: '7%',
                            zIndex: 10,
                            opacity: ready ? 1 : 0,
                            transition: 'opacity 0.55s ease 0.25s',
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: 'min(420px, 86vw)' }}>
                            {PAUSE_MENU_ITEMS.map((item) => (
                                <MainMenuStylePauseButton
                                    key={item.id}
                                    label={item.label}
                                    onClick={() => runAction(item.id)}
                                    isActive={hoveredAction === item.id}
                                    onHover={() => setHoveredAction(item.id)}
                                />
                            ))}
                        </div>
                    </div>

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
                        [ESC] RESUME  [CLICK] SELECT
                    </div>
                </>
            )}
        </div>
    );
};
