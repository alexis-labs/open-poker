// Three.js scene: orthographic-ish perspective camera (low FOV → 2.5D look),
// soft lights, simple table background, and a hand layout helper.

import * as THREE from 'three';
import gsap from 'gsap';
import { CARD_W, CARD_H, CARD_T, tickCardGlow } from './CardObject';
import { getBackTexture } from './cardTextures';
import { ParticleSystem } from './Particles';
import { assetUrl } from '../loading/assetPaths';
import { BACKGROUND_IMAGE_PATH } from '../loading/assetManifest';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface SceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  handGroup: THREE.Group;
  playGroup: THREE.Group;
  deckGroup: THREE.Group;
  setDeckCount: (n: number) => void;
  particles: ParticleSystem;
  emitBurst: (worldPos: THREE.Vector3, opts?: Parameters<ParticleSystem['emit']>[1]) => void;
  createVector3: () => THREE.Vector3;
  createColor: (value: THREE.ColorRepresentation) => THREE.Color;
  getMetrics: () => { frame: number; calls: number; triangles: number; points: number; lines: number };
  dispose: () => void;
  shake: (amount?: number, duration?: number) => void;
}

/** Animated dark-felt background — subtle moving radial waves, Balatro-ish vibe. */
function buildBackground(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color('#107052') },
      uColorB: { value: new THREE.Color('#063329') },
      uColorC: { value: new THREE.Color('#29a36d') },
      uMap: { value: null },
      uUseMap: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 1.0, 1.0); // full-screen quad behind everything
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform sampler2D uMap;
      uniform float uUseMap;
      varying vec2 vUv;

      // Soft value-noise so the white field has a little table texture.
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        float r = length(uv);

        float n = noise(uv * 3.0 + uTime * 0.08);
        n += 0.5 * noise(uv * 6.0 - uTime * 0.05);
        n *= 0.4;

        vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.35, r));
        col = mix(col, uColorC, n * 0.11);
        col *= 1.0 - smoothstep(0.72, 1.35, r) * 0.22;

        vec3 imageCol = texture2D(uMap, vUv).rgb;
        col = mix(col, imageCol, uUseMap);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Tries to load /art/ui/background.{png,webp,jpg} and assigns it to
 * scene.background (Three.js native path — correct colorspace + no blending
 * artefacts). When a file is found the procedural bg mesh is hidden.
 * Falls back silently if no file exists.
 */
function buildImageBackground(procBg: THREE.Mesh): { dispose: () => void } {
  const loader = new THREE.TextureLoader();
  let backgroundTexture: THREE.Texture | null = null;
  let disposed = false;
  const material = procBg.material as THREE.ShaderMaterial;
  const tryNext = () => {
    if (disposed) return;
    const url = assetUrl(BACKGROUND_IMAGE_PATH);
    loader.load(
      url,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        backgroundTexture = tex;
        material.uniforms.uMap.value = tex;
        material.uniforms.uUseMap.value = 1;
      },
      undefined,
      () => undefined,
    );
  };
  tryNext();
  return {
    dispose: () => {
      disposed = true;
      material.uniforms.uMap.value = null;
      material.uniforms.uUseMap.value = 0;
      backgroundTexture?.dispose();
    },
  };
}

export function createScene(container: HTMLElement): SceneHandle {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(28, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 1.2, 12);
  camera.lookAt(0, 0.6, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Background
  const bg = buildBackground();
  scene.add(bg);
  // Image background — loads /art/ui/background.{png,webp,jpg,svg} if present.
  // On success: sets scene.background and hides the procedural mesh.
  const imageBackground = buildImageBackground(bg);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88c8ff, 0.4);
  rim.position.set(-3, 2, -2);
  scene.add(rim);

  // Groups
  const handGroup = new THREE.Group();
  // Smaller + lifted so cards sit higher and look less crowded.
  handGroup.position.set(0, -0.9, 0);
  handGroup.scale.setScalar(0.7);
  scene.add(handGroup);

  const playGroup = new THREE.Group();
  playGroup.position.set(0, 0.4, 0);
  playGroup.scale.setScalar(0.78);
  scene.add(playGroup);

  // ---- Deck stack (bottom right corner) ----
  const deckGroup = new THREE.Group();
  deckGroup.position.set(4.6, -1.75, 0);
  deckGroup.scale.setScalar(0.68);
  deckGroup.rotation.z = -0.04;
  scene.add(deckGroup);

  const deckGeom = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const deckMat = new THREE.MeshStandardMaterial({
    map: getBackTexture(),
    roughness: 0.85,
    metalness: 0.05,
    alphaTest: 0.5,
  });
  // 12 stacked planes is enough to read as a deck without being heavy.
  const DECK_VISUAL_MAX = 12;
  const deckMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < DECK_VISUAL_MAX; i++) {
    const m = new THREE.Mesh(deckGeom, deckMat);
    m.position.set(i * 0.012, i * 0.018, i * CARD_T * 0.5);
    deckGroup.add(m);
    deckMeshes.push(m);
  }
  const setDeckCount = (n: number) => {
    const visible = Math.max(0, Math.min(DECK_VISUAL_MAX, Math.ceil((n / 52) * DECK_VISUAL_MAX)));
    for (let i = 0; i < deckMeshes.length; i++) {
      deckMeshes[i].visible = i < visible;
    }
  };
  setDeckCount(52);

  // Particle system (added directly to scene so positions are world-space).
  const particles = new ParticleSystem();
  scene.add(particles.points);
  const emitBurst = (worldPos: THREE.Vector3, opts?: Parameters<ParticleSystem['emit']>[1]) => {
    particles.emit(worldPos, opts);
  };
  const createVector3 = () => new THREE.Vector3();
  const createColor = (value: THREE.ColorRepresentation) => new THREE.Color(value);

  const applyResponsiveLayout = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const compact = clamp(Math.min(w / 1440, h / 900), 0.78, 1);
    const narrowBias = clamp((1920 - w) / 1920, 0, 0.5);
    const handX = narrowBias * 1.15 + (1 - compact) * 0.35;
    const handY = -0.9 + (1 - compact) * 1.35;
    const playY = 0.4 + (1 - compact) * 0.28;
    const deckX = 4.6 - (1 - compact) * 0.85;
    const deckY = -1.75 + (1 - compact) * 0.45;

    handGroup.position.set(handX, handY, 0);
    handGroup.scale.setScalar(0.7 * compact);
    playGroup.position.set(handX, playY, 0);
    playGroup.scale.setScalar(0.78 * compact);
    deckGroup.position.set(deckX, deckY, 0);
    deckGroup.scale.setScalar(0.68 * compact);
  };
  applyResponsiveLayout();

  // Resize
  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyResponsiveLayout();
  };
  window.addEventListener('resize', onResize);

  // Render loop
  const clock = new THREE.Clock();
  let rafId = 0;
  const tick = () => {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    (bg.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    tickCardGlow(dt);
    particles.update(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  // Screen shake — translate camera briefly. Restores via gsap.
  const shake = (amount = 0.15, duration = 0.35) => {
    const start = { x: camera.position.x, y: camera.position.y };
    const tl = gsap.timeline({ onComplete: () => { camera.position.x = start.x; camera.position.y = start.y; } });
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      tl.to(camera.position, {
        x: start.x + (Math.random() - 0.5) * amount * 2,
        y: start.y + (Math.random() - 0.5) * amount * 2,
        duration: duration / steps,
        ease: 'sine.inOut',
      });
    }
    tl.to(camera.position, { x: start.x, y: start.y, duration: 0.1, ease: 'power2.out' });
  };

  const dispose = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    imageBackground.dispose();
    bg.geometry.dispose();
    (bg.material as THREE.Material).dispose();
    deckGeom.dispose();
    deckMat.dispose();
    particles.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  const getMetrics = () => ({
    frame: renderer.info.render.frame,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    points: renderer.info.render.points,
    lines: renderer.info.render.lines,
  });

  return { scene, camera, renderer, handGroup, playGroup, deckGroup, setDeckCount, particles, emitBurst, createVector3, createColor, getMetrics, dispose, shake };
}

/** Compute hand-layout transforms — gentle fan, no overlap. */
export function layoutHand(count: number): { x: number; y: number; z: number; rotZ: number }[] {
  if (count === 0) return [];
  const spacing = Math.min(CARD_W * 1.05, 9 / Math.max(count, 1));
  const totalW = (count - 1) * spacing;
  const startX = -totalW / 2;
  const fanAngle = 0.04; // radians per card from centre
  const lift = 0.05;     // y-arc

  return Array.from({ length: count }, (_, i) => {
    const x = startX + i * spacing;
    const off = i - (count - 1) / 2;
    const rotZ = -off * fanAngle;
    const y = -Math.abs(off) * lift * 0.5;
    // Each card sits slightly in front of the previous so the fan overlap renders
    // in a consistent left-to-right order (no z-fighting).
    const z = i * 0.02;
    return { x, y, z, rotZ };
  });
}

/** Position transforms for cards placed in the play area. */
export function layoutPlay(count: number): { x: number; y: number; z: number; rotZ: number }[] {
  const spacing = CARD_W * 1.1;
  const totalW = (count - 1) * spacing;
  const startX = -totalW / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: startX + i * spacing,
    y: 0.7,
    z: 0,
    rotZ: 0,
  }));
}
