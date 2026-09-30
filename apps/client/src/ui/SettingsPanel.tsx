import { useAppStore } from '../state/store';
import type { Settings } from '../state/settings';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <label className="setting">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{format ? format(value) : value}</output>
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="setting toggle">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const update = useAppStore((s) => s.updateSettings);
  const set =
    <K extends keyof Settings>(key: K) =>
    (value: Settings[K]) =>
      update({ [key]: value } as Partial<Settings>);

  return (
    <div className="settings">
      <Slider
        label="Mouse sensitivity"
        value={settings.mouseSensitivity}
        min={0.2}
        max={3}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={set('mouseSensitivity')}
      />
      <Slider
        label="Gamepad sensitivity"
        value={settings.gamepadSensitivity}
        min={0.3}
        max={3}
        step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={set('gamepadSensitivity')}
      />
      <Slider
        label="Field of view"
        value={settings.fov}
        min={55}
        max={95}
        step={1}
        format={(v) => `${v}°`}
        onChange={set('fov')}
      />
      <Slider
        label="Volume"
        value={settings.volume}
        min={0}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={set('volume')}
      />
      <Slider
        label="Resolution"
        value={settings.resolutionScale}
        min={0.5}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={set('resolutionScale')}
      />
      <Toggle label="Shadows" value={settings.shadows} onChange={set('shadows')} />
      <Toggle label="Invert look" value={settings.invertY} onChange={set('invertY')} />
      <Toggle label="Show FPS / ping" value={settings.showStats} onChange={set('showStats')} />
    </div>
  );
}
