import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { SoundManager } from '../../managers/SoundManager';

describe('SoundManager', () => {
    let manager: SoundManager;
    let soundA: BABYLON.Sound;
    let soundB: BABYLON.Sound;

    beforeEach(() => {
        const scene = new BABYLON.Scene(new BABYLON.NullEngine());
        manager = new SoundManager(scene);

        soundA = {
            isPlaying: true,
            pause: vi.fn(function(this: BABYLON.Sound) {
                (this as any).isPlaying = false;
            }),
            play: vi.fn(function(this: BABYLON.Sound) {
                (this as any).isPlaying = true;
            }),
            stop: vi.fn(),
        } as unknown as BABYLON.Sound;

        soundB = {
            isPlaying: false,
            pause: vi.fn(),
            play: vi.fn(function(this: BABYLON.Sound) {
                (this as any).isPlaying = true;
            }),
            stop: vi.fn(),
        } as unknown as BABYLON.Sound;

        (manager as any).sounds.set('zombie_spawn', soundA);
        (manager as any).sounds.set('power', soundB);
    });

    it('pauses and resumes only sounds that were active at pause time', () => {
        manager.pauseAll();

        expect(soundA.pause).toHaveBeenCalledTimes(1);
        expect(soundB.pause).not.toHaveBeenCalled();

        manager.resumeAll();

        expect(soundA.play).toHaveBeenCalledTimes(1);
        expect(soundB.play).not.toHaveBeenCalled();
    });
});
