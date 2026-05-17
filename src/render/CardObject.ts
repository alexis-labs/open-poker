// 3D card object — a thin Group containing a front and a back plane.
// Using two separate single-sided planes (instead of a double-sided one) means
// the front and back can have different materials (vital later for Foil / Holo / Polychrome shaders).

import * as THREE from 'three';
import gsap from 'gsap';
import type { PlayingCard } from '../game/types';
import { getBackTexture, getCardTexture } from './cardTextures';

export const CARD_W = 1.2;
export const CARD_H = 1.68;
export const CARD_T = 0.04; // small offset so faces don't z-fight

// Shared uniform driven from the main render loop so every card's selection
// glow breathes in sync. Cheaper than per-card animation tweens.
const sharedGlowTime = { value: 0 };
export function tickCardGlow(dt: number) {
  sharedGlowTime.value += dt;
}

export class CardObject extends THREE.Group {
  card: PlayingCard;
  selected = false;
  hovered = false;
  baseY = 0;
  baseZ = 0;
  baseRotZ = 0;
  // hand index assigned by the layout — handy for sort/animation.
  handIndex = 0;

  faceMesh: THREE.Mesh;
  backMesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
  private glowMaterial: THREE.ShaderMaterial;

  constructor(card: PlayingCard) {
    super();
    this.card = card;

    const geom = new THREE.PlaneGeometry(CARD_W, CARD_H);

    // Soft outline glow — a slightly larger plane sitting just behind the
    // card face. A fragment shader paints a feathered rounded-rect border
    // that fades from a warm rim toward fully transparent inside and out.
    const glowPad = 0.35;
    const glowGeom = new THREE.PlaneGeometry(CARD_W + glowPad, CARD_H + glowPad);
    this.glowMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      // Additive-ish blending so the glow reads on dark backgrounds without
      // washing out the card art.
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0 },
        uTime: sharedGlowTime,
        uColor: { value: new THREE.Color(0x6ab8ff) },
        uSize: { value: new THREE.Vector2(CARD_W + glowPad, CARD_H + glowPad) },
        uInner: { value: new THREE.Vector2(CARD_W, CARD_H) },
        uRadius: { value: 0.18 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uOpacity;
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec2 uSize;   // total glow plane size
        uniform vec2 uInner;  // card size
        uniform float uRadius;

        // Signed distance to a rounded box centred at origin.
        float sdRoundBox(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b + vec2(r);
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }

        void main() {
          // Position in plane-local coordinates (centred).
          vec2 p = (vUv - 0.5) * uSize;
          float d = sdRoundBox(p, uInner * 0.5, uRadius);

          // Outside the card: soft falloff over the padding region.
          float pad = (uSize.x - uInner.x) * 0.5;
          float outer = 1.0 - smoothstep(0.0, pad, d);
          // Kill anything inside the card itself so the art isn't tinted.
          float mask = step(0.0, d) * outer;

          // Gentle breathing pulse.
          float pulse = 0.92 + 0.08 * sin(uTime * 2.2);

          // Extra easing on the falloff for a softer, more diffuse rim.
          outer = pow(outer, 1.6);
          mask = step(0.0, d) * outer;

          // Keep the glow discreet — cap overall intensity.
          float a = mask * uOpacity * pulse * 0.45;
          if (a <= 0.001) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    this.glowMesh = new THREE.Mesh(glowGeom, this.glowMaterial);
    this.glowMesh.position.z = -CARD_T * 0.25;
    this.glowMesh.renderOrder = -1;
    this.glowMesh.visible = false;
    const front = new THREE.MeshStandardMaterial({
      map: getCardTexture(card),
      roughness: 0.55,
      metalness: 0.05,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
    });
    const back = new THREE.MeshStandardMaterial({
      map: getBackTexture(),
      roughness: 0.55,
      metalness: 0.05,
    });

    this.faceMesh = new THREE.Mesh(geom, front);
    this.faceMesh.position.z = CARD_T / 2;

    this.backMesh = new THREE.Mesh(geom, back);
    this.backMesh.position.z = -CARD_T / 2;
    this.backMesh.rotation.y = Math.PI;

    // userData used by the raycaster to map back to this group.
    this.faceMesh.userData.cardObject = this;
    this.backMesh.userData.cardObject = this;

    this.add(this.faceMesh, this.backMesh, this.glowMesh);
  }

  /** Animate to a target slot transform; preserves selection lift. */
  moveTo(target: { x: number; y: number; z?: number; rotZ?: number }, duration = 0.45, delay = 0) {
    this.baseY = target.y;
    this.baseZ = target.z ?? 0;
    this.baseRotZ = target.rotZ ?? 0;

    gsap.to(this.position, {
      x: target.x,
      y: this.baseY + (this.selected ? 0.45 : 0) + (this.hovered ? 0.2 : 0),
      // Lift forward in Z when hovered/selected so the card draws on top of
      // the overlapping fan neighbours (otherwise the next card visually cuts it in half).
      z: this.baseZ + (this.selected ? 0.6 : 0) + (this.hovered ? 0.5 : 0),
      duration,
      delay,
      ease: 'power3.out',
    });
    gsap.to(this.rotation, {
      x: 0,
      y: 0,
      z: this.baseRotZ,
      duration,
      delay,
      ease: 'power3.out',
    });
  }

  setHover(on: boolean) {
    if (this.hovered === on) return;
    this.hovered = on;
    gsap.to(this.position, {
      y: this.baseY + (this.selected ? 0.45 : 0) + (on ? 0.2 : 0),
      // Pull forward so the whole card is visible above its overlapping neighbours.
      z: this.baseZ + (this.selected ? 0.6 : 0) + (on ? 0.5 : 0),
      duration: 0.18,
      ease: 'power2.out',
    });
    gsap.to(this.rotation, {
      x: on ? -0.05 : 0,
      duration: 0.18,
      ease: 'power2.out',
    });
  }

  setSelected(on: boolean) {
    if (this.selected === on) return;
    this.selected = on;
    gsap.to(this.position, {
      y: this.baseY + (on ? 0.45 : 0) + (this.hovered ? 0.2 : 0),
      z: this.baseZ + (on ? 0.6 : 0) + (this.hovered ? 0.5 : 0),
      duration: 0.22,
      ease: 'back.out(2)',
    });
    // Soft outline glow fade.
    const op = this.glowMaterial.uniforms.uOpacity;
    if (on) this.glowMesh.visible = true;
    gsap.to(op, {
      value: on ? 1 : 0,
      duration: on ? 0.28 : 0.22,
      ease: on ? 'power2.out' : 'power2.in',
      onComplete: () => {
        if (!this.selected) this.glowMesh.visible = false;
      },
    });
  }

  /** Quick visual pulse used during scoring — squash-and-stretch then settle. */
  pulse(scale = 1.18, duration = 0.35) {
    const tl = gsap.timeline();
    // Squash (wide, short)
    tl.to(this.scale, {
      x: scale * 1.08,
      y: scale * 0.92,
      z: scale,
      duration: duration * 0.25,
      ease: 'power2.out',
    });
    // Stretch (tall, narrow)
    tl.to(this.scale, {
      x: scale * 0.95,
      y: scale * 1.05,
      z: scale,
      duration: duration * 0.25,
      ease: 'sine.inOut',
    });
    // Settle back
    tl.to(this.scale, {
      x: 1, y: 1, z: 1,
      duration: duration * 0.5,
      ease: 'elastic.out(1, 0.5)',
    });
  }

  /** Brief emissive glow — used for scoring cards. */
  flash(color: number = 0xffd24a, duration: number = 0.5) {
    const mat = this.faceMesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(color);
    gsap.fromTo(
      mat,
      { emissiveIntensity: 0 },
      {
        emissiveIntensity: 0.9,
        duration: duration * 0.3,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
      },
    );
  }

  dispose() {
    this.faceMesh.geometry.dispose();
    (this.faceMesh.material as THREE.Material).dispose();
    (this.backMesh.material as THREE.Material).dispose();
    this.glowMesh.geometry.dispose();
    this.glowMaterial.dispose();
  }
}
