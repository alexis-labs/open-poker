// Lightweight particle system using THREE.Points. One big pool, owner emits
// bursts in world space. Updated per-frame from ThreeScene's tick.

import * as THREE from 'three';

const MAX = 400;

interface ParticleData {
  active: boolean;
  age: number;
  life: number;
  vx: number; vy: number; vz: number;
  gravity: number;
  startSize: number;
}

export class ParticleSystem {
  points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private data: ParticleData[] = [];
  private cursor = 0;

  constructor() {
    const geom = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.sizes = new Float32Array(MAX);
    geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixel: { value: window.devicePixelRatio || 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: /* glsl */ `
        attribute float size;
        varying vec3 vColor;
        uniform float uPixel;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixel * (200.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(d));
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;

    for (let i = 0; i < MAX; i++) {
      this.data[i] = { active: false, age: 0, life: 1, vx: 0, vy: 0, vz: 0, gravity: 0, startSize: 1 };
      this.sizes[i] = 0;
    }
  }

  /** Emit a burst at world position. Color is RGB 0..1. */
  emit(
    world: THREE.Vector3,
    opts: { count?: number; color?: THREE.Color; spread?: number; speed?: number; life?: number; size?: number; gravity?: number } = {},
  ) {
    const count = opts.count ?? 12;
    const color = opts.color ?? new THREE.Color('#ffd24a');
    const spread = opts.spread ?? 0.8;
    const speed = opts.speed ?? 2.2;
    const life = opts.life ?? 0.9;
    const size = opts.size ?? 14;
    const gravity = opts.gravity ?? -4.5;

    // Convert world → local of this.points (parent expected = scene)
    const local = world.clone();
    if (this.points.parent) this.points.parent.worldToLocal(local);

    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      const d = this.data[i];
      d.active = true;
      d.age = 0;
      d.life = life * (0.7 + Math.random() * 0.6);
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      d.vx = Math.cos(ang) * r * speed * 0.5;
      d.vy = speed * (0.6 + Math.random() * 0.8);
      d.vz = (Math.random() - 0.5) * spread;
      d.gravity = gravity;
      d.startSize = size * (0.7 + Math.random() * 0.6);

      this.positions[i * 3 + 0] = local.x;
      this.positions[i * 3 + 1] = local.y;
      this.positions[i * 3 + 2] = local.z;
      this.colors[i * 3 + 0] = color.r;
      this.colors[i * 3 + 1] = color.g;
      this.colors[i * 3 + 2] = color.b;
      this.sizes[i] = d.startSize;
    }
  }

  update(dt: number) {
    let anyActive = false;
    for (let i = 0; i < MAX; i++) {
      const d = this.data[i];
      if (!d.active) continue;
      d.age += dt;
      if (d.age >= d.life) {
        d.active = false;
        this.sizes[i] = 0;
        continue;
      }
      anyActive = true;
      d.vy += d.gravity * dt;
      this.positions[i * 3 + 0] += d.vx * dt;
      this.positions[i * 3 + 1] += d.vy * dt;
      this.positions[i * 3 + 2] += d.vz * dt;
      const t = d.age / d.life;
      this.sizes[i] = d.startSize * (1 - t);
    }
    if (anyActive || this.cursor !== 0) {
      (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
