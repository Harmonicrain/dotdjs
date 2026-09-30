import * as THREE from 'three';
import type { SurfaceKind } from '@dotd/sim';

/** Texture size in pixels; one texture covers 2 m × 2 m of surface. */
const SIZE = 256;
export const METRES_PER_TEXTURE = 2;

interface SurfaceStyle {
  base: string;
  grid: string;
  noise: number;
  roughness: number;
  metalness: number;
  /** Extra decoration drawn over the base. */
  pattern?: 'planks' | 'hazard' | 'plates';
}

const STYLES: Record<SurfaceKind, SurfaceStyle> = {
  ground: { base: '#3a3d36', grid: '#474c43', noise: 26, roughness: 0.95, metalness: 0 },
  wall: { base: '#5d5852', grid: '#6b655e', noise: 18, roughness: 0.9, metalness: 0 },
  concrete: { base: '#6b6862', grid: '#7a7771', noise: 16, roughness: 0.85, metalness: 0 },
  trim: {
    base: '#b8662a',
    grid: '#c9793b',
    noise: 10,
    roughness: 0.7,
    metalness: 0,
    pattern: 'hazard',
  },
  crate: {
    base: '#6e4a2b',
    grid: '#5a3a20',
    noise: 14,
    roughness: 0.8,
    metalness: 0,
    pattern: 'planks',
  },
  metal: {
    base: '#44505c',
    grid: '#56636f',
    noise: 8,
    roughness: 0.45,
    metalness: 0.6,
    pattern: 'plates',
  },
};

/** Small deterministic PRNG so textures look the same every load. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawSurface(style: SurfaceStyle, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const random = seeded(seed);

  ctx.fillStyle = style.base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Blotchy grime: soft translucent circles of lighter and darker tone.
  for (let i = 0; i < 90; i++) {
    const shade = random() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.015 + random() * 0.035})`;
    ctx.beginPath();
    ctx.arc(random() * SIZE, random() * SIZE, 6 + random() * 40, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine per-pixel noise.
  const image = ctx.getImageData(0, 0, SIZE, SIZE);
  for (let p = 0; p < image.data.length; p += 4) {
    const n = (random() - 0.5) * style.noise;
    image.data[p] = Math.max(0, Math.min(255, image.data[p]! + n));
    image.data[p + 1] = Math.max(0, Math.min(255, image.data[p + 1]! + n));
    image.data[p + 2] = Math.max(0, Math.min(255, image.data[p + 2]! + n));
  }
  ctx.putImageData(image, 0, 0);

  if (style.pattern === 'planks') {
    ctx.strokeStyle = 'rgba(20,12,6,0.55)';
    ctx.lineWidth = 3;
    for (let y = SIZE / 8; y < SIZE; y += SIZE / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
    }
  } else if (style.pattern === 'hazard') {
    ctx.fillStyle = 'rgba(25,20,15,0.55)';
    for (let x = -SIZE; x < SIZE * 2; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 24 - SIZE, SIZE);
      ctx.lineTo(x - SIZE, SIZE);
      ctx.fill();
    }
  } else if (style.pattern === 'plates') {
    ctx.fillStyle = 'rgba(200,210,220,0.18)';
    for (let x = 12; x < SIZE; x += SIZE / 4) {
      for (let y = 12; y < SIZE; y += SIZE / 4) ctx.fillRect(x, y, 4, 4);
    }
  }

  // One-metre grid lines: the greybox "measuring tape".
  ctx.strokeStyle = style.grid;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 2; i++) {
    const at = (i * SIZE) / 2;
    ctx.beginPath();
    ctx.moveTo(at, 0);
    ctx.lineTo(at, SIZE);
    ctx.moveTo(0, at);
    ctx.lineTo(SIZE, at);
    ctx.stroke();
  }
  return canvas;
}

export function createSurfaceMaterials(
  maxAnisotropy: number,
): Record<SurfaceKind, THREE.MeshStandardMaterial> {
  const entries = (Object.keys(STYLES) as SurfaceKind[]).map((kind, i) => {
    const style = STYLES[kind];
    const texture = new THREE.CanvasTexture(drawSurface(style, 1000 + i * 77));
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: style.roughness,
      metalness: style.metalness,
    });
    return [kind, material] as const;
  });
  return Object.fromEntries(entries) as Record<SurfaceKind, THREE.MeshStandardMaterial>;
}

/** Soft radial gradient used for glows, flashes and particles. */
export function createGlowTexture(
  inner = 'rgba(255,255,255,1)',
  outer = 'rgba(255,255,255,0)',
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
