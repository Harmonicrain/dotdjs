import * as BABYLON from '@babylonjs/core';

export type SoundCategory = 'weapon' | 'zombie' | 'effects';

/** Maps sound names to their category for volume control. */
const SOUND_CATEGORIES: Record<string, SoundCategory> = {
    M1911: 'weapon',
    zombie_spawn: 'zombie',
    power: 'effects',
    instakill: 'effects',
    nuke: 'effects',
};

export class SoundManager {
    private sounds: Map<string, BABYLON.Sound> = new Map();
    private activeSoundCounts: Map<string, number> = new Map();
    private pausedSoundNames = new Set<string>();
    private scene: BABYLON.Scene;
    private audioInitialized = false;

    /** Category volume multipliers (0-1), applied on top of master volume. */
    private categoryVolumes: Record<SoundCategory, number> = {
        weapon: 1.0,
        zombie: 1.0,
        effects: 1.0,
    };
    private masterVolume = 1.0;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    private async initAudio() {
        if (this.audioInitialized) return;

        // If no audio engine, don't bother trying
        if (!BABYLON.Engine.audioEngine) {
            this.audioInitialized = true;
            return;
        }

        try {
            // Resume audio context if suspended (handles browser autoplay policies)
            const ctx = BABYLON.Engine.audioEngine.audioContext;
            if (ctx?.state === 'suspended') {
                await ctx.resume();
            }

            // Unlock the audio engine (required for mobile/browsers with autoplay policies)
            await BABYLON.Engine.audioEngine.unlock();
            this.audioInitialized = true;
        } catch (e) {
            // Silently fail - audio is non-critical
            this.audioInitialized = true;
        }
    }

    /** Register a sound name to a category so volume settings apply automatically. */
    public registerSoundCategory(name: string, category: SoundCategory) {
        SOUND_CATEGORIES[name] = category;
    }

    /** Get the effective volume for a sound, factoring in master and category volumes. */
    private getEffectiveVolume(name: string, baseVolume: number): number {
        const category = SOUND_CATEGORIES[name];
        const categoryMul = category ? this.categoryVolumes[category] : 1.0;
        return baseVolume * this.masterVolume * categoryMul;
    }

    /** Update master volume (0-1). Applied via Babylon audio engine master gain. */
    public setMasterVolume(volume: number) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (BABYLON.Engine.audioEngine && BABYLON.Engine.audioEngine.masterGain) {
            BABYLON.Engine.audioEngine.masterGain.gain.value = this.masterVolume;
        }
    }

    /** Update volume for a sound category (0-1). */
    public setCategoryVolume(category: SoundCategory, volume: number) {
        this.categoryVolumes[category] = Math.max(0, Math.min(1, volume));
    }

    public async loadSound(name: string, url: string): Promise<BABYLON.Sound> {
        await this.initAudio();

        return new Promise((resolve, reject) => {
            try {
                const sound = new BABYLON.Sound(name, url, this.scene,
                    () => {
                        this.sounds.set(name, sound);
                        resolve(sound);
                    }
                );
            } catch (e) {
                console.error(`[SoundManager] Exception loading sound ${name}:`, e);
                reject(e);
            }
        });
    }

    public async play(name: string, options?: { volume?: number; loop?: boolean; rate?: number }) {
        await this.initAudio();

        const sound = this.sounds.get(name);
        if (sound) {
            const baseVol = options?.volume ?? 1.0;
            sound.setVolume(this.getEffectiveVolume(name, baseVol));
            if (options?.loop !== undefined) sound.loop = options.loop;
            if (options?.rate !== undefined) sound.setPlaybackRate(options.rate);
            sound.play();
        }
    }

    public async playWithLimit(name: string, maxConcurrent: number, options?: { volume?: number; loop?: boolean; rate?: number }) {
        await this.initAudio();

        const sound = this.sounds.get(name);
        if (!sound) {
            return;
        }

        const currentCount = this.activeSoundCounts.get(name) || 0;
        if (currentCount >= maxConcurrent) {
            return;
        }

        this.activeSoundCounts.set(name, currentCount + 1);

        try {
            const baseVol = options?.volume ?? 1.0;
            sound.setVolume(this.getEffectiveVolume(name, baseVol));
            if (options?.loop !== undefined) sound.loop = options.loop;
            if (options?.rate !== undefined) sound.setPlaybackRate(options.rate);

            sound.play();

            sound.onEndedObservable.addOnce(() => {
                const count = this.activeSoundCounts.get(name) || 1;
                this.activeSoundCounts.set(name, Math.max(0, count - 1));
            });
        } catch {
            const count = this.activeSoundCounts.get(name) || 1;
            this.activeSoundCounts.set(name, Math.max(0, count - 1));
        }
    }

    public stop(name: string) {
        const sound = this.sounds.get(name);
        if (sound) sound.stop();
    }

    public isPlaying(name: string): boolean {
        const sound = this.sounds.get(name);
        return sound ? sound.isPlaying : false;
    }

    public setVolume(name: string, volume: number) {
        const sound = this.sounds.get(name);
        if (sound) sound.setVolume(volume);
    }

    public getSound(name: string): BABYLON.Sound | undefined {
        return this.sounds.get(name);
    }

    public pauseAll() {
        this.pausedSoundNames.clear();
        this.sounds.forEach((sound, name) => {
            if (!sound.isPlaying) return;
            sound.pause();
            this.pausedSoundNames.add(name);
        });
    }

    public resumeAll() {
        this.pausedSoundNames.forEach((name) => {
            const sound = this.sounds.get(name);
            if (!sound) return;
            sound.play();
        });
        this.pausedSoundNames.clear();
    }

    public stopAll() {
        this.sounds.forEach(s => s.stop());
        this.activeSoundCounts.clear();
        this.pausedSoundNames.clear();
    }

    /** Between-game cleanup — stops all active sounds but keeps loaded assets. */
    public reset() {
        this.stopAll();
    }

    /** Full teardown — disposes all sound instances and releases references. */
    public dispose() {
        this.stopAll();
        this.sounds.forEach(s => s.dispose());
        this.sounds.clear();
        this.activeSoundCounts.clear();
        this.pausedSoundNames.clear();
    }
}
