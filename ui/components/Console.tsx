
import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

interface ConsoleProps {
    onCommand: (command: string) => void;
}

export const Console: React.FC<ConsoleProps> = ({ onCommand }) => {
    const isConsoleOpen = useGameStore(s => s.isConsoleOpen);
    const consoleResult = useGameStore(s => s.consoleResult);
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isConsoleOpen) {
            setTimeout(() => inputRef.current?.focus(), 10);
        } else {
            setInput('');
        }
    }, [isConsoleOpen]);

    if (!isConsoleOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onCommand(input.trim());
            setInput('');
        }
    };

    return (
        <div className="absolute top-0 left-0 w-full flex flex-col items-center pt-10 z-[1000] pointer-events-none">
            <form 
                onSubmit={handleSubmit}
                className="w-[600px] bg-black/80 border-2 border-red-900/50 p-2 pointer-events-auto"
            >
                <div className="flex items-center gap-2">
                    <span className="text-red-500 font-mono font-bold text-xl">{'>'}</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Enter command (e.g. /debug)"
                        className="flex-1 bg-transparent border-none outline-none text-white font-mono text-lg placeholder:text-white/30"
                    />
                </div>
            </form>
            {consoleResult && (
                <div className="w-[600px] mt-1 bg-black/60 border border-stone-800/50 p-2 pointer-events-none animate-[fadeIn_0.2s_ease-out]">
                    <p className="text-stone-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                        {consoleResult}
                    </p>
                </div>
            )}
        </div>
    );
};
