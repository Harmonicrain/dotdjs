
/**
 * Computes a frame-rate independent lerp factor.
 * 
 * @param baseFactor The lerp factor targeting 60fps (e.g., 0.1 for 10% per frame at 60fps)
 * @param dt Delta time in seconds
 * @returns The adjusted lerp factor for the current frame's dt
 */
export const frameIndependentLerp = (baseFactor: number, dt: number): number => {
    return 1 - Math.pow(1 - baseFactor, dt * 60);
};
