
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AmmoCounter } from './AmmoCounter';
import { useGameStore } from '../../store/useGameStore';
import React from 'react';

// Mock the store
vi.mock('../../store/useGameStore', () => ({
    useGameStore: vi.fn()
}));

describe('AmmoCounter', () => {
    it('should render ammo and reserve counts', () => {
        (useGameStore as any).mockImplementation((selector: any) => {
            const state = {
                weaponName: 'Pistol',
                ammo: 15,
                reserveAmmo: 45,
                maxClip: 15
            };
            return selector(state);
        });

        render(<AmmoCounter />);
        
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('Pistol')).toBeInTheDocument();
    });

    it('should show RELOAD prompt when empty', () => {
        (useGameStore as any).mockImplementation((selector: any) => {
            const state = {
                weaponName: 'Pistol',
                ammo: 0,
                reserveAmmo: 45,
                maxClip: 15
            };
            return selector(state);
        });

        render(<AmmoCounter />);
        
        expect(screen.getByText('RELOAD')).toBeInTheDocument();
    });

    it('should NOT show RELOAD prompt when empty but no reserve', () => {
        (useGameStore as any).mockImplementation((selector: any) => {
            const state = {
                weaponName: 'Pistol',
                ammo: 0,
                reserveAmmo: 0,
                maxClip: 15
            };
            return selector(state);
        });

        render(<AmmoCounter />);
        
        expect(screen.queryByText('RELOAD')).not.toBeInTheDocument();
    });
});
