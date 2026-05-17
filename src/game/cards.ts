import type { PlayingCard, Rank, Suit } from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const RANK_LABEL: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

// Balatro chip values: number cards = rank, J/Q/K = 10, A = 11.
export function baseChipsFor(rank: Rank): number {
  if (rank === 14) return 11;
  if (rank >= 11) return 10;
  return rank;
}

let _idCounter = 0;
export function makeCard(suit: Suit, rank: Rank): PlayingCard {
  return {
    id: `c${++_idCounter}`,
    suit,
    rank,
    enhancement: 'none',
    seal: 'none',
    edition: 'base',
    baseChips: baseChipsFor(rank),
  };
}

export function buildStandardDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(makeCard(s, r));
  return deck;
}

// Mulberry32 — fast, seedable PRNG so runs are reproducible.
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardLabel(c: PlayingCard): string {
  return `${RANK_LABEL[c.rank]}${SUIT_GLYPH[c.suit]}`;
}
