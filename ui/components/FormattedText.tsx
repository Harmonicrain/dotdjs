
import React from 'react';
import { PointsIcon } from './PlayerStatus';

const INPUT_SYMBOLS = new Set([
    'F', 'R', 'V', 'C', 'E', 'Q', 'G', 'W', 'A', 'S', 'D',
    '1', '2', '3', '4', 'TAB', 'SHIFT', 'SPACE', 'RMB', 'LMB', '`',
    'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
    'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'LS', 'RS',
    'START', 'SELECT', 'BACK',
]);

export const FormattedText = ({ text }: { text: string }) => {
    const parts = text.split(/(\[.*?\])/);
    return (
        <span className="flex items-center">
            {parts.map((part, i) => {
                if (part.startsWith('[') && part.endsWith(']')) {
                    const content = part.slice(1, -1);
                    const isNumber = !isNaN(Number(content));
                    const isInput = INPUT_SYMBOLS.has(content.toUpperCase());
                    
                    if (isInput) {
                        return (
                            <span
                                key={i}
                                className="inline-flex items-center justify-center mx-1 px-1.5 py-0.5 min-w-[1.5em] text-xs font-bold uppercase rounded border border-stone-500 bg-stone-800 text-stone-100"
                            >
                                {content}
                            </span>
                        );
                    }

                    return (
                        <span key={i} className="text-amber-500 font-bold ml-1.5 mr-1 opacity-90 inline-flex items-center">
                            {isNumber && <PointsIcon className="w-4 h-4 mr-1" />}
                            {content}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>
            })}
        </span>
    );
};
