// 3D card object — a thin Group containing a front and a back plane.
// Using two separate single-sided planes (instead of a double-sided one) means
// the front and back can have different materials (vital later for Foil / Holo / Polychrome shaders).

import * as THREE from 'three';
import gsap from 'gsap';
import type { PlayingCard } from '../game/types';
import { getBackTexture, getCardTexture } from './cardTextures';

export const CARD_W = 1.4;
export const CARD_H = 1.96;
export const CARD_T = 0.04; // small offset so faces don't z-fight

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

  constructor(card: PlayingCard) {
    super();
    this.card = card;

    const geom = new THREE.PlaneGeometry(CARD_W, CARD_H);
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

    this.add(this.faceMesh, this.backMesh);
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
  }
}
