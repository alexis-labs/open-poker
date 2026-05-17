# Good First Issues

These are intentionally scoped for first-time contributors and aligned with the current quality backbone (tests + deterministic debugging + desktop-first UX).

## Gameplay and rules

1. Add unit tests for additional poker edge cases (wild interactions, duplicate-rank tie scenarios).
2. Add score-step labels to expose which card/bonus changed chips or multiplier.
3. Implement and test one consumable placeholder effect in `src/game`.

## UI and interaction

1. Add keyboard hint tooltips for mapped actions (`Enter`, `Backspace`, `R`, `M`, `F3`).
2. Improve small-screen layout behavior without reducing desktop clarity.
3. Add optional reduced-motion mode for popup and card animation timing.

## Rendering and performance

1. Add a lightweight debug readout for object counts in the scene.
2. Add a stress-test helper to deal and clear many hands for manual perf checks.
3. Document draw-call trends before/after common interactions.

## QA and docs

1. Add one more Playwright smoke scenario for restart flow and mute toggle.
2. Add bug-report examples using seed/snapshot reproduction steps.
3. Improve contributor docs with a short architecture map image or diagram.
