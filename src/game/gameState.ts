// Run-level state + small state machine. Kept renderer-agnostic.
// The renderer subscribes via simple callbacks for now; we can swap to a
// proper event bus once jokers/triggers are introduced.

import { buildStandardDeck, makeCard, makeRng, RANK_LABEL, RANKS, shuffle, SUITS } from './cards';
import { evaluateHand, scoreHand } from './pokerEngine';
import type {
  ConsumableCard,
  ConsumableEffect,
  Edition,
  Enhancement,
  HandLevel,
  JokerCard,
  JokerEffect,
  JokerRarity,
  PlayingCard,
  PokerHandType,
  RunPhase,
  RunSnapshot,
  RunSnapshotV1,
  RunSnapshotV2,
  ShopItem,
  ShopOffer,
  ShopState,
  ScoreBreakdown,
} from './types';
import { HAND_BASE } from './types';

export type Phase = RunPhase;

export interface BlindDef {
  name: string;
  mult: number;       // multiplier vs. ante base
  reward: number;     // $ on clear
  kind: 'small' | 'big' | 'boss';
}

export interface RunConfig {
  seed: number;
  handSize: number;       // cards dealt to hand
  handsPerRound: number;
  discardsPerRound: number;
  startingMoney: number;
}

export const DEFAULT_CONFIG: RunConfig = {
  seed: Math.floor(Math.random() * 1e9),
  handSize: 8,
  handsPerRound: 4,
  discardsPerRound: 3,
  startingMoney: 4,
};

// Ante base targets follow Balatro's curve approximately.
const ANTE_BASE: number[] = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
export const MAX_JOKERS = 5;
export const MAX_CONSUMABLES = 2;
const SHOP_REROLL_BASE_COST = 5;

interface JokerTemplate {
  key: string;
  name: string;
  description: string;
  rarity: JokerRarity;
  price: number;
  effect: JokerEffect;
}

interface ConsumableTemplate {
  key: string;
  name: string;
  description: string;
  type: ConsumableCard['type'];
  price: number;
  effect: ConsumableEffect;
}

const JOKER_TEMPLATES: JokerTemplate[] = [
  {
    key: 'chip-magnet',
    name: 'Chip Magnet',
    description: '+40 chips every hand.',
    rarity: 'common',
    price: 5,
    effect: { kind: 'chips', amount: 40 },
  },
  {
    key: 'red-mult',
    name: 'Red Mult',
    description: '+6 Mult every hand.',
    rarity: 'common',
    price: 5,
    effect: { kind: 'mult', amount: 6 },
  },
  {
    key: 'pair-trader',
    name: 'Pair Trader',
    description: '+12 Mult on Pair-family hands.',
    rarity: 'uncommon',
    price: 6,
    effect: { kind: 'pair-mult', amount: 12 },
  },
  {
    key: 'flush-spark',
    name: 'Flush Spark',
    description: 'x1.5 Mult on Flush hands.',
    rarity: 'rare',
    price: 7,
    effect: { kind: 'flush-mult-mul', amount: 1.5 },
  },
  {
    key: 'opening-act',
    name: 'Opening Act',
    description: '+80 chips on the first hand of a blind.',
    rarity: 'uncommon',
    price: 6,
    effect: { kind: 'first-hand-chips', amount: 80 },
  },
  {
    key: 'cashback',
    name: 'Cashback',
    description: '+$1 when a blind is cleared.',
    rarity: 'common',
    price: 5,
    effect: { kind: 'economy-clear', amount: 1 },
  },
];

const PLANET_HANDS: PokerHandType[] = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
];

const ENHANCEMENT_OFFERS: Enhancement[] = ['bonus', 'mult', 'wild', 'glass', 'steel', 'gold', 'lucky'];
const EDITION_OFFERS: Edition[] = ['foil', 'holographic', 'polychrome'];

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function cloneCard(card: PlayingCard): PlayingCard {
  return { ...card };
}

function cloneCards(cards: PlayingCard[]): PlayingCard[] {
  return cards.map(cloneCard);
}

function cloneJoker(joker: JokerCard): JokerCard {
  return { ...joker, effect: { ...joker.effect } };
}

function cloneJokers(jokers: JokerCard[]): JokerCard[] {
  return jokers.map(cloneJoker);
}

function cloneConsumable(consumable: ConsumableCard): ConsumableCard {
  return { ...consumable, effect: { ...consumable.effect } };
}

function cloneConsumables(consumables: ConsumableCard[]): ConsumableCard[] {
  return consumables.map(cloneConsumable);
}

function cloneShopItem(item: ShopItem): ShopItem {
  if (item.kind === 'joker') return { kind: 'joker', joker: cloneJoker(item.joker) };
  if (item.kind === 'consumable') return { kind: 'consumable', consumable: cloneConsumable(item.consumable) };
  return {
    kind: 'playing-card',
    card: cloneCard(item.card),
    name: item.name,
    description: item.description,
    price: item.price,
    sellValue: item.sellValue,
  };
}

function cloneShop(shop: ShopState | null): ShopState | null {
  if (!shop) return null;
  return {
    visit: shop.visit,
    rerolls: shop.rerolls,
    rerollCost: shop.rerollCost,
    offers: shop.offers.map((offer) => ({
      id: offer.id,
      sold: offer.sold,
      item: cloneShopItem(offer.item),
    })),
  };
}

function makeInitialHandLevels(): Record<PokerHandType, HandLevel> {
  return Object.fromEntries(
    (Object.keys(HAND_BASE) as PokerHandType[]).map((k) => [
      k,
      { level: 1, chips: HAND_BASE[k].chips, mult: HAND_BASE[k].mult },
    ]),
  ) as Record<PokerHandType, HandLevel>;
}

function cloneHandLevels(levels: Record<PokerHandType, HandLevel>): Record<PokerHandType, HandLevel> {
  return Object.fromEntries(
    (Object.keys(levels) as PokerHandType[]).map((k) => [
      k,
      { ...levels[k] },
    ]),
  ) as Record<PokerHandType, HandLevel>;
}

export class GameState {
  config: RunConfig;
  private rng: () => number;
  private rngDrawCount = 0;

  phase: Phase = 'play'; // start straight in play for the bootstrap
  ante = 1;
  blindIndex: 0 | 1 | 2 = 0; // 0 small, 1 big, 2 boss
  money: number;

  ownedDeck: PlayingCard[] = []; // persistent run deck, including purchased cards
  deck: PlayingCard[] = [];      // remaining draw pile
  discardPile: PlayingCard[] = [];
  hand: PlayingCard[] = [];      // current hand on the table
  selected: Set<string> = new Set();

  handsLeft: number;
  discardsLeft: number;
  roundScore = 0;
  target = 0;

  handLevels: Record<PokerHandType, HandLevel>;
  jokers: JokerCard[] = [];
  consumables: ConsumableCard[] = [];
  shop: ShopState | null = null;
  private shopVisit = 0;

  lastScore: ScoreBreakdown | null = null;

  // Subscribers
  private listeners = new Set<() => void>();

  constructor(config: Partial<RunConfig> = {}, boot = true) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = this.createTrackedRng(this.config.seed);
    this.money = this.config.startingMoney;
    this.handsLeft = this.config.handsPerRound;
    this.discardsLeft = this.config.discardsPerRound;
    this.handLevels = makeInitialHandLevels();
    this.ownedDeck = buildStandardDeck();

    if (boot) this.startBlind();
  }

  static fromSnapshot(snapshot: RunSnapshot): GameState {
    const state = new GameState(snapshot.config, false);
    state.loadSnapshot(snapshot);
    return state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { for (const fn of this.listeners) fn(); }

  getRngDrawCount(): number {
    return this.rngDrawCount;
  }

  // ---------- round flow ----------

  private targetForCurrentBlind(): number {
    const blindMult = this.blindIndex === 0 ? 1 : this.blindIndex === 1 ? 1.5 : 2;
    return Math.round(ANTE_BASE[Math.min(this.ante - 1, ANTE_BASE.length - 1)] * blindMult);
  }

  startBlind() {
    this.target = this.targetForCurrentBlind();
    this.roundScore = 0;
    this.handsLeft = this.config.handsPerRound;
    this.discardsLeft = this.config.discardsPerRound;
    this.deck = shuffle(cloneCards(this.ownedDeck), this.rng);
    this.discardPile = [];
    this.hand = [];
    this.selected.clear();
    this.shop = null;
    this.drawToFull();
    this.phase = 'play';
    this.emit();
  }

  drawToFull() {
    while (this.hand.length < this.config.handSize && this.deck.length > 0) {
      this.hand.push(this.deck.pop()!);
    }
  }

  toggleSelect(cardId: string): boolean {
    if (this.phase !== 'play') return false;
    if (this.selected.has(cardId)) {
      this.selected.delete(cardId);
      this.emit();
      return false;
    }
    if (this.selected.size >= 5) return false;
    this.selected.add(cardId);
    this.emit();
    return true;
  }

  selectedCards(): PlayingCard[] {
    return this.hand.filter((c) => this.selected.has(c.id));
  }

  canPlay(): boolean { return this.phase === 'play' && this.selected.size > 0 && this.handsLeft > 0; }
  canDiscard(): boolean { return this.phase === 'play' && this.selected.size > 0 && this.discardsLeft > 0; }

  // Returns the breakdown so the renderer can animate it.
  playSelected(): ScoreBreakdown | null {
    if (!this.canPlay()) return null;
    const cards = this.selectedCards();
    const hand = evaluateHand(cards);
    const level = this.handLevels[hand.type];
    const handsLeftBeforePlay = this.handsLeft;
    const breakdown = scoreHand(hand, level, {
      jokers: this.jokers,
      handsLeftBeforePlay,
      handsPerRound: this.config.handsPerRound,
    });

    this.roundScore += breakdown.total;
    this.handsLeft -= 1;
    this.lastScore = breakdown;

    // Remove played cards from hand, push to discard
    this.hand = this.hand.filter((c) => !this.selected.has(c.id));
    this.discardPile.push(...cards);
    this.selected.clear();
    this.drawToFull();

    // Check win / loss
    if (this.roundScore >= this.target) {
      this.onBlindCleared();
    } else if (this.handsLeft <= 0) {
      this.phase = 'game-over';
    }

    this.emit();
    return breakdown;
  }

  discardSelected(): PlayingCard[] | null {
    if (!this.canDiscard()) return null;
    const cards = this.selectedCards();
    this.hand = this.hand.filter((c) => !this.selected.has(c.id));
    this.discardPile.push(...cards);
    this.discardsLeft -= 1;
    this.selected.clear();
    this.drawToFull();
    this.emit();
    return cards;
  }

  private onBlindCleared() {
    const reward = 3 + this.blindIndex; // simple placeholder reward
    this.money += reward;
    this.money += this.jokers.reduce((sum, joker) => (
      joker.effect.kind === 'economy-clear' ? sum + joker.effect.amount : sum
    ), 0);

    if (this.blindIndex < 2) {
      this.blindIndex = (this.blindIndex + 1) as 0 | 1 | 2;
    } else {
      this.blindIndex = 0;
      this.ante += 1;
      if (this.ante > 8) { this.phase = 'win'; return; }
    }

    this.target = this.targetForCurrentBlind();
    this.roundScore = 0;
    this.handsLeft = 0;
    this.discardsLeft = 0;
    this.deck = [];
    this.discardPile = [];
    this.hand = [];
    this.selected.clear();
    this.shop = this.createShopState();
    this.phase = 'shop';
  }

  continueFromShop(): boolean {
    if (this.phase !== 'shop') return false;
    this.startBlind();
    return true;
  }

  canBuyOffer(offerId: string): boolean {
    const offer = this.findOffer(offerId);
    if (!offer || offer.sold) return false;
    const price = this.priceForItem(offer.item);
    if (this.money < price) return false;
    if (offer.item.kind === 'joker') return this.jokers.length < MAX_JOKERS;
    if (offer.item.kind === 'consumable') return this.consumables.length < MAX_CONSUMABLES;
    return true;
  }

  buyOffer(offerId: string): boolean {
    const offer = this.findOffer(offerId);
    if (!offer || !this.canBuyOffer(offerId)) return false;

    const price = this.priceForItem(offer.item);
    this.money -= price;
    offer.sold = true;

    if (offer.item.kind === 'joker') {
      this.jokers.push(cloneJoker(offer.item.joker));
    } else if (offer.item.kind === 'consumable') {
      this.consumables.push(cloneConsumable(offer.item.consumable));
    } else {
      this.ownedDeck.push(cloneCard(offer.item.card));
    }

    this.emit();
    return true;
  }

  rerollShop(): boolean {
    if (this.phase !== 'shop' || !this.shop) return false;
    if (this.money < this.shop.rerollCost) return false;
    this.money -= this.shop.rerollCost;
    this.shop.rerolls += 1;
    this.shop.rerollCost = SHOP_REROLL_BASE_COST + this.shop.rerolls;
    this.shop.offers = this.createShopOffers(this.shop.visit, this.shop.rerolls);
    this.emit();
    return true;
  }

  sellJoker(jokerId: string): boolean {
    const idx = this.jokers.findIndex((joker) => joker.id === jokerId);
    if (idx < 0) return false;
    const [joker] = this.jokers.splice(idx, 1);
    this.money += joker.sellValue;
    this.emit();
    return true;
  }

  sellConsumable(consumableId: string): boolean {
    const idx = this.consumables.findIndex((card) => card.id === consumableId);
    if (idx < 0) return false;
    const [card] = this.consumables.splice(idx, 1);
    this.money += card.sellValue;
    this.emit();
    return true;
  }

  useConsumable(consumableId: string): boolean {
    const idx = this.consumables.findIndex((card) => card.id === consumableId);
    if (idx < 0) return false;
    const [card] = this.consumables.splice(idx, 1);
    this.applyConsumable(card);
    this.emit();
    return true;
  }

  private createShopState(): ShopState {
    const visit = ++this.shopVisit;
    return {
      visit,
      offers: this.createShopOffers(visit, 0),
      rerolls: 0,
      rerollCost: SHOP_REROLL_BASE_COST,
    };
  }

  private createShopOffers(visit: number, rerolls: number): ShopOffer[] {
    return [
      this.makeShopOffer(visit, rerolls, 0, this.makeJokerItem()),
      this.makeShopOffer(visit, rerolls, 1, this.makeJokerItem()),
      this.makeShopOffer(visit, rerolls, 2, this.makeConsumableItem()),
      this.makeShopOffer(visit, rerolls, 3, this.makeConsumableItem()),
      this.makeShopOffer(visit, rerolls, 4, this.makePlayingCardItem()),
      this.makeShopOffer(visit, rerolls, 5, this.makePlayingCardItem()),
    ];
  }

  private makeShopOffer(visit: number, rerolls: number, index: number, item: ShopItem): ShopOffer {
    return {
      id: `shop-${visit}-${rerolls}-${index}`,
      item,
      sold: false,
    };
  }

  private makeJokerItem(): ShopItem {
    const template = this.pick(JOKER_TEMPLATES);
    const joker: JokerCard = {
      ...template,
      id: this.makeRunId('joker'),
      sellValue: Math.max(1, Math.floor(template.price / 2)),
      effect: { ...template.effect },
    };
    return { kind: 'joker', joker };
  }

  private makeConsumableItem(): ShopItem {
    const template = this.makeConsumableTemplate();
    const consumable: ConsumableCard = {
      ...template,
      id: this.makeRunId('consumable'),
      sellValue: Math.max(1, Math.floor(template.price / 2)),
      effect: { ...template.effect },
    };
    return { kind: 'consumable', consumable };
  }

  private makeConsumableTemplate(): ConsumableTemplate {
    const roll = this.rng();
    if (roll < 0.42) {
      const handType = this.pick(PLANET_HANDS);
      return {
        key: `planet-${handType.toLowerCase().replaceAll(' ', '-')}`,
        name: `${handType} Planet`,
        description: `Upgrade ${handType} by 1 level.`,
        type: 'planet',
        price: 3,
        effect: { kind: 'planet', handType },
      };
    }
    if (roll < 0.82) {
      const enhancement = this.pick(ENHANCEMENT_OFFERS);
      return {
        key: `tarot-${enhancement}`,
        name: `${titleCase(enhancement)} Tarot`,
        description: `Add ${titleCase(enhancement)} to a random deck card.`,
        type: 'tarot',
        price: 4,
        effect: { kind: 'enhance-card', enhancement },
      };
    }
    const edition = this.pick(EDITION_OFFERS);
    return {
      key: `spectral-${edition}`,
      name: `${titleCase(edition)} Spectral`,
      description: `Add ${titleCase(edition)} to a random deck card.`,
      type: 'spectral',
      price: 5,
      effect: { kind: 'edition-card', edition },
    };
  }

  private makePlayingCardItem(): ShopItem {
    const suit = this.pick(SUITS);
    const rank = this.pick(RANKS);
    const enhancement = this.pick(ENHANCEMENT_OFFERS);
    const card = makeCard(suit, rank);
    card.enhancement = enhancement;
    if (enhancement === 'stone') card.baseChips = 50;
    const editionRoll = this.rng();
    if (editionRoll > 0.82) card.edition = this.pick(EDITION_OFFERS);
    const name = `${RANK_LABEL[rank]} of ${titleCase(suit)}${card.edition !== 'base' ? ` (${titleCase(card.edition)})` : ''}`;
    return {
      kind: 'playing-card',
      card,
      name,
      description: `Add a ${titleCase(enhancement)} card to your deck.`,
      price: card.edition === 'base' ? 4 : 6,
      sellValue: 1,
    };
  }

  private findOffer(offerId: string): ShopOffer | null {
    return this.shop?.offers.find((offer) => offer.id === offerId) ?? null;
  }

  private priceForItem(item: ShopItem): number {
    if (item.kind === 'joker') return item.joker.price;
    if (item.kind === 'consumable') return item.consumable.price;
    return item.price;
  }

  private applyConsumable(card: ConsumableCard) {
    const effect = card.effect;
    if (effect.kind === 'planet') {
      this.upgradeHandLevel(effect.handType);
      return;
    }
    if (effect.kind === 'enhance-card') {
      const target = this.pickOwnedDeckCard((c) => c.enhancement === 'none') ?? this.pickOwnedDeckCard();
      if (!target) return;
      target.enhancement = effect.enhancement;
      if (effect.enhancement === 'stone') target.baseChips = 50;
      return;
    }
    const target = this.pickOwnedDeckCard((c) => c.edition === 'base') ?? this.pickOwnedDeckCard();
    if (!target) return;
    target.edition = effect.edition;
  }

  private upgradeHandLevel(type: PokerHandType) {
    const base = HAND_BASE[type];
    const next = this.handLevels[type].level + 1;
    this.handLevels[type] = {
      level: next,
      chips: base.chips + base.chipsPerLvl * (next - 1),
      mult: base.mult + base.multPerLvl * (next - 1),
    };
  }

  private pickOwnedDeckCard(predicate?: (card: PlayingCard) => boolean): PlayingCard | null {
    const candidates = predicate ? this.ownedDeck.filter(predicate) : this.ownedDeck;
    if (candidates.length === 0) return null;
    return candidates[Math.floor(this.rng() * candidates.length)];
  }

  private pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  private makeRunId(prefix: string): string {
    return `${prefix}-${this.rngDrawCount}-${Math.floor(this.rng() * 1_000_000)}`;
  }

  reset(seedOrSnapshot?: number | RunSnapshot) {
    if (typeof seedOrSnapshot === 'object' && seedOrSnapshot !== null) {
      this.loadSnapshot(seedOrSnapshot);
      this.emit();
      return;
    }
    this.config = {
      ...this.config,
      seed: typeof seedOrSnapshot === 'number' ? seedOrSnapshot : Math.floor(Math.random() * 1e9),
    };
    this.rng = this.createTrackedRng(this.config.seed);
    this.ante = 1;
    this.blindIndex = 0;
    this.money = this.config.startingMoney;
    this.ownedDeck = buildStandardDeck();
    this.jokers = [];
    this.consumables = [];
    this.shop = null;
    this.shopVisit = 0;
    this.handLevels = makeInitialHandLevels();
    this.lastScore = null;
    this.startBlind();
  }

  toSnapshot(): RunSnapshot {
    return {
      version: 2,
      config: { ...this.config },
      rngDrawCount: this.rngDrawCount,
      phase: this.phase,
      ante: this.ante,
      blindIndex: this.blindIndex,
      money: this.money,
      ownedDeck: cloneCards(this.ownedDeck),
      deck: cloneCards(this.deck),
      discardPile: cloneCards(this.discardPile),
      hand: cloneCards(this.hand),
      selected: [...this.selected],
      handsLeft: this.handsLeft,
      discardsLeft: this.discardsLeft,
      roundScore: this.roundScore,
      target: this.target,
      handLevels: cloneHandLevels(this.handLevels),
      jokers: cloneJokers(this.jokers),
      consumables: cloneConsumables(this.consumables),
      shop: cloneShop(this.shop),
    };
  }

  loadSnapshot(snapshot: RunSnapshot) {
    const version = (snapshot as { version?: number }).version;
    if (version !== 1 && version !== 2) {
      throw new Error(`Unsupported snapshot version: ${version}`);
    }
    const next = this.normalizeSnapshot(snapshot);

    this.config = { ...next.config };
    this.rng = this.createTrackedRng(next.config.seed, next.rngDrawCount);
    this.phase = next.phase;
    this.ante = next.ante;
    this.blindIndex = next.blindIndex;
    this.money = next.money;
    this.ownedDeck = cloneCards(next.ownedDeck);
    this.deck = cloneCards(next.deck);
    this.discardPile = cloneCards(next.discardPile);
    this.hand = cloneCards(next.hand);
    this.selected = new Set(next.selected);
    this.handsLeft = next.handsLeft;
    this.discardsLeft = next.discardsLeft;
    this.roundScore = next.roundScore;
    this.target = next.target;
    this.handLevels = cloneHandLevels(next.handLevels);
    this.jokers = cloneJokers(next.jokers);
    this.consumables = cloneConsumables(next.consumables);
    this.shop = cloneShop(next.shop);
    this.shopVisit = next.shop?.visit ?? this.completedShopCount();
    this.lastScore = null;
  }

  private normalizeSnapshot(snapshot: RunSnapshot): RunSnapshotV2 {
    if (snapshot.version === 2) return snapshot;

    const legacy = snapshot as RunSnapshotV1;
    const combined = [...legacy.deck, ...legacy.discardPile, ...legacy.hand];
    const seen = new Set<string>();
    const ownedDeck = combined.filter((card) => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    });

    return {
      ...legacy,
      version: 2,
      ownedDeck: ownedDeck.length > 0 ? ownedDeck : buildStandardDeck(),
      jokers: [],
      consumables: [],
      shop: null,
    };
  }

  private completedShopCount(): number {
    return Math.max(0, (this.ante - 1) * 3 + this.blindIndex);
  }

  private createTrackedRng(seed: number, drawCount = 0): () => number {
    const base = makeRng(seed);
    for (let i = 0; i < drawCount; i++) base();
    this.rngDrawCount = drawCount;
    return () => {
      this.rngDrawCount += 1;
      return base();
    };
  }
}
