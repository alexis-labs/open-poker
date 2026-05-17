// Core domain types for the Balatro-like engine.
// Kept dependency-free so they can be imported by both the engine and the renderer.

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

// Rank values mirror Balatro: Ace is 14 for straight/high logic,
// but also counts as 1 for the wheel straight (A-2-3-4-5).
export type Rank =
  | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11  // Jack
  | 12  // Queen
  | 13  // King
  | 14; // Ace

// Card modifiers (subset of Balatro's system; expand later).
export type Enhancement =
  | 'none'
  | 'bonus'    // +30 chips
  | 'mult'     // +4 mult
  | 'wild'     // counts as any suit
  | 'glass'    // x2 mult, 1/4 chance to break
  | 'steel'    // x1.5 mult while held in hand
  | 'stone'    // +50 chips, no rank/suit
  | 'gold'     // $3 if held at end of round
  | 'lucky';   // 1/5 +20 mult, 1/15 +$20

export type Seal = 'none' | 'gold' | 'red' | 'blue' | 'purple';
export type Edition = 'base' | 'foil' | 'holographic' | 'polychrome' | 'negative';

export interface PlayingCard {
  id: string;            // unique within a run
  suit: Suit;
  rank: Rank;
  enhancement: Enhancement;
  seal: Seal;
  edition: Edition;
  // Chip value (Balatro: 2-10 = face, J/Q/K = 10, A = 11). Updated by enhancements.
  baseChips: number;
}

// All hand types Balatro recognises, ordered from worst → best.
export type PokerHandType =
  | 'High Card'
  | 'Pair'
  | 'Two Pair'
  | 'Three of a Kind'
  | 'Straight'
  | 'Flush'
  | 'Full House'
  | 'Four of a Kind'
  | 'Straight Flush'
  | 'Five of a Kind'
  | 'Flush House'
  | 'Flush Five';

// Per-hand levelling state (Planet cards upgrade these).
export interface HandLevel {
  level: number;
  chips: number;
  mult: number;
}

// Base values for each hand at level 1 (Chips, Mult) — Balatro defaults.
export const HAND_BASE: Record<PokerHandType, { chips: number; mult: number; chipsPerLvl: number; multPerLvl: number }> = {
  'High Card':       { chips: 5,   mult: 1,  chipsPerLvl: 10, multPerLvl: 1 },
  'Pair':            { chips: 10,  mult: 2,  chipsPerLvl: 15, multPerLvl: 1 },
  'Two Pair':        { chips: 20,  mult: 2,  chipsPerLvl: 20, multPerLvl: 1 },
  'Three of a Kind': { chips: 30,  mult: 3,  chipsPerLvl: 20, multPerLvl: 2 },
  'Straight':        { chips: 30,  mult: 4,  chipsPerLvl: 30, multPerLvl: 3 },
  'Flush':           { chips: 35,  mult: 4,  chipsPerLvl: 15, multPerLvl: 2 },
  'Full House':      { chips: 40,  mult: 4,  chipsPerLvl: 25, multPerLvl: 2 },
  'Four of a Kind':  { chips: 60,  mult: 7,  chipsPerLvl: 30, multPerLvl: 3 },
  'Straight Flush':  { chips: 100, mult: 8,  chipsPerLvl: 40, multPerLvl: 4 },
  'Five of a Kind':  { chips: 120, mult: 12, chipsPerLvl: 35, multPerLvl: 3 },
  'Flush House':     { chips: 140, mult: 14, chipsPerLvl: 40, multPerLvl: 4 },
  'Flush Five':      { chips: 160, mult: 16, chipsPerLvl: 50, multPerLvl: 3 },
};

export interface EvaluatedHand {
  type: PokerHandType;
  scoringCards: PlayingCard[]; // cards that actually contribute (e.g. only the pair in a Pair).
  allPlayed: PlayingCard[];    // every card the player committed.
}

export interface ScoreBreakdown {
  hand: EvaluatedHand;
  baseChips: number;
  baseMult: number;
  finalChips: number;
  finalMult: number;
  total: number;
  steps: ScoreStep[]; // for animated readout
}

export interface ScoreStep {
  source: string;        // e.g. "10♥ +10 chips", "Joker: +4 Mult"
  chipsDelta?: number;
  multDelta?: number;
  multMul?: number;
}
