
import React from 'react';

interface JoinLobbyProps {
    joinId: string;
    onUpdateJoinId: (val: string) => void;
    connectionStatus: string;
    isWaitingForHost: boolean;
    tempName: string;
    onUpdateTempName: (val: string) => void;
    onConnect: () => void;
    onReady: () => void;
    onAbort: () => void;
}

export const JoinLobby = ({ joinId, onUpdateJoinId, connectionStatus, isWaitingForHost, tempName, onUpdateTempName, onConnect, onReady, onAbort }: JoinLobbyProps) => (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black font-serif select-none">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950 via-black to-stone-950" />
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px 80px rgba(0,0,0,0.9)' }} />
        <div className="absolute inset-0 opacity-30" style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(180, 83, 9, 0.3) 0%, transparent 50%)'
        }} />
        
        <div className="relative w-full max-w-md z-10">
            {/* Card with gothic arch */}
            <div className="relative bg-gradient-to-b from-stone-900 via-stone-950 to-black overflow-hidden"
                style={{
                    clipPath: 'polygon(0% 8%, 10% 2%, 50% 0%, 90% 2%, 100% 8%, 100% 100%, 0% 100%)',
                    boxShadow: '0 0 60px rgba(180, 83, 9, 0.15)',
                }}>
                
                <div className="border border-amber-900/30 p-10 pt-12">
                    <div className="text-amber-700 text-3xl text-center mb-6 animate-pulse">⛧</div>
                    
                    <h2 className="text-3xl font-bold tracking-[0.2em] text-stone-200 uppercase text-center mb-10"
                        style={{ textShadow: '0 0 20px rgba(180, 83, 9, 0.4)' }}>
                        Join Ritual
                    </h2>

                    {!isWaitingForHost ? (
                        <div className="space-y-6">
                            {/* Code Input */}
                            <div>
                                <label className="text-stone-500 text-xs tracking-[0.3em] uppercase block text-center mb-4 font-sans">
                                    Enter Ritual Code
                                </label>
                                <input 
                                    type="text" 
                                    value={joinId} 
                                    onChange={e => onUpdateJoinId(e.target.value.toUpperCase())} 
                                    className="w-full bg-black border border-stone-700 p-5 text-center text-4xl font-mono text-amber-500 tracking-[0.5em] uppercase focus:border-amber-700 outline-none placeholder:text-stone-800" 
                                    placeholder="------" 
                                    maxLength={6} 
                                />
                            </div>

                            {connectionStatus === 'CONNECTED' ? (
                                <div className="space-y-4">
                                    <input 
                                        type="text" 
                                        placeholder="INSCRIBE YOUR NAME" 
                                        value={tempName} 
                                        onChange={e => onUpdateTempName(e.target.value)} 
                                        className="w-full bg-black border border-stone-700 p-4 text-center text-stone-200 tracking-[0.15em] focus:border-amber-800 outline-none placeholder:text-stone-700 uppercase font-sans" 
                                        maxLength={12} 
                                    />
                                    <button 
                                        onClick={onReady} 
                                        className="w-full py-5 bg-gradient-to-b from-green-900/80 to-green-950 hover:from-green-800/90 hover:to-green-900 border border-green-700/50 text-green-100 font-bold tracking-[0.2em] uppercase transition-all"
                                    >
                                        Ready for Death
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={onConnect} 
                                    disabled={joinId.length < 6 || connectionStatus === 'CONNECTING...'} 
                                    className="w-full py-5 bg-gradient-to-b from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 disabled:from-stone-900 disabled:to-stone-950 disabled:text-stone-700 text-stone-200 font-bold tracking-[0.2em] uppercase transition-all disabled:cursor-not-allowed border border-stone-700"
                                >
                                    {connectionStatus === 'CONNECTING...' ? 'Seeking...' : 'Connect'}
                                </button>
                            )}
                            
                            {connectionStatus !== 'DISCONNECTED' && (
                                <p className={`text-center text-xs tracking-[0.2em] uppercase font-sans ${
                                    connectionStatus.includes('ERROR') ? 'text-red-500' : 'text-stone-500'
                                }`}>
                                    {connectionStatus}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-8 py-8">
                            <div className="relative">
                                <div className="w-16 h-16 border-2 border-stone-800 rounded-full" />
                                <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-amber-600 rounded-full animate-spin" />
                                <span className="absolute inset-0 flex items-center justify-center text-amber-700 text-2xl">☠</span>
                            </div>
                            <div className="text-center">
                                <p className="text-amber-500 text-lg font-semibold tracking-[0.2em] uppercase mb-2">Awaiting</p>
                                <p className="text-stone-600 text-sm tracking-wider font-sans">The host will begin soon...</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        <button onClick={onAbort} className="mt-8 text-stone-600 hover:text-amber-700 text-sm tracking-[0.2em] uppercase transition-colors z-10 font-sans">
            ← Abandon
        </button>
    </div>
);
