import * as THREE from 'three';
import type { Vec3 } from '@dotd/sim';

const MAX_PARTICLES = 3000;
const MAX_TRACERS = 48;
const TRACER_SECONDS = 0.07;
const GRAVITY = 9.8;

interface ParticleOptions {
  count: number;
  color: THREE.ColorRepresentation;
  speed: [number, number];
  size: [number, number];
  life: [number, number];
  /** Bias direction for the burst; particles spread around it. */
  direction?: Vec3;
  spread?: number;
  gravity?: number;
  drag?: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** CPU-simulated point particles drawn in a single draw call. */
class ParticlePool {
  readonly points: THREE.Points;
  private readonly position = new Float32Array(MAX_PARTICLES * 3);
  private readonly color = new Float32Array(MAX_PARTICLES * 3);
  private readonly alpha = new Float32Array(MAX_PARTICLES);
  private readonly size = new Float32Array(MAX_PARTICLES);
  private readonly velocity = new Float32Array(MAX_PARTICLES * 3);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly maxLife = new Float32Array(MAX_PARTICLES);
  private readonly baseSize = new Float32Array(MAX_PARTICLES);
  private readonly gravity = new Float32Array(MAX_PARTICLES);
  private readonly drag = new Float32Array(MAX_PARTICLES);
  private next = 0;

  constructor(blending: THREE.Blending, texture: THREE.Texture) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'alpha',
      new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'size',
      new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { map: { value: texture }, scale: { value: 400 } },
      ]),
      vertexShader: /* glsl */ `
        attribute float alpha;
        attribute float size;
        attribute vec3 color;
        uniform float scale;
        varying float vAlpha;
        varying vec3 vColor;
        #include <fog_pars_vertex>
        void main() {
          vAlpha = alpha;
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / max(0.1, -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying float vAlpha;
        varying vec3 vColor;
        #include <fog_pars_fragment>
        void main() {
          vec4 tex = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
          if (gl_FragColor.a < 0.01) discard;
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending,
      fog: true,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  setViewportHeight(pixels: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale!.value = pixels * 0.5;
  }

  emit(origin: Vec3, o: ParticleOptions): void {
    const color = new THREE.Color(o.color);
    for (let n = 0; n < o.count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      let dx = Math.random() * 2 - 1;
      let dy = Math.random() * 2 - 1;
      let dz = Math.random() * 2 - 1;
      if (o.direction) {
        const spread = o.spread ?? 0.6;
        dx = o.direction.x + dx * spread;
        dy = o.direction.y + dy * spread;
        dz = o.direction.z + dz * spread;
      }
      const len = Math.hypot(dx, dy, dz) || 1;
      const speed = rand(...o.speed);
      this.position.set([origin.x, origin.y, origin.z], i * 3);
      this.velocity.set([(dx / len) * speed, (dy / len) * speed, (dz / len) * speed], i * 3);
      const shade = rand(0.75, 1.1);
      this.color.set([color.r * shade, color.g * shade, color.b * shade], i * 3);
      this.maxLife[i] = this.life[i] = rand(...o.life);
      this.baseSize[i] = rand(...o.size);
      this.gravity[i] = o.gravity ?? GRAVITY;
      this.drag[i] = o.drag ?? 1.5;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i]! <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i]! -= dt;
      const t = Math.max(0, this.life[i]! / this.maxLife[i]!);
      const damping = Math.exp(-this.drag[i]! * dt);
      const v = i * 3;
      this.velocity[v]! *= damping;
      this.velocity[v + 1] = this.velocity[v + 1]! * damping - this.gravity[i]! * dt;
      this.velocity[v + 2]! *= damping;
      this.position[v]! += this.velocity[v]! * dt;
      this.position[v + 1]! += this.velocity[v + 1]! * dt;
      this.position[v + 2]! += this.velocity[v + 2]! * dt;
      this.alpha[i] = t;
      this.size[i] = this.baseSize[i]! * (0.4 + 0.6 * t);
    }
    const geometry = this.points.geometry;
    for (const name of ['position', 'alpha', 'size', 'color']) {
      (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
}

/** Short-lived world effects: tracers, impacts, blood, dirt and gun flashes. */
export class Effects {
  private readonly glowTexture: THREE.Texture;
  private readonly additive: ParticlePool;
  private readonly normal: ParticlePool;
  private readonly tracers: Tracer[] = [];
  private nextTracer = 0;
  private readonly tracerGeometry = new THREE.CylinderGeometry(0.006, 0.006, 1, 5, 1, true)
    .translate(0, 0.5, 0)
    .rotateX(Math.PI / 2);
  private readonly tracerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private readonly flashLight = new THREE.PointLight(0xffa850, 0, 12, 2);
  private flashTimer = 0;

  constructor(private readonly scene: THREE.Scene) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    this.glowTexture = new THREE.CanvasTexture(canvas);

    this.additive = new ParticlePool(THREE.AdditiveBlending, this.glowTexture);
    this.normal = new ParticlePool(THREE.NormalBlending, this.glowTexture);
    scene.add(this.additive.points, this.normal.points, this.flashLight);

    for (let i = 0; i < MAX_TRACERS; i++) {
      const mesh = new THREE.Mesh(this.tracerGeometry, this.tracerMaterial.clone());
      mesh.visible = false;
      scene.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
  }

  setViewportHeight(pixels: number): void {
    this.additive.setViewportHeight(pixels);
    this.normal.setViewportHeight(pixels);
  }

  tracer(from: THREE.Vector3, to: Vec3): void {
    const t = this.tracers[this.nextTracer]!;
    this.nextTracer = (this.nextTracer + 1) % MAX_TRACERS;
    const end = new THREE.Vector3(to.x, to.y, to.z);
    const length = from.distanceTo(end);
    if (length < 0.3) return;
    // Start a little in front of the muzzle so the tracer doesn't cover the gun.
    const start = from.clone().lerp(end, Math.min(0.5, 0.4 / length));
    t.mesh.position.copy(start);
    t.mesh.lookAt(end);
    t.mesh.scale.set(1, 1, start.distanceTo(end));
    t.mesh.visible = true;
    t.life = TRACER_SECONDS;
  }

  /** Lights up the surroundings for a moment when a gun fires. */
  gunFlash(at: THREE.Vector3): void {
    this.flashLight.position.copy(at);
    this.flashTimer = 0.05;
  }

  sparks(at: Vec3, normal?: Vec3): void {
    this.additive.emit(at, {
      count: 10,
      color: 0xffb060,
      speed: [2, 6],
      size: [0.04, 0.08],
      life: [0.15, 0.35],
      ...(normal ? { direction: normal, spread: 0.9 } : {}),
    });
    this.normal.emit(at, {
      count: 6,
      color: 0x8a8378,
      speed: [0.3, 1.2],
      size: [0.12, 0.25],
      life: [0.4, 0.8],
      gravity: -0.3,
      drag: 3,
      ...(normal ? { direction: normal, spread: 0.8 } : {}),
    });
  }

  blood(at: Vec3, direction: Vec3, heavy: boolean): void {
    this.normal.emit(at, {
      count: heavy ? 26 : 12,
      color: 0x7a0c0c,
      speed: [1, heavy ? 5 : 3.5],
      size: [0.05, 0.12],
      life: [0.3, 0.7],
      direction,
      spread: 0.8,
    });
    this.normal.emit(at, {
      count: heavy ? 8 : 4,
      color: 0x5a0808,
      speed: [0.2, 0.8],
      size: [0.25, 0.45],
      life: [0.25, 0.5],
      gravity: 0.5,
      drag: 4,
    });
  }

  dirt(at: Vec3): void {
    this.normal.emit(at, {
      count: 30,
      color: 0x3b3326,
      speed: [1.5, 4],
      size: [0.08, 0.18],
      life: [0.6, 1.2],
      direction: { x: 0, y: 1, z: 0 },
      spread: 0.7,
    });
    this.normal.emit(at, {
      count: 10,
      color: 0x4a4436,
      speed: [0.2, 0.8],
      size: [0.4, 0.8],
      life: [1, 1.8],
      gravity: -0.2,
      drag: 2,
    });
  }

  update(dt: number): void {
    this.additive.update(dt);
    this.normal.update(dt);
    for (const t of this.tracers) {
      if (!t.mesh.visible) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
      else (t.mesh.material as THREE.MeshBasicMaterial).opacity = t.life / TRACER_SECONDS;
    }
    this.flashTimer -= dt;
    this.flashLight.intensity = this.flashTimer > 0 ? 25 : 0;
  }

  dispose(): void {
    this.additive.dispose();
    this.normal.dispose();
    this.glowTexture.dispose();
    this.tracerGeometry.dispose();
    for (const t of this.tracers) {
      (t.mesh.material as THREE.Material).dispose();
      this.scene.remove(t.mesh);
    }
    this.tracerMaterial.dispose();
    this.scene.remove(this.additive.points, this.normal.points, this.flashLight);
  }
}
