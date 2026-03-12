
import { describe, it, expect } from 'vitest';
import { frameIndependentLerp } from '../../engine/MathUtils';

describe('MathUtils', () => {
    describe('frameIndependentLerp', () => {
        it('should return correct factor for 60fps (dt = 1/60)', () => {
            const baseFactor = 0.1;
            const dt = 1 / 60;
            const result = frameIndependentLerp(baseFactor, dt);
            expect(result).toBeCloseTo(baseFactor);
        });

        it('should return 0 when baseFactor is 0', () => {
            expect(frameIndependentLerp(0, 0.016)).toBe(0);
        });

        it('should return 1 when baseFactor is 1', () => {
            expect(frameIndependentLerp(1, 0.016)).toBe(1);
        });

        it('should adjust factor for higher frame rates (lower dt)', () => {
            const baseFactor = 0.1;
            const dt = 1 / 120;
            const result = frameIndependentLerp(baseFactor, dt);
            // At 120fps, we need two frames to equal one 60fps frame.
            // 1 - (1-result)^2 should be approx baseFactor
            expect(1 - Math.pow(1 - result, 2)).toBeCloseTo(baseFactor);
        });
    });
});
