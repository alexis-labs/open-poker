// Run-level state + small state machine. Kept renderer-agnostic.
// The renderer subscribes via simple callbacks for now; we can swap to a
// proper event bus once jokers/triggers are introduced.

import { buildStandardDeck, makeRng, shuffle } from './cards';
import { evaluateHand, scoreHand } from './pokerEngine';
import type {
  HandLevel,
  PlayingCard,
  PokerHandType,
  RunPhase,
  RunSnapshot,
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

function cloneCard(card: PlayingCard): PlayingCard {
  return { ...card };
}

function cloneCards(cards: PlayingCard[]): PlayingCard[] {
  return cards.map(cloneCard);
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

  deck: PlayingCard[] = [];      // remaining draw pile
  discardPile: PlayingCard[] = [];
  hand: PlayingCard[] = [];      // current hand on the table
  selected: Set<string> = new Set();

  handsLeft: number;
  discardsLeft: number;
  roundScore = 0;
  target = 0;

  handLevels: Record<PokerHandType, HandLevel>;

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

  startBlind() {
    const blindMult = this.blindIndex === 0 ? 1 : this.blindIndex === 1 ? 1.5 : 2;
    this.target = Math.round(ANTE_BASE[Math.min(this.ante - 1, ANTE_BASE.length - 1)] * blindMult);
    this.roundScore = 0;
    this.handsLeft = this.config.handsPerRound;
    this.discardsLeft = this.config.discardsPerRound;
    this.deck = shuffle([...buildStandardDeck()], this.rng);
    this.discardPile = [];
    this.hand = [];
    this.selected.clear();
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
    const breakdown = scoreHand(hand, level);

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
    if (this.blindIndex < 2) {
      this.blindIndex = (this.blindIndex + 1) as 0 | 1 | 2;
    } else {
      this.blindIndex = 0;
      this.ante += 1;
      if (this.ante > 8) { this.phase = 'win'; return; }
    }
    // For now skip shop and jump to next blind directly.
    this.startBlind();
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
    this.handLevels = makeInitialHandLevels();
    this.lastScore = null;
    this.startBlind();
  }

  toSnapshot(): RunSnapshot {
    return {
      version: 1,
      config: { ...this.config },
      rngDrawCount: this.rngDrawCount,
      phase: this.phase,
      ante: this.ante,
      blindIndex: this.blindIndex,
      money: this.money,
      deck: cloneCards(this.deck),
      discardPile: cloneCards(this.discardPile),
      hand: cloneCards(this.hand),
      selected: [...this.selected],
      handsLeft: this.handsLeft,
      discardsLeft: this.discardsLeft,
      roundScore: this.roundScore,
      target: this.target,
      handLevels: cloneHandLevels(this.handLevels),
    };
  }

  loadSnapshot(snapshot: RunSnapshot) {
    if (snapshot.version !== 1) {
      throw new Error(`Unsupported snapshot version: ${snapshot.version}`);
    }

    this.config = { ...snapshot.config };
    this.rng = this.createTrackedRng(snapshot.config.seed, snapshot.rngDrawCount);
    this.phase = snapshot.phase;
    this.ante = snapshot.ante;
    this.blindIndex = snapshot.blindIndex;
    this.money = snapshot.money;
    this.deck = cloneCards(snapshot.deck);
    this.discardPile = cloneCards(snapshot.discardPile);
    this.hand = cloneCards(snapshot.hand);
    this.selected = new Set(snapshot.selected);
    this.handsLeft = snapshot.handsLeft;
    this.discardsLeft = snapshot.discardsLeft;
    this.roundScore = snapshot.roundScore;
    this.target = snapshot.target;
    this.handLevels = cloneHandLevels(snapshot.handLevels);
    this.lastScore = null;
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
