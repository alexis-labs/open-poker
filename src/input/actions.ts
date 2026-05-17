import type { InputAction } from '../game/types';

export interface ActionBinding {
  action: InputAction;
  description: string;
  keys: string[];
}

export const INPUT_ACTIONS: ActionBinding[] = [
  { action: 'play_hand', description: 'Play selected cards', keys: ['Enter'] },
  { action: 'discard', description: 'Discard selected cards', keys: ['Backspace', 'Delete'] },
  { action: 'restart_run', description: 'Start a new run', keys: ['KeyR'] },
  { action: 'toggle_mute', description: 'Mute/unmute audio', keys: ['KeyM'] },
  { action: 'toggle_debug', description: 'Toggle debug overlay', keys: ['F3', 'Backquote'] },
];

export const UI_ACTION_BINDINGS: Record<string, InputAction> = {
  'btn-play': 'play_hand',
  'btn-discard': 'discard',
  'overlay-restart': 'restart_run',
  'btn-mute': 'toggle_mute',
  'btn-debug': 'toggle_debug',
};

const KEY_TO_ACTION = new Map<string, InputAction>(
  INPUT_ACTIONS.flatMap((binding) => binding.keys.map((key) => [key, binding.action] as const)),
);

export function actionFromKeyboard(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): InputAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  return KEY_TO_ACTION.get(event.code) ?? null;
}
