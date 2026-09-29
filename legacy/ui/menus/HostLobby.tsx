import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MenuPanel, ActionButton } from './MenuPrimitives';

interface HostLobbyProps {
  mapName?: string;
  roomId: string;
  connectionStatus: string;
  remotePlayerName: string;
  isClientReady: boolean;
  onStart: () => void;
}

export const HostLobby = ({
  mapName,
  roomId,
  connectionStatus,
  remotePlayerName,
  isClientReady,
  onStart,
}: HostLobbyProps) => {
  const playerName = useGameStore((s) => s.playerName);
  const updatePlayer = useGameStore((s) => s.updatePlayer);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const isConnected = connectionStatus === 'CONNECTED';

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden select-none pointer-events-auto"
    >
      <div
        style={{
          width: 'min(520px, 90vw)',
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
          zIndex: 20,
        }}
      >
        <MenuPanel title="Host Lobby" maxWidth="520px">
          {/* Map info */}
          <div>
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.3em',
                color: '#FF8C00',
                opacity: 0.7,
                textTransform: 'uppercase',
              }}
            >
              MAP
            </span>
            <p
              style={{
                fontFamily: "'Oswald', 'Bebas Neue', Georgia, serif",
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: '#E8E8E8',
                textTransform: 'uppercase',
                margin: '6px 0 0',
              }}
            >
              {mapName}
            </p>
          </div>

          {/* Room code */}
          <div
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(139,0,0,0.3)',
              padding: '20px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.3em',
                color: '#888',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '12px',
              }}
            >
              ROOM CODE
            </span>
            <p
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 'clamp(32px, 5vw, 48px)',
                fontWeight: 700,
                letterSpacing: '0.4em',
                color: '#FF9A00',
                margin: 0,
                userSelect: 'all',
              }}
            >
              {roomId || '------'}
            </p>
          </div>

          {/* Connection status */}
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: isConnected ? '#22C55E' : '#888',
                animation: isConnected ? 'none' : 'pulse 2s ease-in-out infinite',
              }}
            >
              {isConnected ? '● CONNECTED' : connectionStatus}
            </span>
          </div>

          {/* Player joined */}
          {isClientReady && (
            <div
              style={{
                padding: '14px',
                background: 'rgba(22,101,52,0.15)',
                border: '1px solid rgba(34,197,94,0.3)',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: '12px',
                  letterSpacing: '0.2em',
                  color: '#22C55E',
                  textTransform: 'uppercase',
                }}
              >
                {remotePlayerName} JOINED — READY
              </span>
            </div>
          )}

          {/* Player name input */}
          <div>
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.3em',
                color: '#888',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              YOUR NAME
            </span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => updatePlayer({ playerName: e.target.value })}
              placeholder="ENTER YOUR NAME"
              maxLength={16}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(80,80,80,0.4)',
                padding: '12px 14px',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '13px',
                letterSpacing: '0.15em',
                color: '#D0D0D0',
                textTransform: 'uppercase',
                outline: 'none',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
              onFocus={(e) =>
                ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(180,30,0,0.7)')
              }
              onBlur={(e) =>
                ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(80,80,80,0.4)')
              }
            />
          </div>

          {/* Start button */}
          <ActionButton
            label="START GAME"
            onClick={onStart}
            disabled={!isConnected}
          />
        </MenuPanel>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
