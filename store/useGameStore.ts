
import { create } from 'zustand';
import { PowerUpType, DoorState, DebugInfo } from '../types/index';
import { WEAPON_CONFIGS, DEFAULT_SETTINGS } from '../config';

const startWeapon = WEAPON_CONFIGS[0];

export interface PlayerFields {
  points: number;
  totalEarnedPoints: number;
  health: number;
  ammo: number;
  reserveAmmo: number;
  activeWeaponIndex: number;
  weaponName: string;
  maxClip: number;
  perks: Record<string, boolean>;
  isDowned: boolean;
  isBeingRevived: boolean;
  flashColor: string | null;
  kills: number;
  shotsFired: number;
  playerName: string;
}

export interface ScaleWeaponModeData {
  weaponId: string;
  scale: { x: number; y: number; z: number };
  step: number;
  axis: 'all' | 'x' | 'y' | 'z';
}

export interface DebugControlsData {
  isActive: boolean;
  fps: number;
  inputSource: 'MOUSE' | 'CONTROLLER' | 'NONE';
  cameraRotation: { x: number; y: number };
  rawMouseDelta: { x: number; y: number };
  rawControllerLook: { x: number; y: number };
}

export interface GameFields {
  round: number;
  showRoundIntro: boolean;
  activeZombiesCount: number;
  zombiesSpawned: number;
  zombiesKilledInRound: number;
  zombiesToSpawn: number;
  totalRoundZombies: number;
  isDogRound: boolean;
  powerOn: boolean;
  activePowerUps: Partial<Record<PowerUpType, number>>;
  interactionMsg: string | null;
  hoverMsg: string | null;
  isPaused: boolean;
  isSpectating: boolean;
  isGameOver: boolean;
  showFade: boolean;
  gameMode: 'SOLO' | 'HOST' | 'CLIENT';
  connectionStatus: string;
  doorStates: Record<string, DoorState>;
  isConsoleOpen: boolean;
  consoleResult: string | null;
  isDebugMode: boolean;
  isDebugActive: boolean;
  debugInfo: DebugInfo | null;
  scaleWeaponMode: ScaleWeaponModeData | null;
  currentZone: number;
  playerPosition: { x: number, y: number, z: number, rot: number };
  debugControls: DebugControlsData;
  settings: {
    inputDevice: 'KM' | 'CONTROLLER';
    mouseSensitivity: number;
    controllerSensitivity: number;
    controllerDeadzone: number;
  };
}

export interface RemoteFields {
  remotePlayerName: string;
  remoteHealth: number;
  remotePoints: number;
  remoteTotalEarnedPoints: number;
  remotePerks: Record<string, boolean>;
  remoteKills: number;
  remoteShots: number;
}

export interface GameStore extends PlayerFields, GameFields, RemoteFields {
  updatePlayer: (updates: Partial<PlayerFields>) => void;
  updateGame: (updates: Partial<GameFields>) => void;
  updateRemote: (updates: Partial<RemoteFields>) => void;
  updateSettings: (updates: Partial<GameStore['settings']>) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = 'zombz_settings';

const getSavedSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
};

export const useGameStore = create<GameStore>((set) => ({
  // Player Defaults
  points: 500,
  totalEarnedPoints: 500,
  health: 100,
  ammo: startWeapon.clipSize,
  reserveAmmo: startWeapon.maxReserve,
  activeWeaponIndex: 0,
  weaponName: startWeapon.name,
  maxClip: startWeapon.clipSize,
  perks: {},
  isDowned: false,
  isBeingRevived: false,
  flashColor: null,
  kills: 0,
  shotsFired: 0,
  playerName: 'Survivor',

  // Game Defaults
  round: 1,
  showRoundIntro: false,
  activeZombiesCount: 0,
  zombiesSpawned: 0,
  zombiesKilledInRound: 0,
  zombiesToSpawn: 0,
  totalRoundZombies: 0,
  isDogRound: false,
  powerOn: false,
  activePowerUps: {},
  interactionMsg: null,
  hoverMsg: null,
  isPaused: false,
  isSpectating: false,
  isGameOver: false,
  showFade: false,
  gameMode: 'SOLO',
  connectionStatus: 'DISCONNECTED',
  doorStates: {},
  isConsoleOpen: false,
  consoleResult: null,
  isDebugMode: false,
  isDebugActive: false,
  debugInfo: null,
  scaleWeaponMode: null,
  currentZone: 0,
  playerPosition: { x: 0, y: 0, z: 0, rot: 0 },
  debugControls: {
    isActive: false,
    fps: 0,
    inputSource: 'NONE',
    cameraRotation: { x: 0, y: 0 },
    rawMouseDelta: { x: 0, y: 0 },
    rawControllerLook: { x: 0, y: 0 },
  },
  settings: getSavedSettings() || DEFAULT_SETTINGS,

  // Remote Defaults
  remotePlayerName: 'Unknown',
  remoteHealth: 100,
  remotePoints: 0,
  remoteTotalEarnedPoints: 0,
  remotePerks: {},
  remoteKills: 0,
  remoteShots: 0,

  // Actions
  updatePlayer: (updates) => set(updates),
  updateGame: (updates) => set(updates),
  updateRemote: (updates) => set(updates),
  updateSettings: (updates) => set((state) => {
    const newSettings = { ...state.settings, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    return { settings: newSettings };
  }),
  resetSettings: () => set(() => {
    localStorage.removeItem(STORAGE_KEY);
    return { settings: DEFAULT_SETTINGS };
  }),
}));
