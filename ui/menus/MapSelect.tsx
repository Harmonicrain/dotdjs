import React, { useState, useEffect, useCallback } from 'react';
import { MAPS } from '../../config';
import { MenuPanel } from './MenuPrimitives';

interface MapSelectProps {
  initialMapId: string;
  mode: 'solo' | 'host';
  onConfirm: (mapId: string) => void;
}

export const MapSelect = ({ initialMapId, mode, onConfirm }: MapSelectProps) => {
  const [selectedId, setSelectedId] = useState(initialMapId || MAPS[0].id);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 40);
    return () => clearTimeout(t);
  }, []);

  const selectedMap = MAPS.find((m) => m.id === selectedId) ?? MAPS[0];
  const selectedIdx = MAPS.findIndex((m) => m.id === selectedId);

  const handleConfirm = useCallback(() => {
    onConfirm(selectedId);
  }, [selectedId, onConfirm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedId(MAPS[Math.max(0, selectedIdx - 1)].id);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedId(MAPS[Math.min(MAPS.length - 1, selectedIdx + 1)].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIdx, handleConfirm]);

  const confirmLabel = mode === 'host' ? 'HOST GAME' : 'START GAME';

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden select-none pointer-events-auto"
    >
      <div
        style={{
          width: 'min(900px, 90vw)',
          maxHeight: '85vh',
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(24px) scale(1)' : 'translateY(40px) scale(0.98)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
          zIndex: 20,
        }}
      >
        <MenuPanel
          title="Map Selection"
          titleRight={
            mode === 'host' ? (
              <span
                style={{
                  fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  color: '#FF8C00',
                  opacity: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                HOST MODE
              </span>
            ) : undefined
          }
          maxWidth="900px"
          height="min(640px, 85vh)"
        >
          {/* ── Split panel body ──────────────────────────────── */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', margin: '-28px', marginTop: '-18px' }}>
            {/* Left column – map list */}
            <div
              style={{
                width: '32%',
                flexShrink: 0,
                borderRight: '1px solid rgba(139,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '8px 0',
                  overflowY: 'auto',
                  flex: 1,
                }}
              >
                {MAPS.map((map) => {
                  const isSelected = map.id === selectedId;
                  return (
                    <button
                      key={map.id}
                      onClick={() => setSelectedId(map.id)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '13px 24px 13px 28px',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: '1px solid rgba(80,0,0,0.2)',
                        cursor: 'pointer',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '12px',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        background: isSelected ? 'rgba(255,154,0,0.07)' : 'transparent',
                        color: isSelected ? '#FF9A00' : '#888',
                        transition: 'background 0.1s ease, color 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                          (e.currentTarget as HTMLElement).style.color = '#CCC';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = '#888';
                        }
                      }}
                    >
                      {/* Orange selector bar */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: '20%',
                        bottom: '20%',
                        width: '3px',
                        background: '#FF9A00',
                        opacity: isSelected ? 1 : 0,
                        boxShadow: '0 0 8px rgba(255,154,0,0.6)',
                        transition: 'opacity 0.12s ease',
                      }} />
                      {map.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right column – preview */}
            <div
              style={{
                flex: 1,
                padding: '28px 30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                overflowY: 'auto',
              }}
            >
              {/* Map name */}
              <div>
                <span style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  color: '#FF8C00',
                  opacity: 0.7,
                  textTransform: 'uppercase',
                  display: 'block',
                  marginBottom: '8px',
                }}>
                  Selected Map
                </span>
                <h3
                  style={{
                    fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
                    fontSize: '26px',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    color: '#D0D0D0',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}
                >
                  {selectedMap.name}
                </h3>
              </div>

              {/* Preview image */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  maxHeight: '200px',
                  border: '1px solid rgba(80,0,0,0.35)',
                  flexShrink: 0,
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'rgba(10,5,5,0.8)',
                }}
              >
                {selectedMap.preview ? (
                  <img
                    src={selectedMap.preview}
                    alt={selectedMap.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'repeating-linear-gradient(45deg, rgba(20,10,10,0.8) 0px, rgba(20,10,10,0.8) 10px, rgba(15,8,8,0.8) 10px, rgba(15,8,8,0.8) 20px)',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '11px',
                        letterSpacing: '0.2em',
                        color: 'rgba(80,50,50,0.7)',
                        textTransform: 'uppercase',
                      }}
                    >
                      NO PREVIEW AVAILABLE
                    </span>
                  </>
                )}
              </div>

              {/* Description */}
              <p
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '11px',
                  lineHeight: 1.7,
                  color: '#666',
                  margin: 0,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                {selectedMap.description}
              </p>
            </div>
          </div>

          {/* ── Bottom action bar ─────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              margin: '-28px',
              marginTop: '0',
              padding: '16px 24px',
              borderTop: '1px solid rgba(80,0,0,0.3)',
              background: 'rgba(8,2,2,0.6)',
            }}
          >
            <button
              onClick={handleConfirm}
              style={{
                padding: '10px 32px',
                background: 'rgba(255,154,0,0.12)',
                border: '1px solid rgba(255,154,0,0.7)',
                cursor: 'pointer',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '12px',
                letterSpacing: '0.25em',
                color: '#FF9A00',
                textTransform: 'uppercase',
                transition: 'background 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,154,0,0.22)';
                el.style.boxShadow = '0 0 16px rgba(255,154,0,0.25)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,154,0,0.12)';
                el.style.boxShadow = 'none';
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </MenuPanel>
      </div>
    </div>
  );
};
