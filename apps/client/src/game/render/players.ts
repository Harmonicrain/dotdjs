import * as THREE from 'three';
import type { PlayerSnapshot } from '@dotd/protocol';

/** Classic four-player colours, by player id. */
export const PLAYER_COLORS = ['#e8e8e8', '#4f8cff', '#f2c14e', '#5fd068'] as const;
export const playerColor = (id: number): string => PLAYER_COLORS[(id - 1) % PLAYER_COLORS.length]!;

const geometry = {
  torso: new THREE.BoxGeometry(0.46, 0.6, 0.26),
  head: new THREE.BoxGeometry(0.24, 0.26, 0.24),
  helmet: new THREE.BoxGeometry(0.29, 0.1, 0.29),
  leg: new THREE.BoxGeometry(0.16, 0.85, 0.16).translate(0, -0.42, 0),
  arm: new THREE.BoxGeometry(0.1, 0.55, 0.1).translate(0, -0.27, 0),
  gun: new THREE.BoxGeometry(0.06, 0.08, 0.6),
};
const skin = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.8 });
const olive = new THREE.MeshStandardMaterial({ color: 0x4a5236, roughness: 0.9 });
const trousers = new THREE.MeshStandardMaterial({ color: 0x353a2c, roughness: 0.95 });
const gunMetal = new THREE.MeshStandardMaterial({
  color: 0x24262a,
  roughness: 0.5,
  metalness: 0.6,
});

interface PlayerView {
  root: THREE.Group;
  body: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armPivot: THREE.Group;
  label: THREE.Sprite;
  jacket: THREE.MeshStandardMaterial;
  phase: number;
  lastPos: THREE.Vector3;
  name: string;
}

function nameLabel(name: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '600 34px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(name, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, fog: false }),
  );
  sprite.scale.set(1.2, 0.3, 1);
  sprite.position.y = 2.15;
  sprite.renderOrder = 10;
  return sprite;
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

function buildPlayer(id: number, name: string): PlayerView {
  const color = playerColor(id);
  const jacket = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color(0x4a5236), 0.55),
    roughness: 0.85,
  });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = mesh(geometry.torso, jacket);
  torso.position.y = 1.2;
  const head = mesh(geometry.head, skin);
  head.position.y = 1.64;
  const helmet = mesh(geometry.helmet, olive);
  helmet.position.y = 1.78;
  body.add(torso, head, helmet);

  const leg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.88, 0);
    pivot.add(mesh(geometry.leg, trousers));
    body.add(pivot);
    return pivot;
  };
  const legL = leg(-0.11);
  const legR = leg(0.11);

  // Arms and gun pivot together at the shoulders so they follow the player's pitch.
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 1.42, 0);
  const armL = mesh(geometry.arm, jacket);
  armL.position.set(-0.22, 0, -0.05);
  armL.rotation.set(1.3, 0, 0.5);
  const armR = mesh(geometry.arm, jacket);
  armR.position.set(0.24, 0, 0);
  armR.rotation.set(1.2, 0, -0.2);
  const gun = mesh(geometry.gun, gunMetal);
  gun.position.set(0.08, -0.12, -0.45);
  armPivot.add(armL, armR, gun);
  body.add(armPivot);

  const label = nameLabel(name, color);
  root.add(label);

  return {
    root,
    body,
    legL,
    legR,
    armPivot,
    label,
    jacket,
    phase: 0,
    lastPos: new THREE.Vector3(),
    name,
  };
}

function disposePlayer(view: PlayerView): void {
  view.jacket.dispose();
  view.label.material.map?.dispose();
  view.label.material.dispose();
}

/** Draws the other players from interpolated snapshots. */
export class PlayerRenderer {
  private readonly views = new Map<number, PlayerView>();
  private readonly group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group.name = 'players';
    scene.add(this.group);
  }

  sync(
    players: PlayerSnapshot[],
    names: ReadonlyMap<number, string>,
    localId: number,
    dt: number,
  ): void {
    const seen = new Set<number>();
    for (const p of players) {
      if (p.id === localId) continue;
      seen.add(p.id);
      const name = names.get(p.id) ?? `Player ${p.id}`;
      let view = this.views.get(p.id);
      if (view && view.name !== name) {
        this.remove(p.id, view);
        view = undefined;
      }
      if (!view) {
        view = buildPlayer(p.id, name);
        view.lastPos.set(p.pos.x, p.pos.y, p.pos.z);
        this.views.set(p.id, view);
        this.group.add(view.root);
      }
      this.animate(view, p, dt);
    }
    for (const [id, view] of this.views) if (!seen.has(id)) this.remove(id, view);
  }

  dispose(): void {
    for (const [id, view] of this.views) this.remove(id, view);
    this.group.removeFromParent();
  }

  private remove(id: number, view: PlayerView): void {
    this.group.remove(view.root);
    disposePlayer(view);
    this.views.delete(id);
  }

  private animate(view: PlayerView, p: PlayerSnapshot, dt: number): void {
    view.root.position.set(p.pos.x, p.pos.y, p.pos.z);
    view.root.rotation.y = p.yaw;

    const moved = Math.hypot(p.pos.x - view.lastPos.x, p.pos.z - view.lastPos.z);
    const speed = dt > 0 ? moved / dt : 0;
    view.lastPos.set(p.pos.x, p.pos.y, p.pos.z);
    view.phase += dt * Math.min(12, speed * 2.2);
    const swing = speed > 0.3 ? Math.sin(view.phase) * 0.6 : 0;
    view.legL.rotation.x = swing;
    view.legR.rotation.x = -swing;
    view.armPivot.rotation.x = p.sprinting ? -0.6 : p.pitch;

    const dead = p.life === 'dead';
    view.body.rotation.x = dead ? Math.PI / 2 : 0;
    view.body.position.set(0, dead ? 0.15 : 0, 0);
    view.label.material.opacity = dead ? 0.5 : 1;
  }
}
