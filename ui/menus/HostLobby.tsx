
import React from 'react';

interface HostLobbyProps {
    mapName?: string;
    roomId: string;
    connectionStatus: string;
    remotePlayerName: string;
    isClientReady: boolean;
    tempName: string;
    onUpdateTempName: (val: string) => void;
    onStart: () => void;
    onAbort: () => void;
}

export const HostLobby = ({ mapName, roomId, connectionStatus, remotePlayerName, isClientReady, tempName, onUpdateTempName, onStart, onAbort }: HostLobbyProps) => (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black font-serif select-none">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950 via-black to-stone-950" />
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px 80px rgba(0,0,0,0.9)' }} />
        <div className="absolute inset-0 opacity-30" style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(139, 0, 0, 0.4) 0%, transparent 50%)'
        }} />
        
        <div className="relative w-full max-w-md z-10">
            {/* Card with gothic arch top */}
            <div className="relative bg-gradient-to-b from-stone-900 via-stone-950 to-black overflow-hidden"
                style={{
                    clipPath: 'polygon(0% 8%, 10% 2%, 50% 0%, 90% 2%, 100% 8%, 100% 100%, 0% 100%)',
                    boxShadow: '0 0 60px rgba(139, 0, 0, 0.2)',
                }}>
                
                <div className="border border-red-900/30 p-10 pt-12">
                    {/* Decorative cross */}
                    <div className="text-red-800 text-3xl text-center mb-6 animate-pulse">✝</div>
                    
                    <h2 className="text-3xl font-bold tracking-[0.2em] text-stone-200 uppercase text-center mb-10"
                        style={{ textShadow: '0 0 20px rgba(139, 0, 0, 0.5)' }}>
                        Summon Allies
                    </h2>
                    
                    <div className="space-y-6">
                        {/* Map Info */}
                        <div className="text-center pb-4 border-b border-stone-800">
                            <span className="text-stone-600 text-xs tracking-[0.3em] uppercase font-sans">Destination</span>
                            <p className="text-stone-300 text-xl font-semibold mt-2">{mapName}</p>
                        </div>

                        {/* Room Code */}
                        <div className="bg-black/60 p-6 border border-stone-800 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-900/0 via-red-900/10 to-red-900/0 animate-pulse" />
                            <span className="text-stone-500 text-xs tracking-[0.3em] uppercase block mb-3 font-sans relative">Ritual Code</span>
                            <p className="text-5xl font-mono font-bold text-amber-500 tracking-[0.4em] select-all relative">
                                {roomId || "------"}
                            </p>
                        </div>
                        
                        {/* Status */}
                        <div className="text-center">
                            <span className={`text-sm tracking-[0.2em] uppercase font-sans ${
                                connectionStatus === 'CONNECTED' ? 'text-green-600' : 'text-stone-500 animate-pulse'
                            }`}>
                                {connectionStatus === 'CONNECTED' ? '⦿ Linked' : connectionStatus}
                            </span>
                        </div>

                        {/* Client Ready */}
                        {isClientReady && (
                            <div className="p-4 bg-green-950/30 border border-green-900/40 text-center">
                                <span className="text-green-500 text-sm tracking-[0.2em] uppercase font-sans">
                                    ☠ {remotePlayerName} has joined
                                </span>
                            </div>
                        )}

                        {/* Name & Start */}
                        <div className="space-y-4 pt-4">
                            <input 
                                type="text" 
                                placeholder="INSCRIBE YOUR NAME" 
                                value={tempName} 
                                onChange={e => onUpdateTempName(e.target.value)} 
                                className="w-full bg-black border border-stone-700 p-4 text-center text-stone-200 tracking-[0.15em] focus:border-red-800 outline-none placeholder:text-stone-700 uppercase font-sans" 
                                maxLength={12} 
                            />
                            <button 
                                onClick={onStart} 
                                disabled={connectionStatus !== 'CONNECTED'} 
                                className="w-full py-5 bg-gradient-to-b from-red-900 to-red-950 hover:from-red-800 hover:to-red-900 disabled:from-stone-900 disabled:to-stone-950 disabled:text-stone-700 text-stone-100 font-bold tracking-[0.2em] uppercase transition-all disabled:cursor-not-allowed border border-red-800/50 disabled:border-stone-800"
                                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                            >
                                Begin the Ritual
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <button onClick={onAbort} className="mt-8 text-stone-600 hover:text-red-700 text-sm tracking-[0.2em] uppercase transition-colors z-10 font-sans">
            ← Abandon
        </button>
    </div>
);
