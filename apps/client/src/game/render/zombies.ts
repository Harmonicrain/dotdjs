import * as THREE from 'three';
import { ZOMBIE } from '@dotd/sim';
import type { ZombieSnapshot } from '@dotd/protocol';

const SKIN = 0x6f7d5c;
const SHIRT = 0x4d3b33;
const PANTS = 0x2b313a;
const EYES = 0xffa42e;

const RUN_SPEED = 3.6;
const HIT_FLASH_SECONDS = 0.09;
const DEATH_FALL_SECONDS = 0.45;

/** Shared geometry: every zombie is built from these few boxes. */
const geometry = {
  torso: new THREE.BoxGeometry(0.44, 0.56, 0.26),
  pelvis: new THREE.BoxGeometry(0.4, 0.2, 0.24),
  head: new THREE.BoxGeometry(0.27, 0.3, 0.27),
  jaw: new THREE.BoxGeometry(0.2, 0.07, 0.18),
  eye: new THREE.BoxGeometry(0.055, 0.035, 0.02),
  arm: new THREE.BoxGeometry(0.11, 0.6, 0.11).translate(0, -0.3, 0),
  leg: new THREE.BoxGeometry(0.15, 0.82, 0.15).translate(0, -0.41, 0),
};
const eyeMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(EYES).multiplyScalar(3) });

interface ZombieView {
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  head: THREE.Object3D;
  materials: THREE.MeshStandardMaterial[];
  phase: number;
  flash: number;
  deathTime: number;
  seenAlive: boolean;
  /** Per-zombie variation so the horde doesn't move in lockstep. */
  quirk: number;
}

function part(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function buildZombie(quirk: number): ZombieView {
  const tint = 0.85 + quirk * 0.3;
  const skin = new THREE.MeshStandardMaterial({
    color: new THREE.Color(SKIN).multiplyScalar(tint),
    roughness: 0.9,
  });
  const shirt = new THREE.MeshStandardMaterial({
    color: new THREE.Color(SHIRT).multiplyScalar(tint),
    roughness: 0.95,
  });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS, roughness: 0.95 });

  const root = new THREE.Group();
  const body = new THREE.Group(); // leans and falls as one
  root.add(body);

  body.add(part(geometry.pelvis, pants, 0, 0.92, 0));
  // Models face -Z. A negative X rotation tips things forward (towards -Z).
  const torso = part(geometry.torso, shirt, 0, 1.24, -0.03);
  torso.rotation.x = -0.22; // hunched
  body.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 1.58, -0.1);
  head.add(part(geometry.head, skin, 0, 0.04, 0));
  const jaw = part(geometry.jaw, skin, 0, -0.14, -0.03);
  jaw.rotation.x = -0.25;
  head.add(jaw);
  head.add(part(geometry.eye, eyeMaterial, -0.065, 0.06, -0.136));
  head.add(part(geometry.eye, eyeMaterial, 0.065, 0.06, -0.136));
  body.add(head);

  const limb = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(part(geo, mat, 0, 0, 0));
    body.add(pivot);
    return pivot;
  };
  const armL = limb(geometry.arm, skin, -0.29, 1.47);
  const armR = limb(geometry.arm, skin, 0.29, 1.47);
  const legL = limb(geometry.leg, pants, -0.11, 0.86);
  const legR = limb(geometry.leg, pants, 0.11, 0.86);

  return {
    root,
    body,
    armL,
    armR,
    legL,
    legR,
    head,
    materials: [skin, shirt, pants],
    phase: quirk * 10,
    flash: 0,
    deathTime: 0,
    seenAlive: false,
    quirk,
  };
}

function disposeZombie(view: ZombieView): void {
  for (const m of view.materials) m.dispose();
}

/** Draws zombies from interpolated snapshots and animates them procedurally. */
export class ZombieRenderer {
  private readonly views = new Map<number, ZombieView>();
  private readonly group = new THREE.Group();

  /** Called when a zombie first appears rising out of the ground. */
  onEmerge: (pos: THREE.Vector3) => void = () => {};

  constructor(scene: THREE.Scene) {
    this.group.name = 'zombies';
    scene.add(this.group);
  }

  sync(zombies: ZombieSnapshot[], dt: number, time: number): void {
    const seen = new Set<number>();
    for (const z of zombies) {
      seen.add(z.id);
      let view = this.views.get(z.id);
      if (!view) {
        view = buildZombie((((z.id * 0.618) % 1) + 1) % 1);
        this.views.set(z.id, view);
        this.group.add(view.root);
        if (z.mode === 'rising') this.onEmerge(new THREE.Vector3(z.pos.x, 0, z.pos.z));
      }
      this.animate(view, z, dt, time);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      this.group.remove(view.root);
      disposeZombie(view);
      this.views.delete(id);
    }
  }

  /** Brief white-hot flash when a zombie is hit. */
  flash(id: number): void {
    const view = this.views.get(id);
    if (view) view.flash = HIT_FLASH_SECONDS;
  }

  dispose(): void {
    for (const view of this.views.values()) disposeZombie(view);
    this.views.clear();
    this.group.removeFromParent();
  }

  private animate(view: ZombieView, z: ZombieSnapshot, dt: number, time: number): void {
    view.root.position.set(z.pos.x, z.pos.y, z.pos.z);
    // Models face -Z; yaw 0 also faces -Z.
    view.root.rotation.y = z.yaw;

    const running = z.speed >= RUN_SPEED;
    const stride = running ? 0.9 : 0.55;
    view.phase += dt * (running ? 9 : 5.5) * (0.9 + view.quirk * 0.2);
    const swing = Math.sin(view.phase);

    // Defaults: shambling walk with arms reaching forward.
    view.body.rotation.set(running ? -0.3 : -0.12, 0, Math.sin(view.phase * 0.5) * 0.05);
    view.body.position.set(0, 0, 0);
    view.legL.rotation.x = swing * stride;
    view.legR.rotation.x = -swing * stride;
    // Hanging limbs point down; a positive X rotation swings them forward.
    const reach = 1.35 + Math.sin(time * 2 + view.quirk * 6) * 0.08;
    view.armL.rotation.set(reach + swing * 0.12, 0, 0.08);
    view.armR.rotation.set(reach - swing * 0.12 + 0.15 * view.quirk, 0, -0.08);
    view.head.rotation.set(
      -0.1 + Math.sin(view.phase * 0.5) * 0.08,
      0,
      Math.sin(time * 1.3 + view.quirk) * 0.15,
    );

    switch (z.mode) {
      case 'rising': {
        view.body.rotation.x = 0.35; // clawing up, leaning back
        view.armL.rotation.set(2.6 + swing * 0.3, 0, 0.3);
        view.armR.rotation.set(2.6 - swing * 0.3, 0, -0.3);
        view.legL.rotation.x = view.legR.rotation.x = 0;
        break;
      }
      case 'attacking': {
        const slash = (Math.sin(time * 9 + view.quirk) + 1) / 2;
        view.armL.rotation.set(2.2 - slash * 1.8, 0, 0.2);
        view.armR.rotation.set(0.4 + slash * 1.8, 0, -0.2);
        view.legL.rotation.x = view.legR.rotation.x = 0.05;
        view.body.rotation.x = -0.35;
        break;
      }
      case 'dead': {
        view.deathTime += dt;
        const fall = Math.min(1, view.deathTime / DEATH_FALL_SECONDS);
        const eased = fall * fall;
        view.body.rotation.x = (view.quirk < 0.5 ? -1 : 1) * eased * (Math.PI / 2 - 0.1);
        view.body.position.y = 0.15 * eased;
        view.body.position.y -= Math.max(0, view.deathTime - ZOMBIE.corpseDuration + 0.6) * 0.8;
        view.legL.rotation.x = view.legR.rotation.x = 0.2 * eased;
        view.armL.rotation.x = view.armR.rotation.x = 2.8 * eased;
        break;
      }
      case 'chasing':
        break;
    }

    view.flash = Math.max(0, view.flash - dt);
    const glow = view.flash > 0 ? 1.6 : 0;
    for (const m of view.materials) m.emissive.setRGB(glow, glow * 0.85, glow * 0.7);
  }
}
