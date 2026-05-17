import { describe, expect, it } from 'vitest';

import { GameState, MAX_JOKERS } from '../../src/game/gameState';
import type { JokerCard } from '../../src/game/types';

function serializeCards(cards: Array<{ rank: number; suit: string }>) {
  return cards.map((card) => `${card.rank}-${card.suit}`);
}

function selectFirst(state: GameState, count: number) {
  for (const card of state.hand.slice(0, count)) {
    state.toggleSelect(card.id);
  }
}

function clearBlindIntoShop(state: GameState) {
  state.target = 1;
  selectFirst(state, 1);
  const scored = state.playSelected();
  expect(scored).not.toBeNull();
  expect(state.phase).toBe('shop');
}

function offerNames(state: GameState) {
  return state.shop?.offers.map((offer) => {
    if (offer.item.kind === 'joker') return offer.item.joker.name;
    if (offer.item.kind === 'consumable') return offer.item.consumable.name;
    return offer.item.name;
  });
}

describe('GameState', () => {
  it('starts in play phase with full hand and target', () => {
    const state = new GameState({ seed: 12345 });
    expect(state.phase).toBe('play');
    expect(state.hand.length).toBe(state.config.handSize);
    expect(state.target).toBeGreaterThan(0);
    expect(state.handsLeft).toBe(state.config.handsPerRound);
    expect(state.discardsLeft).toBe(state.config.discardsPerRound);
  });

  it('limits selection to five cards', () => {
    const state = new GameState({ seed: 1 });
    selectFirst(state, 6);
    expect(state.selected.size).toBe(5);
  });

  it('discards selected cards and consumes discard count', () => {
    const state = new GameState({ seed: 2 });
    const beforeDiscards = state.discardsLeft;
    const beforeDiscardPile = state.discardPile.length;
    selectFirst(state, 2);
    const discarded = state.discardSelected();

    expect(discarded).not.toBeNull();
    expect(discarded).toHaveLength(2);
    expect(state.discardsLeft).toBe(beforeDiscards - 1);
    expect(state.discardPile.length).toBe(beforeDiscardPile + 2);
    expect(state.hand.length).toBe(state.config.handSize);
  });

  it('transitions to game-over when out of hands and target is not met', () => {
    const state = new GameState({ seed: 3 });
    state.handsLeft = 1;
    state.target = Number.MAX_SAFE_INTEGER;
    selectFirst(state, 1);
    const scored = state.playSelected();

    expect(scored).not.toBeNull();
    expect(state.phase).toBe('game-over');
  });

  it('enters the shop and rewards money when clearing target', () => {
    const state = new GameState({ seed: 4 });
    state.target = 1;
    const moneyBefore = state.money;
    selectFirst(state, 1);
    state.playSelected();

    expect(state.blindIndex).toBe(1);
    expect(state.phase).toBe('shop');
    expect(state.shop?.offers).toHaveLength(6);
    expect(state.money).toBeGreaterThan(moneyBefore);
    expect(state.roundScore).toBe(0);
    expect(state.hand).toHaveLength(0);
  });

  it('continues from shop into the next blind with a full hand', () => {
    const state = new GameState({ seed: 44 });
    clearBlindIntoShop(state);

    const continued = state.continueFromShop();

    expect(continued).toBe(true);
    expect(state.phase).toBe('play');
    expect(state.hand).toHaveLength(state.config.handSize);
    expect(state.handsLeft).toBe(state.config.handsPerRound);
    expect(state.blindIndex).toBe(1);
  });

  it('buys a deck card and adds it to the persistent deck', () => {
    const state = new GameState({ seed: 45 });
    clearBlindIntoShop(state);
    state.money = 99;
    const deckBefore = state.ownedDeck.length;
    const offer = state.shop!.offers.find((o) => o.item.kind === 'playing-card')!;

    expect(state.buyOffer(offer.id)).toBe(true);

    expect(state.money).toBeLessThan(99);
    expect(state.ownedDeck.length).toBe(deckBefore + 1);
    expect(offer.sold).toBe(true);
  });

  it('buys and sells jokers while respecting the slot limit', () => {
    const state = new GameState({ seed: 46 });
    clearBlindIntoShop(state);
    state.money = 99;
    const firstJokerOffer = state.shop!.offers.find((o) => o.item.kind === 'joker')!;

    expect(state.buyOffer(firstJokerOffer.id)).toBe(true);
    expect(state.jokers).toHaveLength(1);

    for (let i = state.jokers.length; i < MAX_JOKERS; i++) {
      state.jokers.push({
        id: `manual-${i}`,
        key: 'manual',
        name: 'Manual Joker',
        description: '+1 Mult',
        rarity: 'common',
        price: 1,
        sellValue: 1,
        effect: { kind: 'mult', amount: 1 },
      });
    }
    const secondJokerOffer = state.shop!.offers.find((o) => o.item.kind === 'joker' && !o.sold)!;
    expect(state.canBuyOffer(secondJokerOffer.id)).toBe(false);

    const soldId = state.jokers[0].id;
    const moneyBeforeSell = state.money;
    expect(state.sellJoker(soldId)).toBe(true);
    expect(state.jokers).toHaveLength(MAX_JOKERS - 1);
    expect(state.money).toBeGreaterThan(moneyBeforeSell);
  });

  it('applies joker scoring steps during play', () => {
    const state = new GameState({ seed: 47 });
    const joker: JokerCard = {
      id: 'test-joker',
      key: 'test-joker',
      name: 'Test Joker',
      description: '+10 Mult',
      rarity: 'common',
      price: 1,
      sellValue: 1,
      effect: { kind: 'mult', amount: 10 },
    };
    state.jokers.push(joker);
    state.target = Number.MAX_SAFE_INTEGER;
    selectFirst(state, 1);

    const scored = state.playSelected();

    expect(scored?.steps.some((step) => step.jokerId === joker.id)).toBe(true);
    expect(scored!.finalMult).toBeGreaterThan(scored!.baseMult);
  });

  it('buys and uses a consumable from the shop', () => {
    const state = new GameState({ seed: 48 });
    clearBlindIntoShop(state);
    state.money = 99;
    const offer = state.shop!.offers.find((o) => o.item.kind === 'consumable')!;

    expect(state.buyOffer(offer.id)).toBe(true);
    expect(state.consumables).toHaveLength(1);

    const before = state.toSnapshot();
    if (before.version !== 2) throw new Error('expected v2 snapshot');
    expect(state.useConsumable(state.consumables[0].id)).toBe(true);
    const after = state.toSnapshot();
    if (after.version !== 2) throw new Error('expected v2 snapshot');

    expect(state.consumables).toHaveLength(0);
    expect(
      JSON.stringify(after.handLevels) !== JSON.stringify(before.handLevels)
        || JSON.stringify(after.ownedDeck) !== JSON.stringify(before.ownedDeck),
    ).toBe(true);
  });

  it('rerolls shop offers deterministically and increases reroll cost', () => {
    const a = new GameState({ seed: 49 });
    const b = new GameState({ seed: 49 });
    clearBlindIntoShop(a);
    clearBlindIntoShop(b);
    a.money = 99;
    b.money = 99;

    expect(a.rerollShop()).toBe(true);
    expect(b.rerollShop()).toBe(true);

    expect(offerNames(a)).toEqual(offerNames(b));
    expect(a.shop?.rerollCost).toBe(6);
    expect(a.money).toBe(94);
  });

  it('enters win state after clearing ante 8 boss blind', () => {
    const state = new GameState({ seed: 5 });
    state.ante = 8;
    state.blindIndex = 2;
    state.target = 1;
    state.handsLeft = 1;
    selectFirst(state, 1);
    state.playSelected();

    expect(state.phase).toBe('win');
    expect(state.ante).toBe(9);
  });

  it('is deterministic for the same seed', () => {
    const a = new GameState({ seed: 987654, handSize: 8 });
    const b = new GameState({ seed: 987654, handSize: 8 });

    expect(serializeCards(a.hand)).toEqual(serializeCards(b.hand));
    expect(serializeCards(a.deck)).toEqual(serializeCards(b.deck));
    expect(a.target).toBe(b.target);
  });

  it('supports snapshot round-trip and deterministic continuation', () => {
    const state = new GameState({ seed: 2222 });
    selectFirst(state, 2);
    state.discardSelected();
    selectFirst(state, 1);
    state.playSelected();

    const snapshot = state.toSnapshot();
    const restored = GameState.fromSnapshot(snapshot);
    expect(restored.toSnapshot()).toEqual(snapshot);

    selectFirst(state, 1);
    state.playSelected();
    selectFirst(restored, 1);
    restored.playSelected();

    expect(restored.toSnapshot()).toEqual(state.toSnapshot());
  });

  it('round-trips shop inventory and persistent deck snapshots', () => {
    const state = new GameState({ seed: 2233 });
    clearBlindIntoShop(state);
    state.money = 99;
    const deckOffer = state.shop!.offers.find((o) => o.item.kind === 'playing-card')!;
    const jokerOffer = state.shop!.offers.find((o) => o.item.kind === 'joker')!;
    state.buyOffer(deckOffer.id);
    state.buyOffer(jokerOffer.id);

    const snapshot = state.toSnapshot();
    const restored = GameState.fromSnapshot(snapshot);

    expect(restored.toSnapshot()).toEqual(snapshot);
    expect(restored.ownedDeck.length).toBe(state.ownedDeck.length);
    expect(restored.jokers.length).toBe(1);
    expect(restored.shop?.offers).toHaveLength(6);
  });

  it('can reset from snapshot directly', () => {
    const state = new GameState({ seed: 777 });
    selectFirst(state, 1);
    state.discardSelected();
    const snapshot = state.toSnapshot();

    const next = new GameState({ seed: 888 });
    next.reset(snapshot);
    expect(next.toSnapshot()).toEqual(snapshot);
  });
});
