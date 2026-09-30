import * as THREE from 'three';
import { WEAPONS } from '@dotd/sim';
import type { WeaponId } from '@dotd/sim';
import { createGlowTexture } from './textures';
import { buildWeaponModel, disposeWeaponModel } from './weaponModels';
import type { WeaponModel } from './weaponModels';

export interface ViewModelFrame {
  dt: number;
  weaponId: WeaponId;
  aiming: boolean;
  sprinting: boolean;
  grounded: boolean;
  /** Horizontal speed in m/s, drives the walk bob. */
  speed: number;
  /** 0..1 through the current reload, or null. */
  reloadProgress: number | null;
  /** 1 when a weapon has just been drawn, easing to 0 when ready. */
  drawRemaining: number;
  /** Look movement this frame, in radians, for weapon sway. */
  lookDelta: { yaw: number; pitch: number };
}

const ADS_SPEED = 9;
const ADS_DEPTH = -0.26;
const FLASH_SECONDS = 0.05;

/** The first-person weapon, drawn in its own scene over the world so it never clips into walls. */
export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
  private model: WeaponModel | null = null;
  private weaponId: WeaponId | null = null;
  private readonly rig = new THREE.Group();
  private readonly flash: THREE.Sprite;
  private readonly flashLight = new THREE.PointLight(0xffb45a, 0, 3, 2);
  private adsBlend = 0;
  private bobPhase = 0;
  private readonly sway = new THREE.Vector2();
  private kick = 0;
  private kickVelocity = 0;
  private flashTimer = 0;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0x9aaacc, 0x2a2018, 2.4));
    const key = new THREE.DirectionalLight(0xffe0c0, 2.6);
    key.position.set(1, 2, 1);
    this.scene.add(key, this.rig, this.flashLight);

    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createGlowTexture('rgba(255,236,170,1)', 'rgba(255,120,30,0)'),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.flash.visible = false;
  }

  /** How far the weapon is raised to the sights, 0 (hip) to 1 (aiming). */
  get aimAmount(): number {
    return this.adsBlend;
  }

  /** Kicks the weapon back and flashes the muzzle. */
  fire(weaponId: WeaponId): void {
    const recoil = WEAPONS[weaponId].recoil;
    this.kickVelocity += 1.4 + recoil.pitch[1] * 20;
    this.flashTimer = FLASH_SECONDS;
    this.flash.material.rotation = Math.random() * Math.PI * 2;
  }

  /** World-space position of the muzzle given the main camera, for tracers. */
  muzzleWorldPosition(mainCamera: THREE.Camera, out: THREE.Vector3): THREE.Vector3 {
    if (!this.model) return out.copy(mainCamera.position);
    this.rig.updateMatrixWorld(true);
    this.model.muzzle.getWorldPosition(out); // in view space
    return out.applyMatrix4(mainCamera.matrixWorld);
  }

  update(frame: ViewModelFrame): void {
    const { dt } = frame;
    if (frame.weaponId !== this.weaponId) this.equip(frame.weaponId);
    const model = this.model!;

    const aimTarget = frame.aiming && frame.reloadProgress === null && !frame.sprinting ? 1 : 0;
    this.adsBlend += (aimTarget - this.adsBlend) * Math.min(1, ADS_SPEED * dt);
    const hipWeight = 1 - this.adsBlend;

    // Walk bob, much subtler while aiming.
    const moving = frame.grounded && frame.speed > 0.5;
    this.bobPhase += dt * (moving ? frame.speed * (frame.sprinting ? 2.1 : 2.4) : 0);
    const bobAmount = (moving ? Math.min(1, frame.speed / 4.5) : 0) * (0.2 + 0.8 * hipWeight);
    const bobX = Math.sin(this.bobPhase) * 0.012 * bobAmount;
    const bobY = -Math.abs(Math.cos(this.bobPhase)) * 0.012 * bobAmount;

    // Sway lags behind the view, then springs back.
    this.sway.x += (-frame.lookDelta.yaw * 0.35 - this.sway.x) * Math.min(1, 10 * dt);
    this.sway.y += (frame.lookDelta.pitch * 0.35 - this.sway.y) * Math.min(1, 10 * dt);

    // Recoil kick: a damped spring.
    this.kickVelocity += (-this.kick * 220 - this.kickVelocity * 22) * dt;
    this.kick += this.kickVelocity * dt;
    const kick = this.kick * (0.35 + 0.65 * hipWeight);

    const hip = model.hip;
    const pos = new THREE.Vector3(
      hip.x * hipWeight + bobX,
      THREE.MathUtils.lerp(hip.y, -model.sightHeight, this.adsBlend) + bobY,
      THREE.MathUtils.lerp(hip.z, ADS_DEPTH, this.adsBlend) + kick * 0.05,
    );
    const rot = new THREE.Euler(kick * 0.08 + this.sway.y, this.sway.x, bobX * 1.5, 'YXZ');

    if (frame.sprinting) {
      pos.add(new THREE.Vector3(-0.04, -0.05, 0.02));
      rot.x -= 0.35;
      rot.y += 0.6;
      rot.z += 0.25;
    }
    if (frame.reloadProgress !== null) {
      // Dip down and tilt, hold, then come back up.
      const p = frame.reloadProgress;
      const dip = Math.min(1, p / 0.2, (1 - p) / 0.2);
      pos.y -= 0.09 * dip;
      rot.x -= 0.45 * dip;
      rot.z += 0.5 * dip;
    }
    if (frame.drawRemaining > 0) {
      pos.y -= 0.25 * frame.drawRemaining;
      rot.x -= 0.6 * frame.drawRemaining;
    }

    this.rig.position.copy(pos);
    this.rig.rotation.copy(rot);

    this.flashTimer -= dt;
    const flashing = this.flashTimer > 0;
    this.flash.visible = flashing;
    this.flash.scale.setScalar(0.09 + Math.random() * 0.05);
    this.flashLight.intensity = flashing ? 2.5 : 0;
    this.flashLight.position.copy(pos).add(new THREE.Vector3(0, 0.05, -0.3));
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.model) disposeWeaponModel(this.model);
    this.flash.material.map?.dispose();
    this.flash.material.dispose();
  }

  private equip(id: WeaponId): void {
    if (this.model) {
      this.rig.remove(this.model.group);
      disposeWeaponModel(this.model);
    }
    this.model = buildWeaponModel(id);
    this.model.muzzle.add(this.flash);
    this.rig.add(this.model.group);
    this.weaponId = id;
  }
}
