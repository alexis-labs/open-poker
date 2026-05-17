import { describe, expect, it } from 'vitest';

import { GameState } from '../../src/game/gameState';

function serializeCards(cards: Array<{ rank: number; suit: string }>) {
  return cards.map((card) => `${card.rank}-${card.suit}`);
}

function selectFirst(state: GameState, count: number) {
  for (const card of state.hand.slice(0, count)) {
    state.toggleSelect(card.id);
  }
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

  it('advances blind and rewards money when clearing target', () => {
    const state = new GameState({ seed: 4 });
    state.target = 1;
    const moneyBefore = state.money;
    selectFirst(state, 1);
    state.playSelected();

    expect(state.blindIndex).toBe(1);
    expect(state.phase).toBe('play');
    expect(state.money).toBeGreaterThan(moneyBefore);
    expect(state.roundScore).toBe(0);
    expect(state.handsLeft).toBe(state.config.handsPerRound);
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
