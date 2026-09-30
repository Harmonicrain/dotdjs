import * as THREE from 'three';
import type { LevelDef } from '@dotd/sim';
import { Effects } from './effects';
import { buildLevel } from './level';
import type { LevelView } from './level';
import { PlayerRenderer } from './players';
import { ViewModel } from './viewModel';
import { ZombieRenderer } from './zombies';

export interface CameraFrame {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  /** Vertical field of view in degrees. */
  fov: number;
}

export interface RendererSettings {
  /** 0.5..1: render below native resolution for speed. */
  resolutionScale: number;
  shadows: boolean;
}

/**
 * Owns the three.js renderer and everything drawn: level, zombies, other players, effects and
 * the first-person weapon (drawn as a second pass so it never clips into walls).
 */
export class WorldRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 250);
  readonly zombies: ZombieRenderer;
  readonly players: PlayerRenderer;
  readonly effects: Effects;
  readonly viewModel = new ViewModel();
  private readonly level: LevelView;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    levelDef: LevelDef,
    private settings: RendererSettings,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.6;
    this.renderer.shadowMap.enabled = settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = false;

    this.camera.rotation.order = 'YXZ';
    this.level = buildLevel(levelDef, this.scene, this.renderer.capabilities.getMaxAnisotropy());
    this.zombies = new ZombieRenderer(this.scene);
    this.players = new PlayerRenderer(this.scene);
    this.effects = new Effects(this.scene);
    this.zombies.onEmerge = (pos) => this.effects.dirt(pos);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  updateSettings(settings: RendererSettings): void {
    this.settings = settings;
    this.renderer.shadowMap.enabled = settings.shadows;
    this.resize();
  }

  resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 2) * this.settings.resolutionScale;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.viewModel.resize(width / height);
    this.effects.setViewportHeight(height * pixelRatio);
  }

  render(frame: CameraFrame, time: number, dt: number): void {
    this.camera.position.copy(frame.position);
    this.camera.rotation.set(frame.pitch, frame.yaw, frame.roll);
    if (Math.abs(this.camera.fov - frame.fov) > 0.01) {
      this.camera.fov = frame.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    this.level.update(time);
    this.effects.update(dt);

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewModel.scene, this.viewModel.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.zombies.dispose();
    this.players.dispose();
    this.effects.dispose();
    this.viewModel.dispose();
    this.level.dispose();
    this.renderer.dispose();
  }
}
