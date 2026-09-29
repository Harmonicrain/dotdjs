import * as THREE from 'three';
import type { WeaponId } from '@dotd/sim';

/**
 * Stylised low-poly first-person weapons built from primitives. Coordinates are in metres in
 * camera space: the gun points down -Z, the origin is where the firing hand grips it.
 */

const materials = {
  metal: new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.38, metalness: 0.75 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.5, metalness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.6, metalness: 0 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x3f4630, roughness: 0.95 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2b2320, roughness: 0.9 }),
};

type MaterialName = keyof typeof materials;

interface Part {
  shape: 'box' | 'cylinder';
  /** Box: width, height, depth. Cylinder: radius, radius, length (along Z). */
  size: [number, number, number];
  at: [number, number, number];
  rotation?: [number, number, number];
  material: MaterialName;
}

export interface WeaponModel {
  group: THREE.Group;
  /** Barrel tip, for muzzle flashes and tracers. */
  muzzle: THREE.Object3D;
  /** Height of the sight line above the grip origin. */
  sightHeight: number;
  /** Hip-fire resting position in camera space. */
  hip: THREE.Vector3;
}

const box = (size: Part['size'], at: Part['at'], material: MaterialName, rotation?: Part['rotation']): Part => ({
  shape: 'box',
  size,
  at,
  material,
  ...(rotation ? { rotation } : {}),
});

const cylinder = (radius: number, length: number, at: Part['at'], material: MaterialName): Part => ({
  shape: 'cylinder',
  size: [radius, radius, length],
  at,
  material,
});

const ARMS: Part[] = [
  box([0.075, 0.075, 0.34], [0.05, -0.11, 0.2], 'sleeve', [0.35, -0.15, 0]),
  box([0.05, 0.07, 0.075], [0, -0.035, 0.005], 'glove'),
];

function rifle(opts: {
  barrel: number;
  magazine: 'box' | 'curved' | 'none';
  stock: MaterialName;
  handguard: MaterialName;
}): { parts: Part[]; muzzleZ: number } {
  const barrelStart = -0.26;
  const muzzleZ = barrelStart - opts.barrel;
  const parts: Part[] = [
    box([0.05, 0.065, 0.32], [0, 0.025, -0.1], 'metal'),
    cylinder(0.011, opts.barrel, [0, 0.035, barrelStart - opts.barrel / 2], 'darkMetal'),
    box([0.052, 0.045, 0.22], [0, 0.02, -0.3], opts.handguard),
    box([0.045, 0.085, 0.24], [0, 0.0, 0.17], opts.stock, [-0.08, 0, 0]),
    box([0.032, 0.085, 0.038], [0, -0.045, 0.01], 'wood', [0.3, 0, 0]),
    box([0.012, 0.03, 0.012], [0, 0.07, -0.02], 'darkMetal'),
    box([0.008, 0.028, 0.008], [0, 0.068, muzzleZ + 0.03], 'darkMetal'),
    // Supporting hand and forearm under the handguard.
    box([0.06, 0.06, 0.08], [-0.005, -0.025, -0.3], 'glove'),
    box([0.075, 0.075, 0.34], [-0.1, -0.12, -0.16], 'sleeve', [0.45, 0.55, 0]),
    ...ARMS,
  ];
  if (opts.magazine === 'box') parts.push(box([0.03, 0.12, 0.05], [0, -0.06, -0.15], 'darkMetal'));
  if (opts.magazine === 'curved') parts.push(box([0.03, 0.15, 0.045], [0, -0.07, -0.16], 'darkMetal', [0.35, 0, 0]));
  return { parts, muzzleZ };
}

interface Design {
  parts: Part[];
  muzzle: [number, number, number];
  sightHeight: number;
  hip: [number, number, number];
}

function design(id: WeaponId): Design {
  switch (id) {
    case 'm1911':
      return {
        parts: [
          box([0.032, 0.03, 0.2], [0, 0.03, -0.1], 'metal'),
          box([0.03, 0.018, 0.16], [0, 0.008, -0.08], 'darkMetal'),
          box([0.03, 0.095, 0.042], [0, -0.04, -0.005], 'wood', [0.25, 0, 0]),
          box([0.006, 0.012, 0.006], [0, 0.05, -0.19], 'darkMetal'),
          box([0.02, 0.01, 0.006], [0, 0.049, -0.01], 'darkMetal'),
          // Two-handed grip.
          box([0.055, 0.065, 0.075], [-0.028, -0.045, 0.0], 'glove'),
          box([0.075, 0.075, 0.32], [-0.09, -0.12, 0.17], 'sleeve', [0.35, 0.3, 0]),
          ...ARMS,
        ],
        muzzle: [0, 0.03, -0.21],
        sightHeight: 0.056,
        hip: [0.15, -0.16, -0.36],
      };
    case 'olympia':
      return {
        parts: [
          cylinder(0.013, 0.56, [-0.013, 0.035, -0.36], 'darkMetal'),
          cylinder(0.013, 0.56, [0.013, 0.035, -0.36], 'darkMetal'),
          box([0.055, 0.055, 0.14], [0, 0.02, -0.04], 'metal'),
          box([0.05, 0.035, 0.24], [0, 0.005, -0.25], 'wood'),
          box([0.048, 0.08, 0.28], [0, -0.01, 0.16], 'wood', [-0.12, 0, 0]),
          box([0.06, 0.06, 0.08], [-0.005, -0.02, -0.26], 'glove'),
          box([0.075, 0.075, 0.34], [-0.1, -0.12, -0.13], 'sleeve', [0.45, 0.55, 0]),
          ...ARMS,
        ],
        muzzle: [0, 0.035, -0.64],
        sightHeight: 0.05,
        hip: [0.16, -0.15, -0.3],
      };
    default: {
      const spec = {
        stg44: { barrel: 0.3, magazine: 'curved', stock: 'wood', handguard: 'metal' },
        famas: { barrel: 0.22, magazine: 'box', stock: 'darkMetal', handguard: 'darkMetal' },
        fnfal: { barrel: 0.36, magazine: 'box', stock: 'darkMetal', handguard: 'darkMetal' },
        garand: { barrel: 0.4, magazine: 'none', stock: 'wood', handguard: 'wood' },
      } as const;
      const { parts, muzzleZ } = rifle(spec[id]);
      return { parts, muzzle: [0, 0.035, muzzleZ], sightHeight: 0.075, hip: [0.16, -0.15, -0.3] };
    }
  }
}

export function buildWeaponModel(id: WeaponId): WeaponModel {
  const spec = design(id);
  const group = new THREE.Group();
  group.name = `weapon:${id}`;
  for (const p of spec.parts) {
    const geometry =
      p.shape === 'box'
        ? new THREE.BoxGeometry(...p.size)
        : new THREE.CylinderGeometry(p.size[0], p.size[1], p.size[2], 10).rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, materials[p.material]);
    mesh.position.set(...p.at);
    if (p.rotation) mesh.rotation.set(...p.rotation);
    group.add(mesh);
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(...spec.muzzle);
  group.add(muzzle);
  return { group, muzzle, sightHeight: spec.sightHeight, hip: new THREE.Vector3(...spec.hip) };
}

export function disposeWeaponModel(model: WeaponModel): void {
  model.group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
