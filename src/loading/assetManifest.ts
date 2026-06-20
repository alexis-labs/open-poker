import { RANK_LABEL } from '../game/cards';
import type { PlayingCard } from '../game/types';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];

export const BACKGROUND_IMAGE_PATH = 'art/ui/background.png';
export const CARD_BACK_IMAGE_PATH = 'art/back/default.svg';
export const ALL_CARD_FACE_PATHS = RANKS.flatMap((rank) => SUITS.map((suit) => `art/cards/${rank}_${suit}.svg`));

export const CRITICAL_IMAGE_PATHS = [
  'art/ui/open-poker-logo.png',
  BACKGROUND_IMAGE_PATH,
  'art/ui/background.svg',
  'art/ui/chip.svg',
  'art/ui/coin.svg',
  'art/ui/btn_discard.svg',
  'art/ui/btn_new_run.svg',
  'art/ui/btn_options.svg',
  'art/ui/btn_play.svg',
  'art/ui/btn_run_info.svg',
  CARD_BACK_IMAGE_PATH,
  'art/back/default.png',
  'art/blinds/small.svg',
  'art/blinds/big.svg',
  'art/blinds/boss.svg',
  'art/jokers/joker_01.svg',
  'art/jokers/joker_02.svg',
  'art/jokers/joker_03.svg',
  'art/jokers/joker_04.svg',
  'art/jokers/joker_05.svg',
  'art/consumables/planet.svg',
  'art/consumables/spectral.svg',
  'art/consumables/tarot.svg',
  ...ALL_CARD_FACE_PATHS,
] as const;

export function cardFacePath(card: Pick<PlayingCard, 'rank' | 'suit'>): string {
  return `art/cards/${RANK_LABEL[card.rank]}_${card.suit}.svg`;
}

export function uniqueAssetPaths(paths: Iterable<string>): string[] {
  return [...new Set(paths)];
}
