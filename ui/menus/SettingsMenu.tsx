import React, { useState, useEffect } from 'react';
import { useGameStore, GraphicsQuality } from '../../store/useGameStore';
import { MenuPanel } from './MenuPrimitives';

interface SettingsMenuProps {
  onBack?: () => void;
}

type SettingsCategoryId = 'PLAYER' | 'DISPLAY' | 'GAMEPLAY' | 'CONTROLS';

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

const SETTINGS_CATEGORIES: {
  id: SettingsCategoryId;
  label: string;
  description: string;
}[] = [
  {
    id: 'PLAYER',
    label: 'PLAYER',
    description: 'Identity and profile settings.',
  },
  {
    id: 'DISPLAY',
    label: 'DISPLAY',
    description: 'Video and rendering preferences.',
  },
  {
    id: 'GAMEPLAY',
    label: 'GAMEPLAY',
    description: 'Core in-game camera behavior.',
  },
  {
    id: 'CONTROLS',
    label: 'CONTROLS',
    description: 'Input device and sensitivity tuning.',
  },
];

// ── Reusable sub-components ────────────────────────────────────
const SettingRow = ({ children, dimmed }: { children: React.ReactNode; dimmed?: boolean }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '10px 0',
      borderBottom: '1px solid rgba(80,0,0,0.2)',
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

const ChoiceButton = ({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
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
      textTransform: 'uppercase',
    }}
  >
    {label}
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
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' && !!document.fullscreenElement,
  );
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategoryId>('PLAYER');

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

  const selectedCategoryIndex = SETTINGS_CATEGORIES.findIndex((c) => c.id === selectedCategory);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return;
      }

      e.preventDefault();

      if (e.key === 'ArrowUp') {
        setSelectedCategory(
          SETTINGS_CATEGORIES[Math.max(0, selectedCategoryIndex - 1)].id,
        );
      } else {
        setSelectedCategory(
          SETTINGS_CATEGORIES[
            Math.min(SETTINGS_CATEGORIES.length - 1, selectedCategoryIndex + 1)
          ].id,
        );
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCategoryIndex]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const isController = settings.inputDevice === 'CONTROLLER';
  const isTouch = settings.inputDevice === 'TOUCH';
  const selectedCategoryMeta =
    SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory) ?? SETTINGS_CATEGORIES[0];

  const renderCategorySettings = () => {
    if (selectedCategory === 'PLAYER') {
      return (
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
      );
    }

    if (selectedCategory === 'DISPLAY') {
      return (
        <>
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

          <SettingRow>
            <RowHeader label="Render Resolution" />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {RESOLUTION_SCALES.map(({ value, label }) => (
                <ChoiceButton
                  key={value}
                  label={label}
                  isActive={settings.resolutionScale === value}
                  onClick={() => updateSettings({ resolutionScale: value })}
                />
              ))}
            </div>
          </SettingRow>

          <SettingRow>
            <RowHeader label="Graphics Quality" />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {QUALITY_PRESETS.map(({ value, label }) => (
                <ChoiceButton
                  key={value}
                  label={label}
                  isActive={settings.graphicsQuality === value}
                  onClick={() => updateSettings({ graphicsQuality: value })}
                />
              ))}
            </div>
          </SettingRow>

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
        </>
      );
    }

    if (selectedCategory === 'GAMEPLAY') {
      return (
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
      );
    }

    return (
      <>
        <SettingRow>
          <RowHeader label="Control Scheme" />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {([
              { value: 'KM' as const, label: 'MOUSE & KB' },
              { value: 'CONTROLLER' as const, label: 'CONTROLLER' },
              { value: 'TOUCH' as const, label: 'TOUCH' },
            ]).map(({ value, label }) => (
              <ChoiceButton
                key={value}
                label={label}
                isActive={settings.inputDevice === value}
                onClick={() => updateSettings({ inputDevice: value })}
              />
            ))}
          </div>
        </SettingRow>

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

        <SettingRow dimmed={!isTouch}>
          <RowHeader
            label="Touch Sensitivity"
            value={settings.touchSensitivity.toFixed(1)}
          />
          <StyledSlider
            min={1.0}
            max={15.0}
            step={0.5}
            value={settings.touchSensitivity}
            disabled={!isTouch}
            onChange={(v) => updateSettings({ touchSensitivity: v })}
          />
        </SettingRow>
      </>
    );
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden select-none pointer-events-auto">
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
        <MenuPanel title="Settings" maxWidth="900px" height="min(640px, 85vh)">
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', margin: '-28px', marginTop: '-18px' }}>
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
                {SETTINGS_CATEGORIES.map((category) => {
                  const isSelected = category.id === selectedCategory;

                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
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
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '20%',
                          bottom: '20%',
                          width: '3px',
                          background: '#FF9A00',
                          opacity: isSelected ? 1 : 0,
                          boxShadow: '0 0 8px rgba(255,154,0,0.6)',
                          transition: 'opacity 0.12s ease',
                        }}
                      />
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>

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
              <div>
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.3em',
                    color: '#FF8C00',
                    opacity: 0.7,
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  Selected Category
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
                  {selectedCategoryMeta.label}
                </h3>
                <p
                  style={{
                    margin: '8px 0 0',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.16em',
                    color: '#666',
                    textTransform: 'uppercase',
                    lineHeight: 1.6,
                  }}
                >
                  {selectedCategoryMeta.description}
                </p>
              </div>

              {renderCategorySettings()}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: onBack ? 'space-between' : 'flex-end',
              alignItems: 'center',
              margin: '-28px',
              marginTop: '0',
              padding: '16px 24px',
              borderTop: '1px solid rgba(80,0,0,0.3)',
              background: 'rgba(8,2,2,0.6)',
              gap: '12px',
            }}
          >
            {onBack && (
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
            )}

            <button
              onClick={resetSettings}
              style={{
                padding: '10px 20px',
                background: 'rgba(40,0,0,0.4)',
                border: '1px solid rgba(120,40,20,0.45)',
                cursor: 'pointer',
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.22em',
                color: '#8E6458',
                textTransform: 'uppercase',
                transition: 'color 0.15s ease, border-color 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = '#CC2200';
                el.style.borderColor = 'rgba(180,50,30,0.7)';
                el.style.background = 'rgba(60,0,0,0.45)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.color = '#8E6458';
                el.style.borderColor = 'rgba(120,40,20,0.45)';
                el.style.background = 'rgba(40,0,0,0.4)';
              }}
            >
              Reset To Defaults
            </button>
          </div>
        </MenuPanel>
      </div>
    </div>
  );
};
