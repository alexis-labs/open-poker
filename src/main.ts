// Bootstrap: glue GameState ↔ Three.js scene ↔ Interaction ↔ HUD.
// Renders cards as CardObjects, animates them on every state change, and
// shows an animated Chips × Mult readout when a hand is scored.

import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';

import { GameState } from './game/gameState';
import { evaluateHand } from './game/pokerEngine';
import type { PlayingCard, ScoreBreakdown } from './game/types';
import { createScene, layoutHand, layoutPlay } from './render/ThreeScene';
import { CardObject } from './render/CardObject';
import { attachInteraction } from './render/Interaction';
import { audio } from './audio/AudioManager';

// ---------- DOM refs ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const host = $('canvas-host');
const blindName = $('blind-name');
const blindBadge = $('blind-badge');
const blindTarget = $('blind-target');
const blindReward = $('blind-reward');
const roundScoreEl = $('round-score');
const handTypeEl = $('hand-type');
const chipsEl = $('chips');
const multEl = $('mult');
const anteEl = $('ante');
const roundEl = $('round');
const moneyEl = $('money');
const handsLeftEl = $('hands-left');
const discardsLeftEl = $('discards-left');
const seedEl = $('seed');
const handCounterEl = $('hand-counter');
const deckCounterEl = $('deck-counter');
const jokerSlotsEl = $('joker-slots');
const jokerCountEl = $('joker-count');
const consumableSlotsEl = $('consumable-slots');
const consumableCountEl = $('consumable-count');
const btnPlay = $<HTMLButtonElement>('btn-play');
const btnDiscard = $<HTMLButtonElement>('btn-discard');
const btnReset = $<HTMLButtonElement>('btn-reset');
const popup = $('score-popup');
const popupHand = $('popup-hand');
const popupChips = $('popup-chips');
const popupMult = $('popup-mult');
const popupTotal = $('popup-total');
const overlay = $('overlay');
const overlayTitle = $('overlay-title');
const overlaySub = $('overlay-sub');
const overlayRestart = $<HTMLButtonElement>('overlay-restart');

// ---------- Engine + Scene ----------
const state = new GameState();
const sceneHandle = createScene(host);

// CardObject pool keyed by card.id so visuals persist across state mutations.
const objects = new Map<string, CardObject>();

function getOrCreateObject(card: PlayingCard): CardObject {
  let obj = objects.get(card.id);
  if (!obj) {
    obj = new CardObject(card);
    sceneHandle.handGroup.add(obj);
    // Spawn from the right (deck position) and fly in.
    obj.position.set(6, -2, 1);
    obj.rotation.y = Math.PI; // start back-facing
    objects.set(card.id, obj);
    // Deal sound with slight variation per card
    audio.play('deal', { volume: 0.28, detune: (Math.random() - 0.5) * 200, pitch: 0.95 + Math.random() * 0.1 });
    // Flip face-up shortly after entering
    gsap.to(obj.rotation, { y: 0, duration: 0.5, delay: 0.05, ease: 'power3.out' });
  }
  return obj;
}

// Renderer-side ordering: we keep a manual list so drag-reorder works smoothly
// without fighting GameState (which doesn't care about visual order).
let handOrder: string[] = [];

function syncHandOrder() {
  const ids = state.hand.map((c) => c.id);
  handOrder = handOrder.filter((id) => ids.includes(id));
  for (const id of ids) if (!handOrder.includes(id)) handOrder.push(id);
}

function getOrderedHand(): CardObject[] {
  return handOrder.map((id) => objects.get(id)!).filter(Boolean);
}

function reflowHand(duration = 0.4) {
  syncHandOrder();
  const cardsById: Record<string, PlayingCard> = {};
  for (const c of state.hand) cardsById[c.id] = c;
  const ordered = handOrder.map((id) => cardsById[id]).filter(Boolean);
  const slots = layoutHand(ordered.length);

  ordered.forEach((card, i) => {
    const obj = getOrCreateObject(card);
    obj.handIndex = i;
    obj.setSelected(state.selected.has(card.id));
    obj.moveTo(slots[i], duration, i * 0.04);
  });

  // Dispose objects no longer in the hand AND not protected mid-play.
  for (const [id, obj] of objects) {
    if (!cardsById[id] && !obj.userData.keepAlive) {
      sceneHandle.handGroup.remove(obj);
      sceneHandle.playGroup.remove(obj);
      obj.dispose();
      objects.delete(id);
    }
  }
}

// ---------- HUD ----------
const MAX_JOKERS = 5;
const MAX_CONSUMABLES = 2;

function renderSlotPlaceholders() {
  jokerSlotsEl.innerHTML = '';
  for (let i = 0; i < MAX_JOKERS; i++) {
    const s = document.createElement('div');
    s.className = 'joker-slot';
    jokerSlotsEl.appendChild(s);
  }
  consumableSlotsEl.innerHTML = '';
  for (let i = 0; i < MAX_CONSUMABLES; i++) {
    const s = document.createElement('div');
    s.className = 'consumable-slot';
    consumableSlotsEl.appendChild(s);
  }
}
renderSlotPlaceholders();

const BLIND_LABELS = ['Small Blind', 'Big Blind', 'Boss Blind'] as const;
const BLIND_BADGE_TEXT = ['SMALL<br/>BLIND', 'BIG<br/>BLIND', 'BOSS'] as const;
const BLIND_KIND = ['small', 'big', 'boss'] as const;
const BLIND_REWARD = ['$', '$$', '$$$$$'] as const;

function updateHud() {
  const idx = state.blindIndex;
  blindName.textContent = BLIND_LABELS[idx];
  blindBadge.className = `blind-badge ${BLIND_KIND[idx]}`;
  const inner = blindBadge.querySelector('span');
  if (inner) inner.innerHTML = BLIND_BADGE_TEXT[idx];
  blindTarget.textContent = state.target.toLocaleString();
  blindReward.textContent = BLIND_REWARD[idx];
  roundScoreEl.textContent = state.roundScore.toLocaleString();
  anteEl.innerHTML = `${state.ante}<span class="counter-total">/8</span>`;
  const roundNumber = (state.ante - 1) * 3 + state.blindIndex + 1;
  roundEl.textContent = String(roundNumber);
  moneyEl.textContent = `$${state.money}`;
  handsLeftEl.textContent = `${state.handsLeft}`;
  discardsLeftEl.textContent = `${state.discardsLeft}`;
  seedEl.textContent = String(state.config.seed);

  // Floating counters (deck + hand)
  handCounterEl.textContent = `${state.hand.length}/${state.config.handSize}`;
  deckCounterEl.textContent = `${state.deck.length}/52`;
  sceneHandle.setDeckCount(state.deck.length);

  // Joker / consumable counters (placeholders for now — no joker data yet)
  jokerCountEl.textContent = `0/${MAX_JOKERS}`;
  consumableCountEl.textContent = `0/${MAX_CONSUMABLES}`;

  // Live hand preview
  const sel = state.selectedCards();
  if (sel.length === 0) {
    handTypeEl.textContent = '—';
    chipsEl.textContent = '0';
    multEl.textContent = '0';
  } else {
    const ev = evaluateHand(sel);
    const lvl = state.handLevels[ev.type];
    handTypeEl.textContent = `${ev.type} (lvl ${lvl.level})`;
    chipsEl.textContent = `${lvl.chips}`;
    multEl.textContent = `${lvl.mult}`;
  }

  btnPlay.disabled = !state.canPlay();
  btnDiscard.disabled = !state.canDiscard();

  if (state.phase === 'game-over' || state.phase === 'win') {
    const wasHidden = overlay.classList.contains('hidden');
    overlay.classList.remove('hidden');
    overlayTitle.textContent = state.phase === 'win' ? 'You Win!' : 'Game Over';
    overlaySub.textContent = state.phase === 'win'
      ? `Ante ${state.ante - 1} cleared on seed ${state.config.seed}`
      : `Couldn't beat ${BLIND_LABELS[idx]} — score ${state.roundScore.toLocaleString()} / ${state.target.toLocaleString()}`;
    if (wasHidden) {
      audio.play(state.phase === 'win' ? 'win' : 'lose');
      gsap.fromTo(
        overlay.querySelector('.overlay-card'),
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
      );
    }
  } else {
    overlay.classList.add('hidden');
  }
}

// ---------- Scoring readout ----------
function tweenNumber(el: HTMLElement, from: number, to: number, duration: number, tickName?: string) {
  const obj = { v: from };
  let lastSoundAt = from;
  const step = Math.max(1, Math.floor((to - from) / 18));
  gsap.to(obj, {
    v: to,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      const v = obj.v;
      el.textContent = Math.round(v).toLocaleString();
      if (tickName && v - lastSoundAt >= step) {
        lastSoundAt = v;
        audio.play(tickName, { volume: 0.12, detune: (Math.random() - 0.5) * 250 });
      }
    },
  });
}

function showScorePopup(br: ScoreBreakdown) {
  popup.classList.remove('hidden');
  popupHand.textContent = `${br.hand.type}`;
  popupChips.textContent = '0';
  popupMult.textContent = '0';
  popupTotal.textContent = '0';

  gsap.fromTo(popup,
    { scale: 0.5, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' },
  );
  audio.play('scorePop');

  tweenNumber(popupChips, 0, br.finalChips, 0.6, 'chipTick');
  tweenNumber(popupMult,  0, br.finalMult,  0.6, 'multTick');

  gsap.delayedCall(0.7, () => {
    tweenNumber(popupTotal, 0, br.total, 0.8);
    gsap.fromTo(popupTotal, { scale: 0.6 }, { scale: 1.2, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' });
    audio.play('chaching');
    // Scale shake intensity by how big the score is relative to the target.
    const intensity = Math.max(0.08, Math.min(0.6, (br.total / Math.max(1, state.target)) * 0.5));
    sceneHandle.shake(intensity, 0.45);
  });

  gsap.delayedCall(2.2, () => {
    gsap.to(popup, { opacity: 0, duration: 0.4, onComplete: () => popup.classList.add('hidden') });
  });
}

// ---------- Actions ----------
async function playSelected() {
  if (!state.canPlay()) return;
  const playedCards = state.selectedCards();
  if (playedCards.length === 0) return;

  // 1. Move selected cards into the play area in their selection order.
  const playSlots = layoutPlay(playedCards.length);
  audio.play('whoosh');
  playedCards.forEach((card, i) => {
    const obj = objects.get(card.id);
    if (!obj) return;
    obj.userData.keepAlive = true; // shield from disposal during reflow
    // Reparent to play group (preserve world by simple offset reset; groups are at known positions)
    sceneHandle.handGroup.remove(obj);
    sceneHandle.playGroup.add(obj);
    obj.setSelected(false);
    obj.moveTo(playSlots[i], 0.4, i * 0.06);
  });

  await new Promise((r) => setTimeout(r, 500));

  const br = state.playSelected();
  if (!br) return;

  // Pulse scoring cards; dim non-scoring ones.
  const scoringIds = new Set(br.hand.scoringCards.map((c) => c.id));
  let scoringIndex = 0;
  for (const card of playedCards) {
    const obj = objects.get(card.id);
    if (!obj) continue;
    if (scoringIds.has(card.id)) {
      const idx = scoringIndex++;
      gsap.delayedCall(0.05 + idx * 0.12, () => {
        obj.pulse(1.22, 0.4);
        obj.flash(0xffd24a, 0.5);
        // Emit chip burst at the card's world position
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);
        sceneHandle.emitBurst(worldPos, {
          count: 14,
          color: new THREE.Color('#ffd24a'),
          speed: 2.4,
          spread: 0.9,
          life: 1.0,
          size: 16,
        });
        audio.play('chipTick', { volume: 0.25, pitch: 1 + idx * 0.08 });
      });
    } else {
      const mat = obj.faceMesh.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      gsap.to(mat, { opacity: 0.5, duration: 0.2 });
    }
  }

  showScorePopup(br);

  const prev = state.roundScore - br.total;
  tweenNumber(roundScoreEl, prev, state.roundScore, 1.0, 'chipTick');
  // HUD bump on the round score
  gsap.fromTo(roundScoreEl, { scale: 1 }, { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });

  // After the readout, fly played cards off and remove.
  gsap.delayedCall(1.8, () => {
    for (const card of playedCards) {
      const obj = objects.get(card.id);
      if (!obj) continue;
      gsap.to(obj.position, { y: -6, duration: 0.5, ease: 'power2.in' });
      gsap.to(obj.rotation, { z: (Math.random() - 0.5) * 1.5, duration: 0.5 });
      gsap.delayedCall(0.55, () => {
        sceneHandle.playGroup.remove(obj);
        obj.dispose();
        objects.delete(card.id);
      });
    }
    reflowHand(0.5);
    updateHud();
  });
}

async function discardSelected() {
  if (!state.canDiscard()) return;
  const cards = state.selectedCards();
  audio.play('sweep');
  for (const card of cards) {
    const obj = objects.get(card.id);
    if (!obj) continue;
    obj.userData.keepAlive = true;
    gsap.to(obj.position, { y: -5, x: obj.position.x + (Math.random() - 0.5) * 1.5, duration: 0.45, ease: 'power2.in' });
    gsap.to(obj.rotation, { z: (Math.random() - 0.5) * 1.2, duration: 0.45 });
    gsap.delayedCall(0.5, () => {
      sceneHandle.handGroup.remove(obj);
      obj.dispose();
      objects.delete(card.id);
    });
  }
  state.discardSelected();
  gsap.delayedCall(0.55, () => reflowHand(0.45));
}

// ---------- Wire up ----------
btnPlay.addEventListener('click', () => { audio.play('buttonClick'); void playSelected(); });
btnDiscard.addEventListener('click', () => { audio.play('buttonClick'); void discardSelected(); });
btnReset.addEventListener('click', () => {
  audio.play('buttonClick');
  for (const [, obj] of objects) {
    sceneHandle.handGroup.remove(obj);
    sceneHandle.playGroup.remove(obj);
    obj.dispose();
  }
  objects.clear();
  handOrder = [];
  state.reset();
  reflowHand(0.6);
  updateHud();
});
overlayRestart.addEventListener('click', () => btnReset.click());

// Mute toggle (persisted via AudioManager → localStorage)
const muteBtn = document.getElementById('btn-mute') as HTMLButtonElement | null;
if (muteBtn) {
  const refreshMute = (m: boolean) => {
    muteBtn.textContent = m ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  };
  refreshMute(audio.isMuted());
  audio.onMutedChange(refreshMute);
  muteBtn.addEventListener('click', () => {
    audio.toggleMute();
    if (!audio.isMuted()) audio.play('buttonClick');
  });
}

attachInteraction({
  renderer: sceneHandle.renderer,
  camera: sceneHandle.camera,
  handGroup: sceneHandle.handGroup,
  getHandObjects: getOrderedHand,
  onToggleSelect: (id) => {
    state.toggleSelect(id);
    return state.selected.has(id);
  },
  onReorder: (ids) => { handOrder = ids; },
});

state.subscribe(() => updateHud());
reflowHand(0.6);
updateHud();
