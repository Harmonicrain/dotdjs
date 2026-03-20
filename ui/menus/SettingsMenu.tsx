import React, { useState, useEffect } from 'react';
import { useGameStore, GraphicsQuality } from '../../store/useGameStore';
import { MenuPanel } from './MenuPrimitives';

interface SettingsMenuProps {
  onBack?: () => void;
}

const RESOLUTION_SCALES = [
  { value: 0.5, label: '0.5×' },
  { value: 0.75, label: '0.75×' },
  { value: 1.0, label: '1.0×' },
  { value: 1.25, label: '1.25×' },
  { value: 1.5, label: '1.5×' },
];

const QUALITY_PRESETS: { value: GraphicsQuality; label: string }[] = [
  { value: 'low', label: 'LOW' },
  { value: 'medium', label: 'MEDIUM' },
  { value: 'high', label: 'HIGH' },
  { value: 'ultra', label: 'ULTRA' },
];

// ── Reusable sub-components ────────────────────────────────────
const SectionDivider = ({ label }: { label: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: '4px 0 2px',
    }}
  >
    <span
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '10px',
        letterSpacing: '0.3em',
        color: '#FF8C00',
        opacity: 0.7,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
    <div style={{ flex: 1, height: '1px', background: 'rgba(80,0,0,0.4)' }} />
  </div>
);

const SettingRow = ({ children, dimmed }: { children: React.ReactNode; dimmed?: boolean }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
      opacity: dimmed ? 0.4 : 1,
      transition: 'opacity 0.2s ease',
    }}
  >
    {children}
  </div>
);

const RowHeader = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | boolean;
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '11px',
        letterSpacing: '0.22em',
        color: '#888',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
    {value !== undefined && (
      <span
        style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.15em',
          color: '#CCC',
        }}
      >
        {String(value)}
      </span>
    )}
  </div>
);

const StyledSlider = ({
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) => (
  <input
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(parseFloat(e.target.value))}
    style={{ width: '100%', cursor: disabled ? 'not-allowed' : 'pointer', accentColor: '#FF9A00' }}
    className="h-[3px] bg-stone-700 appearance-none"
  />
);

const ToggleButton = ({
  value,
  labels,
  onClick,
}: {
  value: boolean;
  labels: [string, string];
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      background: 'rgba(0,0,0,0.5)',
      border: '1px solid rgba(100,100,100,0.4)',
      cursor: 'pointer',
      padding: '6px 18px',
      fontFamily: "'Share Tech Mono', monospace",
      fontSize: '11px',
      letterSpacing: '0.2em',
      color: '#CCC',
      textTransform: 'uppercase',
      transition: 'border-color 0.15s ease, color 0.15s ease',
      minWidth: '140px',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,140,0,0.5)';
      (e.currentTarget as HTMLElement).style.color = '#FF8C00';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(100,100,100,0.4)';
      (e.currentTarget as HTMLElement).style.color = '#CCC';
    }}
  >
    {value ? labels[0] : labels[1]}
  </button>
);

// ── Main component ─────────────────────────────────────────────
export const SettingsMenu = ({ onBack }: SettingsMenuProps = {}) => {
  const settings = useGameStore((s) => s.settings);
  const playerName = useGameStore((s) => s.playerName);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const updatePlayer = useGameStore((s) => s.updatePlayer);
  const resetSettings = useGameStore((s) => s.resetSettings);

  const [ready, setReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (!onBack) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const isController = settings.inputDevice === 'CONTROLLER';

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-start overflow-y-auto"
      style={{
        padding: '48px 24px 80px',
        opacity: ready ? 1 : 0,
        transform: ready ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      <MenuPanel title="Settings" maxWidth="900px">
        {/* ── PLAYER ────────────────────────────────────────── */}
        <SectionDivider label="PLAYER" />

        <SettingRow>
          <RowHeader label="Player Name" />
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
              padding: '9px 14px',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '13px',
              letterSpacing: '0.15em',
              color: '#D0D0D0',
              textTransform: 'uppercase',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) =>
              ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,154,0,0.7)')
            }
            onBlur={(e) =>
              ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(80,80,80,0.4)')
            }
          />
        </SettingRow>

        {/* ── DISPLAY ───────────────────────────────────────── */}
        <SectionDivider label="DISPLAY" />

        {/* Fullscreen toggle */}
        <SettingRow>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <RowHeader label="Fullscreen" />
            <ToggleButton
              value={isFullscreen}
              labels={['FULLSCREEN', 'WINDOWED']}
              onClick={toggleFullscreen}
            />
          </div>
        </SettingRow>

        {/* Resolution scale */}
        <SettingRow>
          <RowHeader label="Render Resolution" />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {RESOLUTION_SCALES.map(({ value, label }) => {
              const isActive = settings.resolutionScale === value;
              return (
                <button
                  key={value}
                  onClick={() => updateSettings({ resolutionScale: value })}
                  style={{
                    padding: '6px 14px',
                    background: isActive ? 'rgba(255,154,0,0.2)' : 'rgba(0,0,0,0.5)',
                    border: isActive
                      ? '1px solid rgba(255,154,0,0.8)'
                      : '1px solid rgba(80,80,80,0.35)',
                    cursor: 'pointer',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    color: isActive ? '#FF9A00' : '#888',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </SettingRow>

        {/* Graphics quality */}
        <SettingRow>
          <RowHeader label="Graphics Quality" />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {QUALITY_PRESETS.map(({ value, label }) => {
              const isActive = settings.graphicsQuality === value;
              return (
                <button
                  key={value}
                  onClick={() => updateSettings({ graphicsQuality: value })}
                  style={{
                    padding: '6px 14px',
                    background: isActive ? 'rgba(255,154,0,0.2)' : 'rgba(0,0,0,0.5)',
                    border: isActive
                      ? '1px solid rgba(255,154,0,0.8)'
                      : '1px solid rgba(80,80,80,0.35)',
                    cursor: 'pointer',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    color: isActive ? '#FF9A00' : '#888',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </SettingRow>

        {/* Show FPS */}
        <SettingRow>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <RowHeader label="Show FPS Counter" />
            <ToggleButton
              value={settings.showFPS}
              labels={['ON', 'OFF']}
              onClick={() => updateSettings({ showFPS: !settings.showFPS })}
            />
          </div>
        </SettingRow>

        {/* ── GAMEPLAY ──────────────────────────────────────── */}
        <SectionDivider label="GAMEPLAY" />

        {/* FOV */}
        <SettingRow>
          <RowHeader label="Field of View" value={`${settings.fov}°`} />
          <StyledSlider
            min={60}
            max={120}
            step={1}
            value={settings.fov}
            onChange={(v) => updateSettings({ fov: v })}
          />
        </SettingRow>

        {/* ── CONTROLS ──────────────────────────────────────── */}
        <SectionDivider label="CONTROLS" />

        {/* Control scheme */}
        <SettingRow>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <RowHeader label="Control Scheme" />
            <ToggleButton
              value={isController}
              labels={['CONTROLLER', 'MOUSE & KB']}
              onClick={() =>
                updateSettings({ inputDevice: isController ? 'KM' : 'CONTROLLER' })
              }
            />
          </div>
        </SettingRow>

        {/* Mouse sensitivity */}
        <SettingRow>
          <RowHeader
            label="Mouse Sensitivity"
            value={settings.mouseSensitivity.toFixed(1)}
          />
          <StyledSlider
            min={0.1}
            max={5.0}
            step={0.1}
            value={settings.mouseSensitivity}
            onChange={(v) => updateSettings({ mouseSensitivity: v })}
          />
        </SettingRow>

        {/* Controller sensitivity */}
        <SettingRow dimmed={!isController}>
          <RowHeader
            label="Stick Sensitivity"
            value={settings.controllerSensitivity.toFixed(1)}
          />
          <StyledSlider
            min={0.1}
            max={10.0}
            step={0.1}
            value={settings.controllerSensitivity}
            disabled={!isController}
            onChange={(v) => updateSettings({ controllerSensitivity: v })}
          />
        </SettingRow>

        {/* Stick deadzone */}
        <SettingRow dimmed={!isController}>
          <RowHeader
            label="Stick Deadzone"
            value={settings.controllerDeadzone.toFixed(2)}
          />
          <StyledSlider
            min={0.05}
            max={0.3}
            step={0.01}
            value={settings.controllerDeadzone}
            disabled={!isController}
            onChange={(v) => updateSettings({ controllerDeadzone: v })}
          />
        </SettingRow>

        {/* ── Reset ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
          <button
            onClick={resetSettings}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.25em',
              color: '#4a4a4a',
              textTransform: 'uppercase',
              transition: 'color 0.15s ease',
              padding: 0,
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = '#CC2200')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = '#4a4a4a')
            }
          >
            RESET TO DEFAULTS
          </button>
        </div>

        {onBack && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '2px' }}>
            <button
              onClick={onBack}
              style={{
                padding: '10px 24px',
                background: 'rgba(255,154,0,0.12)',
                border: '1px solid rgba(255,154,0,0.7)',
                cursor: 'pointer',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.22em',
                color: '#FF9A00',
                textTransform: 'uppercase',
                transition: 'background 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,154,0,0.22)';
                el.style.boxShadow = '0 0 14px rgba(255,154,0,0.25)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'rgba(255,154,0,0.12)';
                el.style.boxShadow = 'none';
              }}
            >
              Back
            </button>
          </div>
        )}
      </MenuPanel>
    </div>
  );
};
