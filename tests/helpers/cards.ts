import { baseChipsFor } from '../../src/game/cards';
import type { Edition, Enhancement, PlayingCard, Rank, Seal, Suit } from '../../src/game/types';

let idCounter = 0;

export function resetTestCardIds() {
  idCounter = 0;
}

export function makeCard(
  rank: Rank,
  suit: Suit,
  overrides: Partial<Pick<PlayingCard, 'enhancement' | 'edition' | 'seal' | 'baseChips'>> = {},
): PlayingCard {
  const enhancement: Enhancement = overrides.enhancement ?? 'none';
  const edition: Edition = overrides.edition ?? 'base';
  const seal: Seal = overrides.seal ?? 'none';
  return {
    id: `t${++idCounter}`,
    rank,
    suit,
    enhancement,
    edition,
    seal,
    baseChips: overrides.baseChips ?? baseChipsFor(rank),
  };
}
