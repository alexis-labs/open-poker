// Raycaster-driven interaction: hover, click-to-select, simple horizontal drag-to-reorder.
// Wires GameState ↔ CardObjects without leaking three.js types upward.

import * as THREE from 'three';
import gsap from 'gsap';
import { CardObject } from './CardObject';
import { layoutHand } from './ThreeScene';
import { audio } from '../audio/AudioManager';

export interface InteractionDeps {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  handGroup: THREE.Group;
  /** Returns the CardObjects representing the current hand, in render order. */
  getHandObjects: () => CardObject[];
  /** Called when a card is clicked (toggle select). Returns the new selected state. */
  onToggleSelect: (cardId: string) => boolean;
  /** Called after a manual reorder (drag-drop) so the gameState hand order can sync. */
  onReorder: (cardIds: string[]) => void;
}

export function attachInteraction(deps: InteractionDeps): () => void {
  const { renderer, camera, handGroup, getHandObjects, onToggleSelect, onReorder } = deps;
  const dom = renderer.domElement;

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  let hovered: CardObject | null = null;
  let pressed: CardObject | null = null;
  let pressNdc = new THREE.Vector2();
  let dragging: CardObject | null = null;
  let dragOriginX = 0;
  let dragOffsetX = 0;
  const DRAG_THRESHOLD = 0.012; // NDC distance before we count as drag

  function setNdc(ev: PointerEvent) {
    const rect = dom.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick(): CardObject | null {
    const cards = getHandObjects();
    if (cards.length === 0) return null;
    ray.setFromCamera(ndc, camera);
    const meshes = cards.flatMap((c) => [c.faceMesh, c.backMesh]);
    const hits = ray.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    return (hits[0].object.userData.cardObject as CardObject) ?? null;
  }

  // Project the current cursor (ndc) onto a vertical plane at the given world Z.
  // Using a Z-facing plane is far more stable than a Y-facing one because the camera
  // looks down -Z, so the ray hits the plane nearly perpendicularly and X tracks the
  // cursor closely instead of diverging on shallow angles.
  function cursorWorldXAtZ(worldZ: number): number | null {
    ray.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -worldZ);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return hit.x;
  }

  function onMove(ev: PointerEvent) {
    setNdc(ev);

    // Drag in progress?
    if (pressed && !dragging) {
      const dx = ndc.x - pressNdc.x;
      const dy = ndc.y - pressNdc.y;
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        dragging = pressed;
        dragOriginX = dragging.position.x;
        // Use the card's *current* world Z (pre-lift) so the initial offset matches what the user clicked on.
        const cardWorldZ = handGroup.position.z + dragging.position.z;
        const cursorX = cursorWorldXAtZ(cardWorldZ);
        if (cursorX !== null) {
          dragOffsetX = cursorX - (dragging.position.x + handGroup.position.x);
        } else {
          dragOffsetX = 0;
        }
        audio.play('flip', { volume: 0.25 });
        // lift the card visually
        gsap.to(dragging.position, { y: dragging.baseY + 0.6, z: dragging.baseZ + 0.4, duration: 0.15 });
      }
    }

    if (dragging) {
      // Project onto a Z-plane at the lifted card depth. This is stable and matches the cursor 1:1.
      const liftedZ = handGroup.position.z + dragging.baseZ + 0.4;
      const cursorX = cursorWorldXAtZ(liftedZ);
      if (cursorX !== null) {
        dragging.position.x = cursorX - handGroup.position.x - dragOffsetX;
      }
      // live reorder
      reorderByX();
      return;
    }

    const hit = pick();
    if (hit !== hovered) {
      hovered?.setHover(false);
      hovered = hit;
      hovered?.setHover(true);
      if (hit) audio.play('click', { volume: 0.12, detune: (Math.random() - 0.5) * 200 });
      dom.style.cursor = hit ? 'pointer' : 'default';
    }
  }

  function reorderByX() {
    const cards = getHandObjects().slice().sort((a, b) => a.position.x - b.position.x);
    const slots = layoutHand(cards.length);
    cards.forEach((c, i) => {
      c.handIndex = i;
      if (c !== dragging) {
        c.moveTo(slots[i], 0.18);
      }
    });
  }

  function onDown(ev: PointerEvent) {
    setNdc(ev);
    const hit = pick();
    if (!hit) return;
    pressed = hit;
    pressNdc.set(ndc.x, ndc.y);
    dom.setPointerCapture(ev.pointerId);
  }

  function onUp(ev: PointerEvent) {
    if (dom.hasPointerCapture(ev.pointerId)) dom.releasePointerCapture(ev.pointerId);
    if (dragging) {
      // Snap into final slots and notify
      const cards = getHandObjects().slice().sort((a, b) => a.position.x - b.position.x);
      const slots = layoutHand(cards.length);
      cards.forEach((c, i) => {
        c.handIndex = i;
        c.moveTo(slots[i], 0.25);
      });
      onReorder(cards.map((c) => c.card.id));
      dragging = null;
      pressed = null;
      void dragOriginX;
      return;
    }
    if (pressed) {
      // Treat as click → toggle selection
      const isNowSelected = onToggleSelect(pressed.card.id);
      pressed.setSelected(isNowSelected);
      audio.play(isNowSelected ? 'select' : 'deselect', { detune: (Math.random() - 0.5) * 80 });
      pressed = null;
    }
  }

  function onLeave() {
    hovered?.setHover(false);
    hovered = null;
    dom.style.cursor = 'default';
  }

  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointerleave', onLeave);

  return () => {
    dom.removeEventListener('pointermove', onMove);
    dom.removeEventListener('pointerdown', onDown);
    dom.removeEventListener('pointerup', onUp);
    dom.removeEventListener('pointerleave', onLeave);
  };
}
