import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MenuPanel, ActionButton } from './MenuPrimitives';

interface JoinLobbyProps {
  joinId: string;
  onUpdateJoinId: (val: string) => void;
  connectionStatus: string;
  isWaitingForHost: boolean;
  onConnect: () => void;
  onReady: () => void;
}

export const JoinLobby = ({
  joinId,
  onUpdateJoinId,
  connectionStatus,
  isWaitingForHost,
  onConnect,
  onReady,
}: JoinLobbyProps) => {
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
        <MenuPanel title="Join Lobby" maxWidth="520px">
          {!isWaitingForHost ? (
            <>
              {/* Room code input */}
              <div>
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.3em',
                    color: '#888',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: '12px',
                    textAlign: 'center',
                  }}
                >
                  ENTER ROOM CODE
                </span>
                <input
                  type="text"
                  value={joinId}
                  onChange={(e) => onUpdateJoinId(e.target.value.toUpperCase())}
                  placeholder="------"
                  maxLength={6}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(139,0,0,0.3)',
                    padding: '18px 14px',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 'clamp(24px, 4vw, 36px)',
                    letterSpacing: '0.5em',
                    color: '#FF9A00',
                    textTransform: 'uppercase',
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                  }}
                  onFocus={(e) =>
                    ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(180,30,0,0.7)')
                  }
                  onBlur={(e) =>
                    ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,0,0,0.3)')
                  }
                />
              </div>

              {isConnected ? (
                <>
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

                  {/* Ready button */}
                  <ActionButton label="READY" onClick={onReady} variant="green" />
                </>
              ) : (
                <>
                  {/* Connect button */}
                  <ActionButton
                    label={connectionStatus === 'CONNECTING...' ? 'CONNECTING...' : 'CONNECT'}
                    onClick={onConnect}
                    disabled={joinId.length < 6 || connectionStatus === 'CONNECTING...'}
                  />
                </>
              )}

              {/* Status message */}
              {connectionStatus !== 'DISCONNECTED' && !isConnected && (
                <div style={{ textAlign: 'center' }}>
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: connectionStatus.includes('ERROR') ? '#EF4444' : '#888',
                    }}
                  >
                    {connectionStatus}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Waiting for host state */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                padding: '24px 0',
              }}
            >
              {/* Spinner */}
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  border: '2px solid rgba(80,80,80,0.3)',
                  borderTop: '2px solid #FF9A00',
                  borderRadius: '50%',
                  animation: 'spin 1.2s linear infinite',
                }}
              />
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '14px',
                    letterSpacing: '0.25em',
                    color: '#FF9A00',
                    textTransform: 'uppercase',
                    margin: '0 0 8px',
                  }}
                >
                  WAITING FOR HOST
                </p>
                <p
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    color: '#666',
                    margin: 0,
                  }}
                >
                  The host will start the game soon...
                </p>
              </div>
            </div>
          )}
        </MenuPanel>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
