import React, { useState } from 'react';
import { MainMenu } from './menus/MainMenu';
import { MapSelect } from './menus/MapSelect';
import { MultiplayerMenu } from './menus/MultiplayerMenu';
import { SettingsMenu } from './menus/SettingsMenu';
import { HostLobby } from './menus/HostLobby';
import { JoinLobby } from './menus/JoinLobby';
import { MenuShell } from './menus/MenuShell';
import { MAPS } from '../config';
import { useGameStore } from '../store/useGameStore';

type MenuState = 'MAIN' | 'MAP_SELECT' | 'MULTIPLAYER' | 'HOST_LOBBY' | 'JOIN_LOBBY' | 'SETTINGS';
type MapSelectMode = 'solo' | 'host';

interface GameMenuManagerProps {
  selectedMap: string;
  onSelectMap: (id: string) => void;

  // Network/Lobby Data
  connectionStatus: string;
  roomId: string;
  remotePlayerName: string;
  isClientReady: boolean;

  // Actions
  onStartSolo: (mapId: string, name: string) => void;
  onHostInit: () => void;
  onHostStart: (mapId: string, name: string) => void;
  onJoinInit: (joinId: string) => void;
  onClientReady: (name: string) => void;
  onAbort: () => void;
}

export const GameMenuManager = ({
  selectedMap,
  onSelectMap,
  connectionStatus,
  roomId,
  remotePlayerName,
  isClientReady,
  onStartSolo,
  onHostInit,
  onHostStart,
  onJoinInit,
  onClientReady,
  onAbort,
}: GameMenuManagerProps) => {
  const [menuState, setMenuState] = useState<MenuState>('MAIN');
  const [mapSelectMode, setMapSelectMode] = useState<MapSelectMode>('solo');
  const [joinId, setJoinId] = useState('');
  const [isWaitingForHost, setIsWaitingForHost] = useState(false);
  const [prevState, setPrevState] = useState<MenuState>('MAIN');

  const playerName = useGameStore((s) => s.playerName);

  const navigate = (next: MenuState) => {
    setPrevState(menuState);
    setMenuState(next);
  };

  const handleBackToMain = () => {
    onAbort();
    setMenuState('MAIN');
    setIsWaitingForHost(false);
    setJoinId('');
  };

  // ── MAIN MENU ────────────────────────────────────────────────
  const handlePlaySolo = () => {
    setMapSelectMode('solo');
    navigate('MAP_SELECT');
  };

  const handleMultiplayer = () => {
    navigate('MULTIPLAYER');
  };

  const handleSettings = () => {
    navigate('SETTINGS');
  };

  // ── MAP SELECT ───────────────────────────────────────────────
  const handleMapConfirm = (mapId: string) => {
    onSelectMap(mapId);
    if (mapSelectMode === 'solo') {
      onStartSolo(mapId, playerName || 'Survivor');
    } else {
      onHostInit();
      navigate('HOST_LOBBY');
    }
  };

  // ── MULTIPLAYER MENU ─────────────────────────────────────────
  const handleHostGame = () => {
    setMapSelectMode('host');
    navigate('MAP_SELECT');
  };

  const handleJoinGame = () => {
    navigate('JOIN_LOBBY');
  };

  // ── LOBBIES ──────────────────────────────────────────────────
  const handleJoinConnect = () => {
    onJoinInit(joinId);
  };

  const handleClientReady = () => {
    onClientReady(playerName || 'Survivor');
    setIsWaitingForHost(true);
  };

  const mapName = MAPS.find((m) => m.id === selectedMap)?.name;

  // ── Per-state shell config ───────────────────────────────────
  const shellConfig = (() => {
    switch (menuState) {
      case 'MAIN':
        return {
          showLogo: true,
          bottomRightText: '[↑↓] NAVIGATE  [ENTER] SELECT',
        };
      case 'MULTIPLAYER':
        return {
          showLogo: true,
          pinBackHeaderTop: true,
          bottomRightText: '[↑↓] NAVIGATE  [ENTER] SELECT  [ESC] BACK',
          onBack: () => navigate('MAIN'),
          breadcrumb: 'MAIN MENU / MULTIPLAYER',
        };
      case 'SETTINGS':
        return {
          showLogo: false,
          bottomRightText: '[ESC] BACK',
          onBack: () => navigate('MAIN'),
          breadcrumb: 'MAIN MENU / SETTINGS',
        };
      case 'MAP_SELECT':
        return {
          showLogo: false,
          bottomRightText: '[↑↓] NAVIGATE  [ENTER] SELECT  [ESC] BACK',
          onBack: () => navigate(mapSelectMode === 'host' ? 'MULTIPLAYER' : 'MAIN'),
          breadcrumb: mapSelectMode === 'host'
            ? 'MAIN MENU / MULTIPLAYER / MAP SELECT'
            : 'MAIN MENU / MAP SELECT',
        };
      case 'HOST_LOBBY':
        return {
          showLogo: false,
          bottomRightText: '[ESC] ABANDON',
          onBack: handleBackToMain,
          backLabel: 'ABANDON',
          breadcrumb: 'MAIN MENU / MULTIPLAYER / HOST LOBBY',
        };
      case 'JOIN_LOBBY':
        return {
          showLogo: false,
          bottomRightText: '[ESC] ABANDON',
          onBack: handleBackToMain,
          backLabel: 'ABANDON',
          breadcrumb: 'MAIN MENU / MULTIPLAYER / JOIN LOBBY',
        };
    }
  })();

  return (
    <MenuShell {...shellConfig}>
      {menuState === 'MAIN' && (
        <MainMenu
          onPlaySolo={handlePlaySolo}
          onMultiplayer={handleMultiplayer}
          onSettings={handleSettings}
          skipAnimations={prevState !== 'MAIN'}
        />
      )}
      {menuState === 'MULTIPLAYER' && (
        <MultiplayerMenu
          onHost={handleHostGame}
          onJoin={handleJoinGame}
        />
      )}
      {menuState === 'SETTINGS' && (
        <SettingsMenu />
      )}
      {menuState === 'MAP_SELECT' && (
        <MapSelect
          initialMapId={selectedMap}
          mode={mapSelectMode}
          onConfirm={handleMapConfirm}
        />
      )}
      {menuState === 'HOST_LOBBY' && (
        <HostLobby
          mapName={mapName}
          roomId={roomId}
          connectionStatus={connectionStatus}
          remotePlayerName={remotePlayerName}
          isClientReady={isClientReady}
          onStart={() => onHostStart(selectedMap, playerName || 'Survivor')}
        />
      )}
      {menuState === 'JOIN_LOBBY' && (
        <JoinLobby
          joinId={joinId}
          onUpdateJoinId={setJoinId}
          connectionStatus={connectionStatus}
          isWaitingForHost={isWaitingForHost}
          onConnect={handleJoinConnect}
          onReady={handleClientReady}
        />
      )}
    </MenuShell>
  );
};
