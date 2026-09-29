export interface Settings {
  name: string;
  mouseSensitivity: number;
  gamepadSensitivity: number;
  invertY: boolean;
  /** Vertical field of view in degrees. */
  fov: number;
  volume: number;
  resolutionScale: number;
  shadows: boolean;
  showStats: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  mouseSensitivity: 1,
  gamepadSensitivity: 1,
  invertY: false,
  fov: 72,
  volume: 0.8,
  resolutionScale: 1,
  shadows: true,
  showStats: false,
};

const STORAGE_KEY = 'dotd:settings:v1';

/** Settings are a per-browser convenience; any storage failure falls back to defaults. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: settings just won't persist.
  }
}
