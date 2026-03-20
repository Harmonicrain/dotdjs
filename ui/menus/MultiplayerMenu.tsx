import React, { useState, useEffect, useCallback } from 'react';

interface MultiplayerMenuProps {
  onHost: () => void;
  onJoin: () => void;
}

const MENU_ITEMS = [
  { id: 'host' as const, label: 'HOST GAME' },
  { id: 'join' as const, label: 'JOIN GAME' },
];

type MenuItemId = 'host' | 'join';

export const MultiplayerMenu = ({ onHost, onJoin }: MultiplayerMenuProps) => {
  const [hoveredId, setHoveredId] = useState<MenuItemId>('host');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleAction = useCallback(
    (id: MenuItemId) => {
      switch (id) {
        case 'host': onHost(); break;
        case 'join': onJoin(); break;
      }
    },
    [onHost, onJoin],
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
    <>
      {/* Section label */}
      <div
        className="absolute"
        style={{
          top: '46%',
          left: '7%',
          opacity: ready ? 0.45 : 0,
          transition: 'opacity 0.5s ease 0.35s',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.25em',
            color: '#FF8C00',
            textTransform: 'uppercase',
          }}
        >
          SELECT MODE
        </span>
        <div
          style={{
            marginTop: '6px',
            width: '40px',
            height: '1px',
            background: 'rgba(255,140,0,0.5)',
          }}
        />
      </div>

      {/* Menu items */}
      <div
        className="absolute flex flex-col"
        style={{ top: '53%', left: '7%', gap: '2px' }}
      >
        {MENU_ITEMS.map((item, idx) => {
          const isActive = hoveredId === item.id;
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
                fontSize: 'clamp(32px, 3.6vw, 52px)',
                fontWeight: 600,
                letterSpacing: '0.02em',
                lineHeight: 1,
                color: isActive ? '#FF9A00' : '#FFFFFF',
                textShadow: isActive
                  ? '0 0 15px rgba(255,154,0,0.5), 0 0 30px rgba(255,100,0,0.2)'
                  : '2px 2px 4px rgba(0,0,0,0.8)',
                opacity: ready ? 1 : 0,
                transform: isActive ? 'scale(1.03)' : 'scale(1)',
                transformOrigin: 'left center',
                animation: isActive ? 'text-pulse 2.5s ease-in-out infinite' : 'none',
                transition: [
                  'color 0.1s ease',
                  'text-shadow 0.1s ease',
                  'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  `opacity 0.5s ease ${0.4 + idx * 0.1}s`,
                ].join(', '),
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
    </>
  );
};
