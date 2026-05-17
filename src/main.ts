// Bootstrap: glue GameState -> Three.js scene -> Interaction -> HUD.
// Renders cards as CardObjects, animates them on every state change, and
// shows an animated Chips x Mult readout when a hand is scored.

import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';

import { GameState } from './game/gameState';
import { evaluateHand } from './game/pokerEngine';
import type { InputAction, PlayingCard, RunSnapshot, ScoreBreakdown } from './game/types';
import { createScene, layoutHand, layoutPlay } from './render/ThreeScene';
import { CardObject } from './render/CardObject';
import { attachInteraction } from './render/Interaction';
import { audio } from './audio/AudioManager';
import { actionFromKeyboard, UI_ACTION_BINDINGS } from './input/actions';

declare global {
  interface Window {
    __OPEN_POKER_TEST__?: {
      snapshot: () => RunSnapshot;
      loadSnapshot: (snapshot: RunSnapshot) => void;
      selectFirst: (count?: number) => void;
      play: () => void;
      discard: () => void;
      restart: () => void;
      toggleDebug: () => void;
    };
  }
}

// ---------- DOM refs ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const maybe = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

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
const popup = $('score-popup');
const popupHand = $('popup-hand');
const popupChips = $('popup-chips');
const popupMult = $('popup-mult');
const popupTotal = $('popup-total');
const overlay = $('overlay');
const overlayTitle = $('overlay-title');
const overlaySub = $('overlay-sub');
const debugOverlay = maybe('debug-overlay');
const debugContent = maybe('debug-content');
const debugToggleBtn = maybe<HTMLButtonElement>('btn-debug');

// ---------- Engine + Scene ----------
const state = new GameState();
const sceneHandle = createScene(host);

// CardObject pool keyed by card.id so visuals persist across state mutations.
const objects = new Map<string, CardObject>();
let debugVisible = false;
let fpsEstimate = 0;

function getOrCreateObject(card: PlayingCard): CardObject {
  let obj = objects.get(card.id);
  if (!obj) {
    obj = new CardObject(card);
    sceneHandle.handGroup.add(obj);
    obj.position.set(6, -2, 1); // spawn from the deck side and fly in
    obj.rotation.y = Math.PI;   // start back-facing
    objects.set(card.id, obj);
    audio.play('deal', { volume: 0.28, detune: (Math.random() - 0.5) * 200, pitch: 0.95 + Math.random() * 0.1 });
    gsap.to(obj.rotation, { y: 0, duration: 0.5, delay: 0.05, ease: 'power3.out' });
  }
  return obj;
}

// Renderer-side ordering: we keep a manual list so drag-reorder works smoothly
// without fighting GameState (which does not care about visual order).
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

  // Dispose objects no longer in the hand and not protected mid-play.
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
    const slot = document.createElement('div');
    slot.className = 'joker-slot';
    jokerSlotsEl.appendChild(slot);
  }

  consumableSlotsEl.innerHTML = '';
  for (let i = 0; i < MAX_CONSUMABLES; i++) {
    const slot = document.createElement('div');
    slot.className = 'consumable-slot';
    consumableSlotsEl.appendChild(slot);
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
  const badgeText = blindBadge.querySelector('span');
  if (badgeText) badgeText.innerHTML = BLIND_BADGE_TEXT[idx];

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

  handCounterEl.textContent = `${state.hand.length}/${state.config.handSize}`;
  deckCounterEl.textContent = `${state.deck.length}/52`;
  sceneHandle.setDeckCount(state.deck.length);

  // Placeholder counters for future systems.
  jokerCountEl.textContent = `0/${MAX_JOKERS}`;
  consumableCountEl.textContent = `0/${MAX_CONSUMABLES}`;

  const selected = state.selectedCards();
  if (selected.length === 0) {
    handTypeEl.textContent = '-';
    chipsEl.textContent = '0';
    multEl.textContent = '0';
  } else {
    const evaluated = evaluateHand(selected);
    const level = state.handLevels[evaluated.type];
    handTypeEl.textContent = `${evaluated.type} (lvl ${level.level})`;
    chipsEl.textContent = `${level.chips}`;
    multEl.textContent = `${level.mult}`;
  }

  btnPlay.disabled = !state.canPlay();
  btnDiscard.disabled = !state.canDiscard();

  if (state.phase === 'game-over' || state.phase === 'win') {
    const wasHidden = overlay.classList.contains('hidden');
    overlay.classList.remove('hidden');
    overlayTitle.textContent = state.phase === 'win' ? 'You Win!' : 'Game Over';
    overlaySub.textContent = state.phase === 'win'
      ? `Ante ${state.ante - 1} cleared on seed ${state.config.seed}`
      : `Could not beat ${BLIND_LABELS[idx]} - score ${state.roundScore.toLocaleString()} / ${state.target.toLocaleString()}`;
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
  const value = { v: from };
  let lastSoundAt = from;
  const step = Math.max(1, Math.floor((to - from) / 18));
  gsap.to(value, {
    v: to,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      const next = value.v;
      el.textContent = Math.round(next).toLocaleString();
      if (tickName && next - lastSoundAt >= step) {
        lastSoundAt = next;
        audio.play(tickName, { volume: 0.12, detune: (Math.random() - 0.5) * 250 });
      }
    },
  });
}

function showScorePopup(br: ScoreBreakdown) {
  popup.classList.remove('hidden');
  popupHand.textContent = `${br.hand.type}`;
  popupChips.textContent = Math.round(br.baseChips).toLocaleString();
  popupMult.textContent = Math.round(br.baseMult).toLocaleString();
  popupTotal.textContent = '0';

  gsap.fromTo(
    popup,
    { scale: 0.5, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' },
  );
  gsap.fromTo(popupHand, { scale: 0.7 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
  audio.play('scorePop');
}

function revealScoreTotal(br: ScoreBreakdown) {
  tweenNumber(popupTotal, 0, br.total, 0.8);
  gsap.fromTo(popupTotal, { scale: 0.6 }, { scale: 1.2, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' });
  audio.play('chaching');
  const intensity = Math.max(0.08, Math.min(0.6, (br.total / Math.max(1, state.target)) * 0.5));
  sceneHandle.shake(intensity, 0.45);

  gsap.delayedCall(1.5, () => {
    gsap.to(popup, { opacity: 0, duration: 0.4, onComplete: () => popup.classList.add('hidden') });
  });
}

function cardScoreDeltas(card: PlayingCard): { chipsDelta: number; multDelta: number; multMul: number } {
  if (card.enhancement === 'stone') return { chipsDelta: 50, multDelta: 0, multMul: 1 };

  let chipsDelta = card.baseChips;
  let multDelta = 0;
  let multMul = 1;

  if (card.enhancement === 'bonus') chipsDelta += 30;
  else if (card.enhancement === 'mult') multDelta += 4;
  else if (card.enhancement === 'glass') multMul *= 2;

  if (card.edition === 'foil') chipsDelta += 50;
  else if (card.edition === 'holographic') multDelta += 10;
  else if (card.edition === 'polychrome') multMul *= 1.5;

  return { chipsDelta, multDelta, multMul };
}

function setDebugVisible(next: boolean) {
  debugVisible = next;
  if (!debugOverlay || !debugToggleBtn) return;
  debugOverlay.classList.toggle('hidden', !debugVisible);
  debugToggleBtn.setAttribute('aria-pressed', debugVisible ? 'true' : 'false');
}

function toggleDebugOverlay() {
  setDebugVisible(!debugVisible);
  updateDebugOverlay(true);
}

function updateDebugOverlay(force = false) {
  if (!debugOverlay || !debugContent) return;
  if (!debugVisible && !force) return;

  const metrics = sceneHandle.getMetrics();
  const snapshot = state.toSnapshot();
  const blindLabels = ['Small', 'Big', 'Boss'] as const;

  const lines = [
    `seed=${snapshot.config.seed} phase=${snapshot.phase}`,
    `blind=${blindLabels[snapshot.blindIndex]} ante=${snapshot.ante}`,
    `score=${snapshot.roundScore}/${snapshot.target} money=$${snapshot.money}`,
    `hand=${snapshot.hand.length}/${snapshot.config.handSize} selected=${snapshot.selected.length} deck=${snapshot.deck.length} discard=${snapshot.discardPile.length}`,
    `handsLeft=${snapshot.handsLeft} discardsLeft=${snapshot.discardsLeft} rngDraws=${snapshot.rngDrawCount}`,
    `fps~=${fpsEstimate.toFixed(1)} calls=${metrics.calls} tris=${metrics.triangles} frame=${metrics.frame}`,
  ];
  debugContent.textContent = lines.join('\n');
}

// ---------- Actions ----------
function dispatchAction(action: InputAction, payload?: { cardId?: string }): boolean | void {
  if (action === 'select_card') {
    if (!payload?.cardId) return false;
    return state.toggleSelect(payload.cardId);
  }
  if (action === 'play_hand') {
    if (!state.canPlay()) return;
    audio.play('buttonClick');
    void playSelected();
    return;
  }
  if (action === 'discard') {
    if (!state.canDiscard()) return;
    audio.play('buttonClick');
    void discardSelected();
    return;
  }
  if (action === 'restart_run') {
    resetRun();
    return;
  }
  if (action === 'toggle_mute') {
    audio.toggleMute();
    if (!audio.isMuted()) audio.play('buttonClick');
    return;
  }
  if (action === 'toggle_debug') {
    toggleDebugOverlay();
  }
}

async function playSelected() {
  if (!state.canPlay()) return;
  const playedCards = state.selectedCards();
  if (playedCards.length === 0) return;

  const playSlots = layoutPlay(playedCards.length);
  audio.play('whoosh');
  playedCards.forEach((card, i) => {
    const obj = objects.get(card.id);
    if (!obj) return;
    obj.userData.keepAlive = true;
    sceneHandle.handGroup.remove(obj);
    sceneHandle.playGroup.add(obj);
    obj.setSelected(false);
    obj.moveTo(playSlots[i], 0.4, i * 0.06);
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const br = state.playSelected();
  if (!br) return;

  showScorePopup(br);

  const scoringIds = new Set(br.hand.scoringCards.map((c) => c.id));
  let scoringIndex = 0;
  let runningChips = br.baseChips;
  let runningMult = br.baseMult;
  const stagger = 0.28;
  const firstDelay = 0.15;

  for (const card of playedCards) {
    const obj = objects.get(card.id);
    if (!obj) continue;

    if (scoringIds.has(card.id)) {
      const idx = scoringIndex++;
      const delay = firstDelay + idx * stagger;
      const delta = cardScoreDeltas(card);
      const chipsFrom = runningChips;
      const multFrom = runningMult;
      runningChips += delta.chipsDelta;
      runningMult = (runningMult + delta.multDelta) * delta.multMul;
      const chipsTo = runningChips;
      const multTo = runningMult;

      gsap.delayedCall(delay, () => {
        obj.pulse(1.22, 0.4);
        obj.flash(0xffd24a, 0.5);
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

        if (delta.chipsDelta !== 0) {
          tweenNumber(popupChips, chipsFrom, chipsTo, 0.25, 'chipTick');
          gsap.fromTo(popupChips, { scale: 1 }, { scale: 1.18, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' });
        }
        if (delta.multDelta !== 0 || delta.multMul !== 1) {
          tweenNumber(popupMult, Math.round(multFrom), Math.round(multTo), 0.25, 'multTick');
          gsap.fromTo(popupMult, { scale: 1 }, { scale: 1.22, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
        }
      });
    } else {
      const material = obj.faceMesh.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      gsap.to(material, { opacity: 0.5, duration: 0.2 });
    }
  }

  const totalAt = firstDelay + Math.max(0, scoringIndex - 1) * stagger + 0.55;
  gsap.delayedCall(totalAt, () => revealScoreTotal(br));

  const prev = state.roundScore - br.total;
  gsap.delayedCall(totalAt + 0.05, () => {
    tweenNumber(roundScoreEl, prev, state.roundScore, 1.0, 'chipTick');
    gsap.fromTo(roundScoreEl, { scale: 1 }, { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
  });

  gsap.delayedCall(totalAt + 1.2, () => {
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
function resetRun() {
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
}

for (const [id, action] of Object.entries(UI_ACTION_BINDINGS)) {
  const el = maybe<HTMLButtonElement>(id);
  if (!el) continue;
  el.addEventListener('click', () => {
    dispatchAction(action);
  });
}

const muteBtn = maybe<HTMLButtonElement>('btn-mute');
if (muteBtn) {
  const refreshMute = (muted: boolean) => {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  };
  refreshMute(audio.isMuted());
  audio.onMutedChange(refreshMute);
}

if (debugToggleBtn) {
  debugToggleBtn.addEventListener('click', () => {
    dispatchAction('toggle_debug');
  });
}

window.addEventListener('keydown', (event) => {
  const action = actionFromKeyboard(event);
  if (!action) return;
  event.preventDefault();
  dispatchAction(action);
});

attachInteraction({
  renderer: sceneHandle.renderer,
  camera: sceneHandle.camera,
  handGroup: sceneHandle.handGroup,
  getHandObjects: getOrderedHand,
  onToggleSelect: (id) => Boolean(dispatchAction('select_card', { cardId: id })),
  onReorder: (ids) => { handOrder = ids; },
});

let lastFrameCount = sceneHandle.getMetrics().frame;
let lastFpsSampleAt = performance.now();
function tickDebugStats() {
  const now = performance.now();
  const elapsed = now - lastFpsSampleAt;
  if (elapsed >= 400) {
    const metrics = sceneHandle.getMetrics();
    const frameDelta = metrics.frame - lastFrameCount;
    fpsEstimate = (frameDelta * 1000) / elapsed;
    lastFrameCount = metrics.frame;
    lastFpsSampleAt = now;
    updateDebugOverlay();
  }
  window.requestAnimationFrame(tickDebugStats);
}
window.requestAnimationFrame(tickDebugStats);

state.subscribe(() => {
  updateHud();
  updateDebugOverlay();
});

window.__OPEN_POKER_TEST__ = {
  snapshot: () => state.toSnapshot(),
  loadSnapshot: (snapshot: RunSnapshot) => {
    state.reset(snapshot);
    handOrder = snapshot.hand.map((card) => card.id);
    reflowHand(0);
    updateHud();
    updateDebugOverlay(true);
  },
  selectFirst: (count = 1) => {
    const selectedIds = [...state.selected];
    for (const id of selectedIds) state.toggleSelect(id);
    for (const card of state.hand.slice(0, Math.max(0, Math.min(5, count)))) {
      if (!state.selected.has(card.id)) state.toggleSelect(card.id);
    }
  },
  play: () => {
    dispatchAction('play_hand');
  },
  discard: () => {
    dispatchAction('discard');
  },
  restart: () => {
    dispatchAction('restart_run');
  },
  toggleDebug: () => {
    dispatchAction('toggle_debug');
  },
};

reflowHand(0.6);
updateHud();
updateDebugOverlay(true);
