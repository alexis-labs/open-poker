// Poker hand detection + Balatro-style scoring.
// Balatro lesson: only the *scoring cards* contribute chips (e.g. on a Pair of 7s
// inside a 5-card play, the other 3 cards are NOT scored unless a Joker says so).
// Straights/Flushes/Full Houses score ALL 5 cards.

import type {
  EvaluatedHand,
  HandLevel,
  PlayingCard,
  Rank,
  ScoreBreakdown,
  ScoreStep,
} from './types';
import { HAND_BASE } from './types';

interface RankGroup {
  rank: Rank;
  cards: PlayingCard[];
}

function groupByRank(cards: PlayingCard[]): RankGroup[] {
  const m = new Map<Rank, PlayingCard[]>();
  for (const c of cards) {
    const arr = m.get(c.rank) ?? [];
    arr.push(c);
    m.set(c.rank, arr);
  }
  // sort by group size desc, then rank desc
  return [...m.entries()]
    .map(([rank, cs]) => ({ rank, cards: cs }))
    .sort((a, b) => b.cards.length - a.cards.length || b.rank - a.rank);
}

function isFlush(cards: PlayingCard[]): boolean {
  if (cards.length < 5) return false;
  // Stone cards have no suit; ignore them when determining a flush.
  // Wild cards count as any suit.
  const real = cards.filter((c) => c.enhancement !== 'stone');
  if (real.length < 5) return false;
  const suits = new Set(real.filter((c) => c.enhancement !== 'wild').map((c) => c.suit));
  return suits.size <= 1;
}

function isStraight(cards: PlayingCard[]): { ok: boolean; cards: PlayingCard[] } {
  if (cards.length < 5) return { ok: false, cards: [] };
  // Build unique rank set; Aces can play as 1 or 14.
  const byRank = new Map<number, PlayingCard>();
  for (const c of cards) {
    if (c.enhancement === 'stone') return { ok: false, cards: [] };
    if (!byRank.has(c.rank)) byRank.set(c.rank, c);
  }
  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  // Try wheel (A-2-3-4-5)
  if (byRank.has(14) && [2, 3, 4, 5].every((r) => byRank.has(r as Rank))) {
    return {
      ok: true,
      cards: [byRank.get(14)!, byRank.get(2 as Rank)!, byRank.get(3 as Rank)!, byRank.get(4 as Rank)!, byRank.get(5 as Rank)!],
    };
  }

  // Sliding window of 5 consecutive
  for (let i = ranks.length - 5; i >= 0; i--) {
    let ok = true;
    for (let k = 1; k < 5; k++) if (ranks[i + k] !== ranks[i] + k) { ok = false; break; }
    if (ok) return { ok: true, cards: ranks.slice(i, i + 5).map((r) => byRank.get(r)!) };
  }
  return { ok: false, cards: [] };
}

/**
 * Evaluate the best Balatro poker hand from up to 5 played cards.
 * Returns BOTH the full played set and the subset that actually scores.
 */
export function evaluateHand(played: PlayingCard[]): EvaluatedHand {
  const groups = groupByRank(played);
  const counts = groups.map((g) => g.cards.length);
  const flush = isFlush(played);
  const straight = isStraight(played);

  const has = (n: number) => counts.includes(n);
  const countOf = (n: number) => counts.filter((c) => c === n).length;

  // Flush Five: 5 of same rank AND same suit
  if (has(5) && flush) {
    return { type: 'Flush Five', scoringCards: groups[0].cards, allPlayed: played };
  }
  // Flush House: full house + flush
  if (has(3) && has(2) && flush) {
    return { type: 'Flush House', scoringCards: played.slice(), allPlayed: played };
  }
  // Five of a Kind
  if (has(5)) {
    return { type: 'Five of a Kind', scoringCards: groups[0].cards, allPlayed: played };
  }
  // Straight Flush
  if (straight.ok && flush) {
    return { type: 'Straight Flush', scoringCards: played.slice(), allPlayed: played };
  }
  // Four of a Kind
  if (has(4)) {
    return { type: 'Four of a Kind', scoringCards: groups[0].cards, allPlayed: played };
  }
  // Full House (3+2)
  if (has(3) && has(2)) {
    return { type: 'Full House', scoringCards: played.slice(), allPlayed: played };
  }
  // Flush
  if (flush) {
    return { type: 'Flush', scoringCards: played.slice(), allPlayed: played };
  }
  // Straight
  if (straight.ok) {
    return { type: 'Straight', scoringCards: played.slice(), allPlayed: played };
  }
  // Three of a Kind
  if (has(3)) {
    return { type: 'Three of a Kind', scoringCards: groups[0].cards, allPlayed: played };
  }
  // Two Pair
  if (countOf(2) >= 2) {
    return { type: 'Two Pair', scoringCards: [...groups[0].cards, ...groups[1].cards], allPlayed: played };
  }
  // Pair
  if (has(2)) {
    return { type: 'Pair', scoringCards: groups[0].cards, allPlayed: played };
  }
  // High Card — only the single highest card scores
  const high = played.slice().sort((a, b) => b.rank - a.rank)[0];
  return { type: 'High Card', scoringCards: high ? [high] : [], allPlayed: played };
}

/**
 * Score a hand using Balatro math: chips and mult accumulate, multiplied at the end.
 * Hand levels (Planet cards) raise both the base chips and base mult.
 * NOTE: Jokers will plug into the `steps` pipeline later — keep this composable.
 */
export function scoreHand(
  hand: EvaluatedHand,
  level: HandLevel,
): ScoreBreakdown {
  const base = HAND_BASE[hand.type];
  const lvl = Math.max(1, level.level);
  const baseChips = base.chips + base.chipsPerLvl * (lvl - 1);
  const baseMult  = base.mult  + base.multPerLvl  * (lvl - 1);

  let chips = baseChips;
  let mult = baseMult;
  const steps: ScoreStep[] = [
    { source: `${hand.type} (lvl ${lvl})`, chipsDelta: baseChips, multDelta: baseMult },
  ];

  // Per-card chips from the scoring set (Balatro: rank chips + enhancement bonuses).
  for (const c of hand.scoringCards) {
    if (c.enhancement === 'stone') {
      chips += 50;
      steps.push({ source: `Stone +50 chips`, chipsDelta: 50 });
      continue;
    }
    chips += c.baseChips;
    steps.push({ source: `${labelShort(c)} +${c.baseChips} chips`, chipsDelta: c.baseChips });

    if (c.enhancement === 'bonus') {
      chips += 30;
      steps.push({ source: `Bonus +30 chips`, chipsDelta: 30 });
    } else if (c.enhancement === 'mult') {
      mult += 4;
      steps.push({ source: `Mult card +4 Mult`, multDelta: 4 });
    } else if (c.enhancement === 'glass') {
      mult *= 2;
      steps.push({ source: `Glass x2 Mult`, multMul: 2 });
    }

    // Edition extras per scoring card
    if (c.edition === 'foil') {
      chips += 50;
      steps.push({ source: `Foil +50 chips`, chipsDelta: 50 });
    } else if (c.edition === 'holographic') {
      mult += 10;
      steps.push({ source: `Holo +10 Mult`, multDelta: 10 });
    } else if (c.edition === 'polychrome') {
      mult *= 1.5;
      steps.push({ source: `Polychrome x1.5 Mult`, multMul: 1.5 });
    }
  }

  const total = Math.round(chips * mult);
  return {
    hand,
    baseChips,
    baseMult,
    finalChips: chips,
    finalMult: mult,
    total,
    steps,
  };
}

function labelShort(c: PlayingCard): string {
  const r = c.rank === 14 ? 'A' : c.rank === 13 ? 'K' : c.rank === 12 ? 'Q' : c.rank === 11 ? 'J' : `${c.rank}`;
  const s = c.suit === 'spades' ? '♠' : c.suit === 'hearts' ? '♥' : c.suit === 'diamonds' ? '♦' : '♣';
  return `${r}${s}`;
}
