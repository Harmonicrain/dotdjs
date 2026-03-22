import { create } from 'zustand';
import { PowerUpType, DoorState, DebugInfo } from '../types/index';
import { WEAPON_CONFIGS, DEFAULT_SETTINGS as BASE_SETTINGS } from '../config';

const startWeapon = WEAPON_CONFIGS[0];

export interface KillEvent {
  id: string;
  enemyType: 'zombie' | 'hellhound';
  isHeadshot: boolean;
  points: number;
  timestamp: number;
}

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
  reviveProgress: number;
  killEvents: KillEvent[];
  isAiming: boolean;
  weaponId: string;
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

export interface RenderStatsData {
  isActive: boolean;
  drawCalls: number;
  activeMeshes: number;
  totalMeshes: number;
  totalVertices: number;
  totalFaces: number;
  activeLights: number;
  totalLights: number;
  pbrMaterials: number;
  totalMaterials: number;
  shadowGenerators: number;
  shadowMapSize: number;
  textures: number;
  particleSystems: number;
}

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface ExtendedSettings {
  inputDevice: 'KM' | 'CONTROLLER' | 'TOUCH';
  mouseSensitivity: number;
  controllerSensitivity: number;
  controllerDeadzone: number;
  touchSensitivity: number;
  resolutionScale: number;
  graphicsQuality: GraphicsQuality;
  fov: number;
  showFPS: boolean;
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
  playerPosition: { x: number; y: number; z: number; rot: number };
  debugControls: DebugControlsData;
  renderStats: RenderStatsData;
  settings: ExtendedSettings;
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
  updateSettings: (updates: Partial<ExtendedSettings>) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = 'zombz_settings';

const EXTENDED_DEFAULT_SETTINGS: ExtendedSettings = {
  ...BASE_SETTINGS,
  resolutionScale: 1.0,
  graphicsQuality: 'high',
  fov: 90,
  showFPS: false,
};

const getSavedSettings = (): ExtendedSettings | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // Merge with defaults so new fields are populated on upgrade
    return { ...EXTENDED_DEFAULT_SETTINGS, ...parsed };
  } catch {
    return null;
  }
};

const getDefaultSettings = (): ExtendedSettings => {
  const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
  if (isTouchDevice) {
    return { ...EXTENDED_DEFAULT_SETTINGS, inputDevice: 'TOUCH' };
  }
  return EXTENDED_DEFAULT_SETTINGS;
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
  playerName: '',
  reviveProgress: 0,
  killEvents: [],
  isAiming: false,
  weaponId: startWeapon.id,

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
  renderStats: {
    isActive: false,
    drawCalls: 0,
    activeMeshes: 0,
    totalMeshes: 0,
    totalVertices: 0,
    totalFaces: 0,
    activeLights: 0,
    totalLights: 0,
    pbrMaterials: 0,
    totalMaterials: 0,
    shadowGenerators: 0,
    shadowMapSize: 0,
    textures: 0,
    particleSystems: 0,
  },
  settings: getSavedSettings() ?? getDefaultSettings(),

  // Remote Defaults
  remotePlayerName: 'Unknown',
  remoteHealth: 100,
  remotePoints: 500,
  remoteTotalEarnedPoints: 500,
  remotePerks: {},
  remoteKills: 0,
  remoteShots: 0,

  // Actions
  updatePlayer: (updates) => set(updates),
  updateGame: (updates) => set(updates),
  updateRemote: (updates) => set(updates),
  updateSettings: (updates) =>
    set((state) => {
      const newSettings = { ...state.settings, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      return { settings: newSettings };
    }),
  resetSettings: () =>
    set(() => {
      localStorage.removeItem(STORAGE_KEY);
      return { settings: getDefaultSettings() };
    }),
}));
