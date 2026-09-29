
import * as BABYLON from '@babylonjs/core';

/**
 * ResourceManager
 *
 * Caches shared Babylon.js materials and textures by name/URL so that
 * multiple systems can request the same asset without creating duplicates.
 * Also provides `scheduleDispose` for fire-and-forget cleanup of transient
 * visual objects such as particle systems.
 *
 * Lifecycle: one instance lives for the duration of the Babylon scene.
 * Call `dispose()` when tearing down the engine to release GPU memory.
 */
export class ResourceManager {
    private materials = new Map<string, BABYLON.Material>();
    private textures  = new Map<string, BABYLON.Texture>();

    constructor(private scene: BABYLON.Scene) {}

    /**
     * Returns the cached material for `name`, creating it via `factory` on
     * first access. Subsequent calls with the same name return the existing
     * instance regardless of the factory provided.
     */
    public getMaterial<T extends BABYLON.Material>(name: string, factory: () => T): T {
        if (!this.materials.has(name)) {
            const mat = factory();
            mat.name = name;
            this.materials.set(name, mat);
        }
        return this.materials.get(name) as T;
    }

    /**
     * Removes and disposes of the cached material by name.
     */
    public removeMaterial(name: string): void {
        const mat = this.materials.get(name);
        if (mat) {
            mat.dispose();
            this.materials.delete(name);
        }
    }

    /**
     * Removes and disposes of the cached texture by URL.
     */
    public removeTexture(url: string): void {
        const tex = this.textures.get(url);
        if (tex) {
            tex.dispose();
            this.textures.delete(url);
        }
    }

    /**
     * Returns the cached `Texture` for `url`, loading it from the network on
     * first access. If the texture is already cached but still loading, the
     * existing instance is returned — Babylon materials auto-update when
     * their textures become ready, and GameLifecycle's texture-ready wait
     * ensures everything is loaded before gameplay begins.
     */
    public getTexture(url: string, factory?: () => BABYLON.Texture): BABYLON.Texture {
        const cached = this.textures.get(url);
        if (cached) {
            return cached;
        }

        const tex = factory ? factory() : new BABYLON.Texture(url, this.scene);

        // Cache immediately to prevent duplicate creations from concurrent calls
        this.textures.set(url, tex);

        return tex;
    }

    /**
     * Pre-loads a texture into the cache and returns a promise that resolves
     * when the texture is fully loaded.
     */
    public async preWarmTexture(url: string): Promise<BABYLON.Texture> {
        if (this.textures.has(url)) return this.textures.get(url)!;
        
        return new Promise((resolve, reject) => {
            const tex = new BABYLON.Texture(url, this.scene, {
                onLoad: () => {
                    this.textures.set(url, tex);
                    resolve(tex);
                },
                onError: (msg) => reject(new Error(msg))
            });
        });
    }

    /**
     * Disposes `obj` after `delayMs` milliseconds using `setTimeout`.
     *
     * `setTimeout` is intentional here — transient visual effects (finished
     * particle systems, etc.) don't need to synchronise with the game loop or
     * pause state, and using a timer avoids modifying live arrays mid-frame.
     */
    public scheduleDispose(obj: BABYLON.IDisposable, delayMs: number): void {
        setTimeout(() => {
            try { obj.dispose(); } catch { /* already disposed — safe to ignore */ }
        }, delayMs);
    }

    /**
     * Between-game cleanup. The cache intentionally persists across sessions —
     * materials and textures are expensive to recreate and safe to reuse as
     * long as the Babylon scene is the same.  This is a no-op by design.
     */
    public reset(): void {
        // Cache survives between games — see class docstring.
    }

    /** Releases all cached materials and textures. Call once on engine teardown. */
    public dispose(): void {
        this.materials.forEach(m => m.dispose());
        this.materials.clear();
        this.textures.forEach(t => t.dispose());
        this.textures.clear();
    }
}
