import * as THREE from 'three';
import { boxRotation } from '@dotd/sim';
import type { LevelBox, LevelDef } from '@dotd/sim';
import { createGlowTexture, createSurfaceMaterials, METRES_PER_TEXTURE } from './textures';

/**
 * Scales a BoxGeometry's UVs so textures tile at a constant world size on every face,
 * whatever the box's dimensions.
 */
function worldScaleUVs(
  geometry: THREE.BoxGeometry,
  [w, h, d]: readonly [number, number, number],
): void {
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  // BoxGeometry faces, 4 vertices each: +x, -x, +y, -y, +z, -z.
  const faceSizes: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  faceSizes.forEach(([su, sv], face) => {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, (uv.getX(i) * su) / METRES_PER_TEXTURE, (uv.getY(i) * sv) / METRES_PER_TEXTURE);
    }
  });
  uv.needsUpdate = true;
}

function boxMesh(box: LevelBox, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(box.size[0], box.size[1], box.size[2]);
  worldScaleUVs(geometry, box.size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(box.center[0], box.center[1], box.center[2]);
  const q = boxRotation(box);
  mesh.quaternion.set(q.x, q.y, q.z, q.w);
  mesh.castShadow = box.surface !== 'ground';
  mesh.receiveShadow = true;
  return mesh;
}

interface FlickeringLight {
  light: THREE.PointLight;
  glow: THREE.Sprite;
  base: number;
  seed: number;
}

export interface LevelView {
  readonly group: THREE.Group;
  /** Animates flickering lamps. */
  update(time: number): void;
  dispose(): void;
}

/** Builds the renderable level: geometry, lamps, moonlight, sky, stars and fog. */
export function buildLevel(level: LevelDef, scene: THREE.Scene, maxAnisotropy: number): LevelView {
  const group = new THREE.Group();
  group.name = `level:${level.id}`;
  const materials = createSurfaceMaterials(maxAnisotropy);
  for (const box of level.boxes) group.add(boxMesh(box, materials[box.surface]));

  const { atmosphere } = level;
  scene.fog = new THREE.FogExp2(atmosphere.fogColor, atmosphere.fogDensity);
  scene.background = new THREE.Color(atmosphere.fogColor);

  const hemisphere = new THREE.HemisphereLight(
    atmosphere.skyColor,
    atmosphere.groundColor,
    atmosphere.hemisphereIntensity,
  );
  group.add(hemisphere);

  const moonDir = new THREE.Vector3(...atmosphere.moonDirection).normalize();
  const moon = new THREE.DirectionalLight(atmosphere.moonColor, atmosphere.moonIntensity);
  moon.position.copy(moonDir.clone().multiplyScalar(-40));
  moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = moon.shadow.camera.bottom = -28;
  moon.shadow.camera.right = moon.shadow.camera.top = 28;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 90;
  moon.shadow.bias = -0.0005;
  moon.shadow.normalBias = 0.03;
  group.add(moon, moon.target);

  // Lamps: a light, a bulb and a soft glow sprite.
  const glowTexture = createGlowTexture('rgba(255,220,170,0.9)', 'rgba(255,160,80,0)');
  const flickering: FlickeringLight[] = [];
  const bulbGeometry = new THREE.SphereGeometry(0.09, 12, 8);
  level.lights.forEach((def, i) => {
    const light = new THREE.PointLight(def.color, def.intensity, def.range, 2);
    light.position.set(...def.position);
    if (def.castShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.002;
      light.shadow.camera.near = 0.05; // lamps hang close to ceilings
    }
    const bulb = new THREE.Mesh(
      bulbGeometry,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(2.5) }),
    );
    bulb.position.copy(light.position);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: def.color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.copy(light.position);
    glow.scale.setScalar(1.6);
    group.add(light, bulb, glow);
    if (def.flicker) flickering.push({ light, glow, base: def.intensity, seed: i * 13.37 });
  });

  // Night sky: gradient dome, stars and a glowing moon, all unaffected by fog.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x0a1224) },
        horizon: { value: new THREE.Color(atmosphere.fogColor) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        varying vec3 vDir;
        void main() {
          float t = smoothstep(-0.05, 0.6, vDir.y);
          gl_FragColor = vec4(mix(horizon, top, t), 1.0);
        }`,
    }),
  );
  sky.renderOrder = -2;
  group.add(sky);

  const starPositions: number[] = [];
  let s = 7;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1400; i++) {
    const theta = rand() * Math.PI * 2;
    const y = 0.08 + rand() * 0.92;
    const r = Math.sqrt(1 - y * y);
    starPositions.push(Math.cos(theta) * r * 170, y * 170, Math.sin(theta) * r * 170);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(starPositions, 3),
    ),
    new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.2, sizeAttenuation: false, fog: false }),
  );
  stars.renderOrder = -1;
  group.add(stars);

  const moonSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture('rgba(235,240,255,1)', 'rgba(150,170,255,0)'),
      fog: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  moonSprite.position.copy(moonDir.clone().multiplyScalar(-160));
  moonSprite.scale.setScalar(26);
  group.add(moonSprite);

  scene.add(group);

  return {
    group,
    update(time: number) {
      for (const f of flickering) {
        // Layered sines plus the occasional near-blackout, like a failing bulb.
        const t = time + f.seed;
        const wobble = 0.85 + 0.1 * Math.sin(t * 17) + 0.05 * Math.sin(t * 41);
        const dropout = Math.sin(t * 1.7) > 0.96 ? 0.15 : 1;
        f.light.intensity = f.base * wobble * dropout;
        f.glow.material.opacity = wobble * dropout;
      }
    },
    dispose() {
      scene.remove(group);
      group.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Sprite
        ) {
          object.geometry.dispose();
          const material = object.material as THREE.Material & { map?: THREE.Texture | null };
          material.map?.dispose();
          material.dispose();
        }
      });
      for (const material of Object.values(materials)) {
        material.map?.dispose();
        material.dispose();
      }
    },
  };
}
