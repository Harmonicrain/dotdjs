import * as BABYLON from '@babylonjs/core';

export class SoundManager {
    private sounds: Map<string, BABYLON.Sound> = new Map();
    private activeSoundCounts: Map<string, number> = new Map();
    private scene: BABYLON.Scene;
    private audioInitialized = false;

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
            console.log('[SoundManager] Audio engine ready');
            this.audioInitialized = true;
        } catch (e) {
            // Silently fail - audio is non-critical
            this.audioInitialized = true;
        }
    }

    public async loadSound(name: string, url: string): Promise<BABYLON.Sound> {
        await this.initAudio();
        
        return new Promise((resolve, reject) => {
            try {
                const sound = new BABYLON.Sound(name, url, this.scene, 
                    () => {
                        console.log(`[SoundManager] Loaded sound: ${name}`);
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
            console.log(`[SoundManager] Playing sound: ${name}`);
            if (options?.volume !== undefined) sound.setVolume(options.volume);
            if (options?.loop !== undefined) sound.loop = options.loop;
            if (options?.rate !== undefined) sound.setPlaybackRate(options.rate);
            sound.play();
        } else {
            console.warn(`[SoundManager] Sound "${name}" not found`);
        }
    }

    public async playWithLimit(name: string, maxConcurrent: number, options?: { volume?: number; loop?: boolean; rate?: number }) {
        await this.initAudio();
        
        const sound = this.sounds.get(name);
        if (!sound) {
            console.warn(`[SoundManager] Sound "${name}" not found in sounds map. Available:`, Array.from(this.sounds.keys()));
            return;
        }
        
        const currentCount = this.activeSoundCounts.get(name) || 0;
        if (currentCount >= maxConcurrent) {
            return;
        }

        this.activeSoundCounts.set(name, currentCount + 1);

        try {
            if (options?.volume !== undefined) sound.setVolume(options.volume);
            if (options?.loop !== undefined) sound.loop = options.loop;
            if (options?.rate !== undefined) sound.setPlaybackRate(options.rate);
            
            sound.play();
            console.log(`[SoundManager] Playing sound: ${name}`);
            
            sound.onEndedObservable.addOnce(() => {
                const count = this.activeSoundCounts.get(name) || 1;
                this.activeSoundCounts.set(name, Math.max(0, count - 1));
            });
        } catch (e) {
            console.error(`[SoundManager] Error playing sound ${name} with limit:`, e);
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
        if (BABYLON.Engine.audioEngine && BABYLON.Engine.audioEngine.masterGain) {
            BABYLON.Engine.audioEngine.masterGain.gain.value = 0;
            console.log('[SoundManager] All sounds paused');
        }
    }

    public resumeAll() {
        if (BABYLON.Engine.audioEngine && BABYLON.Engine.audioEngine.masterGain) {
            BABYLON.Engine.audioEngine.masterGain.gain.value = 1;
            console.log('[SoundManager] All sounds resumed');
        }
    }

    public stopAll() {
        this.sounds.forEach(s => s.stop());
        this.activeSoundCounts.clear();
        console.log('[SoundManager] All sounds stopped');
    }
}
