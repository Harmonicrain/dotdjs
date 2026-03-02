
import React, { useState } from 'react';
import { MainMenu, HostLobby, JoinLobby } from './GameMenus';
import { MAPS } from '../config';

type MenuState = 'MAIN' | 'HOST_LOBBY' | 'JOIN_LOBBY';

interface GameMenuManagerProps {
    selectedMap: string;
    onSelectMap: (id: string) => void;
    
    // Network/Lobby Data
    connectionStatus: string;
    roomId: string;
    remotePlayerName: string;
    isClientReady: boolean; // Remote client is ready (for Host view)
    isMapLoaded: boolean;

    // Actions
    onStartSolo: (name: string) => void;
    onHostInit: () => void;
    onHostStart: (name: string) => void;
    onJoinInit: (joinId: string) => void;
    onClientReady: (name: string) => void;
    onAbort: () => void;
    onGameReset: () => void; // Reset entire app (reload)
}

export const GameMenuManager: React.FC<GameMenuManagerProps> = ({
    selectedMap,
    onSelectMap,
    connectionStatus,
    roomId,
    remotePlayerName,
    isClientReady,
    isMapLoaded,
    onStartSolo,
    onHostInit,
    onHostStart,
    onJoinInit,
    onClientReady,
    onAbort,
    onGameReset
}) => {
    const [menuState, setMenuState] = useState<MenuState>('MAIN');
    const [joinId, setJoinId] = useState("");
    const [tempName, setTempName] = useState("");
    const [isWaitingForHost, setIsWaitingForHost] = useState(false); // Local client waiting

    const handleBackToMain = () => {
        onAbort();
        setMenuState('MAIN');
        setIsWaitingForHost(false);
        setJoinId("");
    };

    const handleJoinConnect = () => {
        onJoinInit(joinId);
    };

    const handleClientReadyClick = () => {
        onClientReady(tempName);
        setIsWaitingForHost(true);
    };

    const mapName = MAPS.find(m => m.id === selectedMap)?.name;

    return (
        <>
            {menuState === 'MAIN' && (
                <MainMenu 
                    selectedMap={selectedMap} 
                    onSelectMap={onSelectMap}
                    onStartSolo={() => { 
                        onStartSolo(tempName || "Survivor"); 
                    }}
                    onHost={() => { 
                        setMenuState('HOST_LOBBY'); 
                        onHostInit(); 
                    }}
                    onJoin={() => { 
                        setMenuState('JOIN_LOBBY'); 
                    }}
                    isLoading={false}
                />
            )}
            
            {menuState === 'HOST_LOBBY' && (
                <HostLobby 
                    mapName={mapName}
                    roomId={roomId}
                    connectionStatus={connectionStatus}
                    remotePlayerName={remotePlayerName}
                    isClientReady={isClientReady}
                    tempName={tempName}
                    onUpdateTempName={setTempName}
                    onStart={() => onHostStart(tempName)}
                    onAbort={handleBackToMain}
                />
            )}
            
            {menuState === 'JOIN_LOBBY' && (
                <JoinLobby 
                    joinId={joinId}
                    onUpdateJoinId={setJoinId}
                    connectionStatus={connectionStatus}
                    isWaitingForHost={isWaitingForHost}
                    tempName={tempName}
                    onUpdateTempName={setTempName}
                    onConnect={handleJoinConnect}
                    onReady={handleClientReadyClick}
                    onAbort={handleBackToMain}
                />
            )}
        </>
    );
};
