import React, { useState, useEffect, useCallback } from 'react';

interface MainMenuProps {
  onPlaySolo: () => void;
  onMultiplayer: () => void;
  onSettings: () => void;
  skipAnimations?: boolean;
}

const MENU_ITEMS = [
  { id: 'solo' as const, label: 'PLAY SOLO' },
  { id: 'multiplayer' as const, label: 'MULTIPLAYER' },
  { id: 'settings' as const, label: 'SETTINGS' },
];

type MenuItemId = 'solo' | 'multiplayer' | 'settings';

export const MainMenu = ({
  onPlaySolo,
  onMultiplayer,
  onSettings,
  skipAnimations = false,
}: MainMenuProps) => {
  const [hoveredId, setHoveredId] = useState<MenuItemId>('solo');
  const [ready, setReady] = useState(skipAnimations);

  useEffect(() => {
    if (!skipAnimations) {
      const t = setTimeout(() => setReady(true), 80);
      return () => clearTimeout(t);
    }
  }, [skipAnimations]);

  const handleAction = useCallback(
    (id: MenuItemId) => {
      switch (id) {
        case 'solo':
          onPlaySolo();
          break;
        case 'multiplayer':
          onMultiplayer();
          break;
        case 'settings':
          onSettings();
          break;
      }
    },
    [onPlaySolo, onMultiplayer, onSettings],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const currentIdx = MENU_ITEMS.findIndex((i) => i.id === hoveredId);
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHoveredId(MENU_ITEMS[Math.max(0, currentIdx - 1)].id);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHoveredId(MENU_ITEMS[Math.min(MENU_ITEMS.length - 1, currentIdx + 1)].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleAction(hoveredId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hoveredId, handleAction]);

  return (
    <div
      className="absolute flex flex-col"
      style={{
        top: '52%',
        left: '7%',
        transform: 'translateY(0)',
        gap: '2px',
      }}
    >
      {MENU_ITEMS.map((item, idx) => {
        const isActive = hoveredId === item.id;
        const delay = skipAnimations ? '0s' : `${0.45 + idx * 0.1}s`;

        return (
          <button
            key={item.id}
            onClick={() => {
              setHoveredId(item.id);
              handleAction(item.id);
            }}
            onMouseEnter={() => setHoveredId(item.id)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              padding: '6px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
              fontSize: isActive ? 'clamp(28px, 3.2vw, 48px)' : 'clamp(22px, 2.6vw, 38px)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              lineHeight: 1,
              color: isActive ? '#FF6A00' : 'rgba(200,200,200,0.85)',
              textShadow: isActive
                ? '0 0 15px rgba(255,60,0,0.5), 0 0 30px rgba(255,30,0,0.25), 0 0 60px rgba(139,0,0,0.15)'
                : '2px 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)',
              opacity: ready ? 1 : 0,
              transform: isActive ? 'scale(1.03)' : 'scale(1)',
              transformOrigin: 'left center',
              animation: isActive
                ? 'text-pulse 2.5s ease-in-out infinite, menu-text-flicker 25s ease-in-out infinite'
                : 'none',
              transition: [
                'color 0.1s ease',
                'text-shadow 0.1s ease',
                'font-size 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                skipAnimations ? '' : `opacity 0.5s ease ${delay}`,
              ]
                .filter(Boolean)
                .join(', '),
              userSelect: 'none',
              WebkitUserSelect: 'none',
              zIndex: 10,
            }}
          >
            {/* Selector bar on the left */}
            <div
              style={{
                position: 'absolute',
                left: '-20px',
                top: '15%',
                bottom: '15%',
                width: '5px',
                background: '#FF9A00',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'scaleY(1)' : 'scaleY(0)',
                transition: 'opacity 0.12s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 0 12px rgba(255,154,0,0.7)',
              }}
            />
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
