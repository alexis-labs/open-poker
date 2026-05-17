import { beforeEach, describe, expect, it } from 'vitest';

import { evaluateHand, scoreHand } from '../../src/game/pokerEngine';
import type { HandLevel, JokerCard, PokerHandType } from '../../src/game/types';
import { makeCard, resetTestCardIds } from '../helpers/cards';

describe('evaluateHand', () => {
  beforeEach(() => {
    resetTestCardIds();
  });

  const cases: Array<{ name: string; expected: PokerHandType; cards: ReturnType<typeof makeCard>[]; scoringCount: number }> = [
    {
      name: 'Flush Five',
      expected: 'Flush Five',
      scoringCount: 5,
      cards: [
        makeCard(8, 'hearts'),
        makeCard(8, 'hearts'),
        makeCard(8, 'hearts'),
        makeCard(8, 'hearts'),
        makeCard(8, 'hearts'),
      ],
    },
    {
      name: 'Flush House',
      expected: 'Flush House',
      scoringCount: 5,
      cards: [
        makeCard(7, 'hearts'),
        makeCard(7, 'hearts'),
        makeCard(7, 'hearts'),
        makeCard(5, 'hearts'),
        makeCard(5, 'hearts'),
      ],
    },
    {
      name: 'Five of a Kind',
      expected: 'Five of a Kind',
      scoringCount: 5,
      cards: [
        makeCard(9, 'hearts'),
        makeCard(9, 'spades'),
        makeCard(9, 'diamonds'),
        makeCard(9, 'clubs'),
        makeCard(9, 'hearts'),
      ],
    },
    {
      name: 'Straight Flush',
      expected: 'Straight Flush',
      scoringCount: 5,
      cards: [
        makeCard(6, 'clubs'),
        makeCard(7, 'clubs'),
        makeCard(8, 'clubs'),
        makeCard(9, 'clubs'),
        makeCard(10, 'clubs'),
      ],
    },
    {
      name: 'Four of a Kind',
      expected: 'Four of a Kind',
      scoringCount: 4,
      cards: [
        makeCard(13, 'spades'),
        makeCard(13, 'hearts'),
        makeCard(13, 'diamonds'),
        makeCard(13, 'clubs'),
        makeCard(4, 'clubs'),
      ],
    },
    {
      name: 'Full House',
      expected: 'Full House',
      scoringCount: 5,
      cards: [
        makeCard(12, 'spades'),
        makeCard(12, 'hearts'),
        makeCard(12, 'diamonds'),
        makeCard(4, 'clubs'),
        makeCard(4, 'hearts'),
      ],
    },
    {
      name: 'Flush',
      expected: 'Flush',
      scoringCount: 5,
      cards: [
        makeCard(2, 'diamonds'),
        makeCard(5, 'diamonds'),
        makeCard(8, 'diamonds'),
        makeCard(11, 'diamonds'),
        makeCard(13, 'diamonds'),
      ],
    },
    {
      name: 'Straight',
      expected: 'Straight',
      scoringCount: 5,
      cards: [
        makeCard(9, 'hearts'),
        makeCard(10, 'spades'),
        makeCard(11, 'diamonds'),
        makeCard(12, 'clubs'),
        makeCard(13, 'hearts'),
      ],
    },
    {
      name: 'Three of a Kind',
      expected: 'Three of a Kind',
      scoringCount: 3,
      cards: [
        makeCard(14, 'spades'),
        makeCard(14, 'hearts'),
        makeCard(14, 'diamonds'),
        makeCard(2, 'clubs'),
        makeCard(9, 'hearts'),
      ],
    },
    {
      name: 'Two Pair',
      expected: 'Two Pair',
      scoringCount: 4,
      cards: [
        makeCard(10, 'spades'),
        makeCard(10, 'hearts'),
        makeCard(4, 'diamonds'),
        makeCard(4, 'clubs'),
        makeCard(13, 'hearts'),
      ],
    },
    {
      name: 'Pair',
      expected: 'Pair',
      scoringCount: 2,
      cards: [
        makeCard(7, 'spades'),
        makeCard(7, 'hearts'),
        makeCard(14, 'diamonds'),
        makeCard(13, 'clubs'),
        makeCard(3, 'hearts'),
      ],
    },
    {
      name: 'High Card',
      expected: 'High Card',
      scoringCount: 1,
      cards: [
        makeCard(2, 'spades'),
        makeCard(4, 'hearts'),
        makeCard(9, 'diamonds'),
        makeCard(13, 'clubs'),
        makeCard(14, 'hearts'),
      ],
    },
  ];

  it.each(cases)('classifies $name correctly', ({ expected, cards, scoringCount }) => {
    const result = evaluateHand(cards);
    expect(result.type).toBe(expected);
    expect(result.scoringCards).toHaveLength(scoringCount);
  });

  it('supports wheel straight (A-2-3-4-5)', () => {
    const cards = [
      makeCard(14, 'spades'),
      makeCard(2, 'hearts'),
      makeCard(3, 'diamonds'),
      makeCard(4, 'clubs'),
      makeCard(5, 'hearts'),
    ];
    const result = evaluateHand(cards);
    expect(result.type).toBe('Straight');
    expect(result.scoringCards).toHaveLength(5);
  });

  it('supports flush with wild cards', () => {
    const cards = [
      makeCard(2, 'spades', { enhancement: 'wild' }),
      makeCard(5, 'hearts'),
      makeCard(8, 'hearts'),
      makeCard(11, 'hearts'),
      makeCard(13, 'hearts'),
    ];
    const result = evaluateHand(cards);
    expect(result.type).toBe('Flush');
  });

  it('blocks straight and flush scoring when a stone card is present', () => {
    const cards = [
      makeCard(2, 'hearts'),
      makeCard(3, 'hearts'),
      makeCard(4, 'hearts', { enhancement: 'stone' }),
      makeCard(5, 'hearts'),
      makeCard(6, 'hearts'),
    ];
    const result = evaluateHand(cards);
    expect(result.type).toBe('High Card');
  });
});

describe('scoreHand', () => {
  beforeEach(() => {
    resetTestCardIds();
  });

  it('applies hand level scaling before scoring cards', () => {
    const cards = [
      makeCard(7, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
      makeCard(12, 'diamonds'),
      makeCard(4, 'hearts'),
    ];
    const hand = evaluateHand(cards);
    const level: HandLevel = { level: 2, chips: 0, mult: 0 };

    const score = scoreHand(hand, level);
    expect(score.baseChips).toBe(25);
    expect(score.baseMult).toBe(3);
    expect(score.finalChips).toBe(39);
    expect(score.finalMult).toBe(3);
    expect(score.total).toBe(117);
  });

  it('applies enhancement and edition effects in the expected order', () => {
    const card = makeCard(10, 'spades', { enhancement: 'mult', edition: 'polychrome' });
    const hand = { type: 'High Card' as const, scoringCards: [card], allPlayed: [card] };
    const level: HandLevel = { level: 1, chips: 0, mult: 0 };

    const score = scoreHand(hand, level);
    expect(score.baseChips).toBe(5);
    expect(score.baseMult).toBe(1);
    expect(score.finalChips).toBe(15);
    expect(score.finalMult).toBe(7.5);
    expect(score.total).toBe(113);
  });

  it('scores stone cards as flat chip bonuses', () => {
    const stone = makeCard(9, 'clubs', { enhancement: 'stone' });
    const hand = { type: 'High Card' as const, scoringCards: [stone], allPlayed: [stone] };
    const level: HandLevel = { level: 1, chips: 0, mult: 0 };

    const score = scoreHand(hand, level);
    expect(score.finalChips).toBe(55);
    expect(score.finalMult).toBe(1);
    expect(score.total).toBe(55);
  });

  it('includes score step details for visibility', () => {
    const card = makeCard(11, 'diamonds', { enhancement: 'bonus', edition: 'foil' });
    const hand = { type: 'High Card' as const, scoringCards: [card], allPlayed: [card] };
    const level: HandLevel = { level: 1, chips: 0, mult: 0 };

    const score = scoreHand(hand, level);
    expect(score.steps.length).toBeGreaterThan(1);
    expect(score.steps.some((step) => step.chipsDelta === 30)).toBe(true);
    expect(score.steps.some((step) => step.chipsDelta === 50)).toBe(true);
  });

  it('applies conditional joker scoring effects', () => {
    const level: HandLevel = { level: 1, chips: 0, mult: 0 };
    const pair = evaluateHand([
      makeCard(7, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(3, 'clubs'),
    ]);
    const jokers: JokerCard[] = [
      {
        id: 'chips',
        key: 'chips',
        name: 'Chips',
        description: '+20 chips',
        rarity: 'common',
        price: 1,
        sellValue: 1,
        effect: { kind: 'chips', amount: 20 },
      },
      {
        id: 'pair',
        key: 'pair',
        name: 'Pair',
        description: '+8 Mult on pairs',
        rarity: 'common',
        price: 1,
        sellValue: 1,
        effect: { kind: 'pair-mult', amount: 8 },
      },
      {
        id: 'flush',
        key: 'flush',
        name: 'Flush',
        description: 'x2 on flushes',
        rarity: 'rare',
        price: 1,
        sellValue: 1,
        effect: { kind: 'flush-mult-mul', amount: 2 },
      },
      {
        id: 'first',
        key: 'first',
        name: 'First',
        description: '+30 chips on the first hand',
        rarity: 'common',
        price: 1,
        sellValue: 1,
        effect: { kind: 'first-hand-chips', amount: 30 },
      },
      {
        id: 'cash',
        key: 'cash',
        name: 'Cash',
        description: '+$1 on clear',
        rarity: 'common',
        price: 1,
        sellValue: 1,
        effect: { kind: 'economy-clear', amount: 1 },
      },
    ];

    const pairScore = scoreHand(pair, level, {
      jokers,
      handsLeftBeforePlay: 4,
      handsPerRound: 4,
    });
    expect(pairScore.steps.map((step) => step.jokerId).filter(Boolean)).toEqual(['chips', 'pair', 'first']);

    const flush = evaluateHand([
      makeCard(2, 'clubs'),
      makeCard(4, 'clubs'),
      makeCard(6, 'clubs'),
      makeCard(8, 'clubs'),
      makeCard(10, 'clubs'),
    ]);
    const flushScore = scoreHand(flush, level, {
      jokers,
      handsLeftBeforePlay: 3,
      handsPerRound: 4,
    });
    expect(flushScore.steps.some((step) => step.jokerId === 'flush')).toBe(true);
    expect(flushScore.steps.some((step) => step.jokerId === 'first')).toBe(false);
  });
});
