// Bootstrap: glue GameState -> Three.js scene -> Interaction -> HUD.
// Renders cards as CardObjects, animates them on every state change, and
// shows an animated Chips x Mult readout when a hand is scored.

import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';

import { GameState, MAX_CONSUMABLES, MAX_JOKERS } from './game/gameState';
import { evaluateHand } from './game/pokerEngine';
import type { ConsumableCard, InputAction, JokerCard, PlayingCard, RunSnapshot, ScoreBreakdown, ShopItem } from './game/types';
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
      buyOffer: (index?: number) => boolean;
      rerollShop: () => boolean;
      continueShop: () => boolean;
      sellJoker: (index?: number) => boolean;
      sellConsumable: (index?: number) => boolean;
      useConsumable: (index?: number) => boolean;
      restart: () => void;
      dispose: () => void;
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
const popupTotal = $('popup-total');
const overlay = $('overlay');
const overlayTitle = $('overlay-title');
const overlaySub = $('overlay-sub');
const shopOverlay = $('shop-overlay');
const shopPanel = $('shop-panel');
const shopOffersEl = $('shop-offers');
const shopInventoryEl = $('shop-inventory');
const shopMoneyEl = $('shop-money');
const shopNextBlindEl = $('shop-next-blind');
const shopRerollCostEl = $('shop-reroll-cost');
const btnShopReroll = $<HTMLButtonElement>('btn-shop-reroll');
const btnShopNext = $<HTMLButtonElement>('btn-shop-next');

// ---------- Engine + Scene ----------
const state = new GameState();
const sceneHandle = createScene(host);

// CardObject pool keyed by card.id so visuals persist across state mutations.
const objects = new Map<string, CardObject>();
// While the end-of-hand scoring animation is running we suppress the
// game-over / win overlay so the player can see the score tally first.
let suppressEndOverlay = false;
let suppressShopOverlay = false;
// Keep the round score readout visually frozen during score tally animation.
let isRoundScoreAnimating = false;
let frozenRoundScore: number | null = null;
// Lock that prevents card selection and new play/discard actions while a
// hand or discard animation is in flight. Cleared once reflowHand is called
// and new cards are visible so the player can interact again.
let isAnimating = false;

function panFromX(x: number): number {
  return Math.max(-0.7, Math.min(0.7, x / 4.5));
}

function getOrCreateObject(card: PlayingCard): CardObject {
  let obj = objects.get(card.id);
  if (!obj) {
    obj = new CardObject(card);
    sceneHandle.handGroup.add(obj);
    obj.position.set(6, -2, 1); // spawn from the deck side and fly in
    obj.rotation.y = Math.PI;   // start back-facing
    objects.set(card.id, obj);
    audio.play('deal', {
      volume: 0.27,
      detune: (Math.random() - 0.5) * 180,
      pitch: 0.94 + Math.random() * 0.12,
      pan: (Math.random() - 0.5) * 0.5,
    });
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
function shortName(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function renderInventorySlots() {
  jokerSlotsEl.innerHTML = '';
  for (let i = 0; i < MAX_JOKERS; i++) {
    const slot = document.createElement('div');
    const joker = state.jokers[i];
    slot.className = `joker-slot${joker ? ' filled' : ''}`;
    if (joker) {
      slot.dataset.jokerId = joker.id;
      slot.textContent = shortName(joker.name);
      slot.title = `${joker.name} - ${joker.description}`;
    }
    jokerSlotsEl.appendChild(slot);
  }

  consumableSlotsEl.innerHTML = '';
  for (let i = 0; i < MAX_CONSUMABLES; i++) {
    const slot = document.createElement('div');
    const consumable = state.consumables[i];
    slot.className = `consumable-slot${consumable ? ' filled' : ''}`;
    if (consumable) {
      slot.dataset.consumableId = consumable.id;
      slot.textContent = shortName(consumable.name);
      slot.title = `${consumable.name} - ${consumable.description}`;
    }
    consumableSlotsEl.appendChild(slot);
  }
}
renderInventorySlots();

const BLIND_LABELS = ['Small Blind', 'Big Blind', 'Boss Blind'] as const;
const BLIND_BADGE_TEXT = ['SMALL<br/>BLIND', 'BIG<br/>BLIND', 'BOSS'] as const;
const BLIND_KIND = ['small', 'big', 'boss'] as const;
const BLIND_REWARD = ['$', '$$', '$$$$$'] as const;

function shopItemName(item: ShopItem): string {
  if (item.kind === 'joker') return item.joker.name;
  if (item.kind === 'consumable') return item.consumable.name;
  return item.name;
}

function shopItemDescription(item: ShopItem): string {
  if (item.kind === 'joker') return item.joker.description;
  if (item.kind === 'consumable') return item.consumable.description;
  return item.description;
}

function shopItemPrice(item: ShopItem): number {
  if (item.kind === 'joker') return item.joker.price;
  if (item.kind === 'consumable') return item.consumable.price;
  return item.price;
}

function shopItemKindLabel(item: ShopItem): string {
  if (item.kind === 'playing-card') return 'Deck Card';
  return item.kind;
}

function renderShopCardInventory<T extends JokerCard | ConsumableCard>(
  cards: T[],
  max: number,
  type: 'joker' | 'consumable',
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'shop-inventory-group';

  const heading = document.createElement('div');
  heading.className = 'shop-inventory-title';
  heading.textContent = `${type === 'joker' ? 'Jokers' : 'Consumables'} ${cards.length}/${max}`;
  wrap.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'shop-inventory-list';
  for (let i = 0; i < max; i++) {
    const card = cards[i];
    const row = document.createElement('div');
    row.className = `shop-inventory-row${card ? ' filled' : ''}`;
    if (!card) {
      row.textContent = 'Empty slot';
      list.appendChild(row);
      continue;
    }

    const copy = document.createElement('div');
    copy.className = 'shop-inventory-copy';
    copy.innerHTML = `<strong>${card.name}</strong><span>${card.description}</span>`;
    row.appendChild(copy);

    if (type === 'consumable') {
      const use = document.createElement('button');
      use.className = 'shop-mini-btn use';
      use.textContent = 'Use';
      use.addEventListener('click', () => {
        if (state.useConsumable(card.id)) {
          audio.play('chaching');
          updateHud();
        }
      });
      row.appendChild(use);
    }

    const sell = document.createElement('button');
    sell.className = 'shop-mini-btn';
    sell.textContent = `Sell $${card.sellValue}`;
    sell.addEventListener('click', () => {
      const ok = type === 'joker'
        ? state.sellJoker(card.id)
        : state.sellConsumable(card.id);
      if (ok) {
        audio.play('buttonClick');
        updateHud();
      }
    });
    row.appendChild(sell);
    list.appendChild(row);
  }

  wrap.appendChild(list);
  return wrap;
}

function setShopVisible(visible: boolean) {
  const wasHidden = shopOverlay.classList.contains('hidden');
  if (visible) {
    shopOverlay.classList.remove('hidden');
    if (wasHidden) {
      shopOverlay.style.opacity = '1';
      gsap.fromTo(shopOverlay, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      gsap.fromTo(shopPanel, { y: 24, scale: 0.96 }, { y: 0, scale: 1, duration: 0.38, ease: 'back.out(1.4)' });
      audio.play('chaching', { volume: 0.35 });
    }
  } else {
    shopOverlay.classList.add('hidden');
  }
}

function renderShop() {
  const visible = state.phase === 'shop' && Boolean(state.shop) && !suppressShopOverlay;
  setShopVisible(visible);
  if (!visible || !state.shop) return;

  shopMoneyEl.textContent = `$${state.money}`;
  shopNextBlindEl.textContent = BLIND_LABELS[state.blindIndex];
  shopRerollCostEl.textContent = `$${state.shop.rerollCost}`;
  btnShopReroll.disabled = state.money < state.shop.rerollCost;

  shopOffersEl.innerHTML = '';
  state.shop.offers.forEach((offer, index) => {
    const card = document.createElement('article');
    const canBuy = state.canBuyOffer(offer.id);
    card.className = `shop-offer ${offer.item.kind}${offer.sold ? ' sold' : ''}`;

    const kind = document.createElement('div');
    kind.className = 'shop-offer-kind';
    kind.textContent = shopItemKindLabel(offer.item);
    card.appendChild(kind);

    const name = document.createElement('h3');
    name.textContent = shopItemName(offer.item);
    card.appendChild(name);

    const desc = document.createElement('p');
    desc.textContent = shopItemDescription(offer.item);
    card.appendChild(desc);

    const buy = document.createElement('button');
    buy.className = 'shop-buy-btn';
    buy.dataset.testid = `shop-buy-${index}`;
    buy.disabled = offer.sold || !canBuy;
    buy.textContent = offer.sold ? 'Sold' : `Buy $${shopItemPrice(offer.item)}`;
    buy.addEventListener('click', () => {
      if (state.buyOffer(offer.id)) {
        audio.play('chaching');
        gsap.fromTo(card, { scale: 1 }, { scale: 1.04, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' });
        updateHud();
      }
    });
    card.appendChild(buy);

    shopOffersEl.appendChild(card);
  });

  shopInventoryEl.innerHTML = '';
  shopInventoryEl.appendChild(renderShopCardInventory(state.jokers, MAX_JOKERS, 'joker'));
  shopInventoryEl.appendChild(renderShopCardInventory(state.consumables, MAX_CONSUMABLES, 'consumable'));
}

function updateHud() {
  renderInventorySlots();
  const idx = state.blindIndex;
  blindName.textContent = BLIND_LABELS[idx];
  blindBadge.className = `blind-badge ${BLIND_KIND[idx]}`;
  const badgeText = blindBadge.querySelector('span');
  if (badgeText) badgeText.innerHTML = BLIND_BADGE_TEXT[idx];

  blindTarget.textContent = state.target.toLocaleString();
  blindReward.textContent = BLIND_REWARD[idx];
  const shownRoundScore = isRoundScoreAnimating ? (frozenRoundScore ?? state.roundScore) : state.roundScore;
  roundScoreEl.textContent = shownRoundScore.toLocaleString();
  anteEl.innerHTML = `${state.ante}<span class="counter-total">/8</span>`;
  const roundNumber = (state.ante - 1) * 3 + state.blindIndex + 1;
  roundEl.textContent = String(roundNumber);
  moneyEl.textContent = `$${state.money}`;
  handsLeftEl.textContent = `${state.handsLeft}`;
  discardsLeftEl.textContent = `${state.discardsLeft}`;
  seedEl.textContent = String(state.config.seed);

  handCounterEl.textContent = `${state.hand.length}/${state.config.handSize}`;
  deckCounterEl.textContent = `${state.deck.length}/${state.ownedDeck.length}`;
  sceneHandle.setDeckCount(state.deck.length);

  jokerCountEl.textContent = `${state.jokers.length}/${MAX_JOKERS}`;
  consumableCountEl.textContent = `${state.consumables.length}/${MAX_CONSUMABLES}`;

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

  btnPlay.disabled = isAnimating || !state.canPlay();
  btnDiscard.disabled = isAnimating || !state.canDiscard();

  if ((state.phase === 'game-over' || state.phase === 'win') && !suppressEndOverlay) {
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
  renderShop();
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
  // Seed sidebar chips/mult with the base values so the counter animates there.
  chipsEl.textContent = Math.round(br.baseChips).toLocaleString();
  multEl.textContent = Math.round(br.baseMult).toLocaleString();
  popupTotal.textContent = '0';

  gsap.fromTo(
    popup,
    { scale: 0.7, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
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

// Floating value above a scoring card. Projects the card's world position to
// screen space, then spawns DOM labels that pop in, drift up, and fade out.
function spawnCardScoreFloat(
  obj: CardObject,
  deltas: { chipsDelta: number; multDelta: number; multMul: number },
) {
  const labels: { text: string; cls: string }[] = [];
  if (deltas.chipsDelta !== 0) {
    labels.push({ text: `+${Math.round(deltas.chipsDelta)}`, cls: 'is-chips' });
  }
  if (deltas.multDelta !== 0) {
    labels.push({ text: `+${Math.round(deltas.multDelta)} Mult`, cls: 'is-mult-add' });
  }
  if (deltas.multMul !== 1) {
    const m = Number.isInteger(deltas.multMul) ? deltas.multMul.toString() : deltas.multMul.toFixed(1);
    labels.push({ text: `×${m} Mult`, cls: 'is-mult-mul' });
  }
  if (labels.length === 0) return;

  // Project card top in world space → screen pixels inside #canvas-host.
  const worldPos = new THREE.Vector3();
  obj.getWorldPosition(worldPos);
  worldPos.y += 1.1; // anchor above the card top edge
  const projected = worldPos.project(sceneHandle.camera);
  const rect = host.getBoundingClientRect();
  const x = ((projected.x + 1) / 2) * rect.width;
  const y = ((1 - projected.y) / 2) * rect.height;

  labels.forEach((label, i) => {
    const el = document.createElement('div');
    el.className = `card-score-float ${label.cls}`;
    el.textContent = label.text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = '0';
    host.appendChild(el);

    const delay = i * 0.08;
    const drift = 28 + i * 6;
    gsap.fromTo(
      el,
      { opacity: 0, y: 6, scale: 0.6 },
      {
        opacity: 1,
        y: 0,
        scale: 1.1,
        duration: 0.22,
        delay,
        ease: 'back.out(2.2)',
      },
    );
    gsap.to(el, {
      y: -drift,
      scale: 1,
      duration: 0.9,
      delay: delay + 0.22,
      ease: 'sine.out',
    });
    gsap.to(el, {
      opacity: 0,
      duration: 0.45,
      delay: delay + 0.7,
      ease: 'power1.in',
      onComplete: () => el.remove(),
    });
  });
}

// Float a label above an arbitrary DOM element (used for joker slots so the
// scoring animation can read like a Balatro tally bar). Uses fixed positioning
// so it works regardless of the slot's container/overflow.
function spawnSlotScoreFloat(
  slot: HTMLElement,
  labels: { text: string; cls: string }[],
) {
  if (labels.length === 0) return;
  const rect = slot.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height * 0.25;

  labels.forEach((label, i) => {
    const el = document.createElement('div');
    el.className = `card-score-float ${label.cls}`;
    el.textContent = label.text;
    el.style.position = 'fixed';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = '0';
    el.style.zIndex = '60';
    document.body.appendChild(el);

    const delay = i * 0.08;
    const drift = 32 + i * 6;
    gsap.fromTo(
      el,
      { opacity: 0, y: 6, scale: 0.6 },
      { opacity: 1, y: 0, scale: 1.1, duration: 0.22, delay, ease: 'back.out(2.2)' },
    );
    gsap.to(el, { y: -drift, scale: 1, duration: 0.9, delay: delay + 0.22, ease: 'sine.out' });
    gsap.to(el, {
      opacity: 0,
      duration: 0.45,
      delay: delay + 0.7,
      ease: 'power1.in',
      onComplete: () => el.remove(),
    });
  });
}

function labelsForJokerStep(step: { chipsDelta?: number; multDelta?: number; multMul?: number }) {
  const labels: { text: string; cls: string }[] = [];
  if (step.chipsDelta) {
    labels.push({ text: `+${Math.round(step.chipsDelta)}`, cls: 'is-chips' });
  }
  if (step.multDelta) {
    labels.push({ text: `+${Math.round(step.multDelta)} Mult`, cls: 'is-mult-add' });
  }
  if (step.multMul && step.multMul !== 1) {
    const m = Number.isInteger(step.multMul) ? step.multMul.toString() : step.multMul.toFixed(1);
    labels.push({ text: `×${m} Mult`, cls: 'is-mult-mul' });
  }
  return labels;
}

// ---------- Actions ----------
function dispatchAction(action: InputAction, payload?: { cardId?: string }): boolean | void {
  if (action === 'select_card') {
    if (isAnimating) return false;
    if (!payload?.cardId) return false;
    return state.toggleSelect(payload.cardId);
  }
  if (action === 'play_hand') {
    if (isAnimating || !state.canPlay()) return;
    audio.play('buttonClick');
    void playSelected();
    return;
  }
  if (action === 'discard') {
    if (isAnimating || !state.canDiscard()) return;
    audio.play('buttonClick');
    void discardSelected();
    return;
  }
  if (action === 'continue_shop') {
    continueFromShop();
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
}

async function playSelected() {
  if (!state.canPlay()) return;
  const playedCards = state.selectedCards();
  if (playedCards.length === 0) return;

  isAnimating = true;

  // Freeze the round score display so state updates don't reveal the final
  // total before the card-by-card tally animation is complete.
  isRoundScoreAnimating = true;
  frozenRoundScore = state.roundScore;

  const playSlots = layoutPlay(playedCards.length);
  audio.play('whoosh');
  const worldPos = new THREE.Vector3();
  playedCards.forEach((card, i) => {
    const obj = objects.get(card.id);
    if (!obj) return;
    obj.userData.keepAlive = true;

    // Preserve world position across the reparent so the card doesn't snap
    // upward (handGroup y=-0.9 vs playGroup y=0.4) before the tween starts.
    obj.getWorldPosition(worldPos);
    sceneHandle.handGroup.remove(obj);
    sceneHandle.playGroup.add(obj);
    sceneHandle.playGroup.worldToLocal(worldPos);
    obj.position.copy(worldPos);

    // Drop the selection glow (moveTo already animates to the unselected pose,
    // so we only need the glow fade-out here — no conflicting y/z tween).
    obj.setSelected(false);
    obj.moveTo(playSlots[i], 0.55, i * 0.07);
  });

  await new Promise((resolve) => setTimeout(resolve, 650));

  // Suppress the end-of-run overlay *before* applying the play, because
  // state.playSelected() synchronously notifies subscribers (which call
  // updateHud) — if the phase flips to game-over/win during that callback
  // and the flag isn't set yet, the overlay would briefly appear and the
  // win/lose sound would fire twice (once here, once after the scoring
  // animation finishes).
  suppressEndOverlay = true;
  suppressShopOverlay = true;
  const br = state.playSelected();
  if (!br) {
    suppressEndOverlay = false;
    suppressShopOverlay = false;
    isRoundScoreAnimating = false;
    frozenRoundScore = null;
    isAnimating = false;
    return;
  }

  // If this play ended the run, keep the overlay hidden until the score
  // animation finishes so the player sees the chips x mult tally first.
  const endsRun = state.phase === 'game-over' || state.phase === 'win';
  const entersShop = state.phase === 'shop';
  if (endsRun) {
    overlay.classList.add('hidden');
  } else if (entersShop) {
    shopOverlay.classList.add('hidden');
    suppressEndOverlay = false;
  } else {
    suppressEndOverlay = false;
    suppressShopOverlay = false;
  }

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
        spawnCardScoreFloat(obj, delta);
        audio.play('chipTick', { volume: 0.24, pitch: 1 + idx * 0.08, pan: panFromX(obj.position.x) });

        if (delta.chipsDelta !== 0) {
          tweenNumber(chipsEl, chipsFrom, chipsTo, 0.25, 'chipTick');
          gsap.fromTo(chipsEl, { scale: 1 }, { scale: 1.18, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' });
        }
        if (delta.multDelta !== 0 || delta.multMul !== 1) {
          tweenNumber(multEl, Math.round(multFrom), Math.round(multTo), 0.25, 'multTick');
          gsap.fromTo(multEl, { scale: 1 }, { scale: 1.22, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
        }
      });
    } else {
      const material = obj.faceMesh.material as THREE.MeshStandardMaterial;
      material.transparent = true;
      gsap.to(material, { opacity: 0.5, duration: 0.2 });
    }
  }

  const cardsEndAt = firstDelay + Math.max(0, scoringIndex - 1) * stagger + 0.4;
  const jokerSteps = br.steps.filter((step) => step.jokerId);
  const jokerStagger = 0.34;

  jokerSteps.forEach((step, idx) => {
    const slot = jokerSlotsEl.querySelector<HTMLElement>(`[data-joker-id="${step.jokerId}"]`);
    const delay = cardsEndAt + idx * jokerStagger;

    const chipsFrom = runningChips;
    const multFrom = runningMult;
    if (step.chipsDelta) runningChips += step.chipsDelta;
    if (step.multDelta) runningMult += step.multDelta;
    if (step.multMul) runningMult *= step.multMul;
    const chipsTo = runningChips;
    const multTo = runningMult;

    gsap.delayedCall(delay, () => {
      if (slot) {
        gsap.fromTo(
          slot,
          { scale: 1, y: 0 },
          { scale: 1.18, y: -8, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' },
        );
        spawnSlotScoreFloat(slot, labelsForJokerStep(step));
      }
      audio.play('chipTick', { volume: 0.28, pitch: 1.1 + idx * 0.08 });

      if (step.chipsDelta) {
        tweenNumber(chipsEl, chipsFrom, chipsTo, 0.28, 'chipTick');
        gsap.fromTo(chipsEl, { scale: 1 }, { scale: 1.2, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
      }
      if (step.multDelta || step.multMul) {
        tweenNumber(multEl, Math.round(multFrom), Math.round(multTo), 0.28, 'multTick');
        gsap.fromTo(multEl, { scale: 1 }, { scale: 1.25, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' });
      }
    });
  });

  const jokersEndAt = jokerSteps.length > 0
    ? cardsEndAt + (jokerSteps.length - 1) * jokerStagger + 0.4
    : cardsEndAt + 0.15;
  const totalAt = jokersEndAt;
  gsap.delayedCall(totalAt, () => revealScoreTotal(br));

  const prev = state.roundScore - br.total;
  gsap.delayedCall(totalAt + 0.05, () => {
    tweenNumber(roundScoreEl, prev, state.roundScore, 1.0, 'chipTick');
    gsap.fromTo(roundScoreEl, { scale: 1 }, { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
  });

  gsap.delayedCall(totalAt + 1.2, () => {
    isRoundScoreAnimating = false;
    frozenRoundScore = null;

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
    isAnimating = false;
    reflowHand(0.5);
    updateHud();
    if (endsRun) {
      suppressEndOverlay = false;
      updateHud();
    } else if (entersShop) {
      suppressShopOverlay = false;
      updateHud();
    }
  });
}

async function discardSelected() {
  if (!state.canDiscard()) return;
  isAnimating = true;
  const cards = state.selectedCards();
  const avgX = cards.reduce((sum, card) => sum + (objects.get(card.id)?.position.x ?? 0), 0) / Math.max(1, cards.length);
  audio.play('sweep', { pan: panFromX(avgX) });
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
  gsap.delayedCall(0.55, () => {
    isAnimating = false;
    reflowHand(0.45);
  });
}

function continueFromShop() {
  if (state.phase !== 'shop') return false;
  audio.play('buttonClick');
  btnShopNext.disabled = true;
  btnShopReroll.disabled = true;
  gsap.to(shopPanel, { y: -18, scale: 0.97, duration: 0.2, ease: 'power2.in' });
  gsap.to(shopOverlay, {
    opacity: 0,
    duration: 0.28,
    ease: 'power2.inOut',
    onComplete: () => {
      shopOverlay.classList.add('hidden');
      shopOverlay.style.opacity = '';
      shopPanel.style.transform = '';
      state.continueFromShop();
      reflowHand(0.65);
      updateHud();
      btnShopNext.disabled = false;
    },
  });
  return true;
}

// ---------- Wire up ----------
function resetRun() {
  audio.play('buttonClick');
  isRoundScoreAnimating = false;
  frozenRoundScore = null;
  suppressShopOverlay = false;
  suppressEndOverlay = false;
  shopOverlay.classList.add('hidden');
  shopOverlay.style.opacity = '';
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

btnShopReroll.addEventListener('click', () => {
  if (state.rerollShop()) {
    audio.play('sweep');
    gsap.fromTo(shopOffersEl, { opacity: 0.55, y: 8 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' });
    updateHud();
  }
});

btnShopNext.addEventListener('click', () => {
  dispatchAction('continue_shop');
});

const muteBtn = maybe<HTMLButtonElement>('btn-mute');
if (muteBtn) {
  const refreshMute = (muted: boolean) => {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  };
  refreshMute(audio.isMuted());
  audio.onMutedChange(refreshMute);
}

const musicMuteBtn = maybe<HTMLButtonElement>('btn-music-mute');
if (musicMuteBtn) {
  const refreshMusicMute = (muted: boolean) => {
    musicMuteBtn.textContent = muted ? '🔇' : '🎵';
    musicMuteBtn.setAttribute('aria-label', muted ? 'Unmute Music' : 'Mute Music');
  };
  refreshMusicMute(audio.isMusicMuted());
  musicMuteBtn.addEventListener('click', () => audio.toggleMusicMute());
  audio.onMusicMutedChange(refreshMusicMute);
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

state.subscribe(() => {
  updateHud();
});

window.__OPEN_POKER_TEST__ = {
  snapshot: () => state.toSnapshot(),
  loadSnapshot: (snapshot: RunSnapshot) => {
    isRoundScoreAnimating = false;
    frozenRoundScore = null;
    suppressShopOverlay = false;
    suppressEndOverlay = false;
    state.reset(snapshot);
    handOrder = snapshot.hand.map((card) => card.id);
    reflowHand(0);
    updateHud();
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
  buyOffer: (index = 0) => {
    const offer = state.shop?.offers[index];
    return offer ? state.buyOffer(offer.id) : false;
  },
  rerollShop: () => state.rerollShop(),
  continueShop: () => {
    const ok = state.continueFromShop();
    if (ok) {
      reflowHand(0);
      updateHud();
    }
    return ok;
  },
  sellJoker: (index = 0) => {
    const joker = state.jokers[index];
    return joker ? state.sellJoker(joker.id) : false;
  },
  sellConsumable: (index = 0) => {
    const consumable = state.consumables[index];
    return consumable ? state.sellConsumable(consumable.id) : false;
  },
  useConsumable: (index = 0) => {
    const consumable = state.consumables[index];
    return consumable ? state.useConsumable(consumable.id) : false;
  },
  restart: () => {
    dispatchAction('restart_run');
  },
  dispose: () => {
    gsap.globalTimeline.clear();
    sceneHandle.dispose();
    audio.dispose();
  },
};

reflowHand(0.6);
updateHud();
