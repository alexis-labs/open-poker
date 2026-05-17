# ADR 0001: Architecture Boundaries

- Status: Accepted
- Date: 2026-05-17

## Context

The project needs to scale gameplay systems (jokers, consumables, shop loop) while preserving rendering quality and contributor velocity.

Without clear boundaries, browser games quickly drift into hard-to-test code where rules, scene graph, and input events are tightly mixed.

## Decision

Open Poker enforces these boundaries:

1. Simulation state and rules live in `src/game`.
2. Rendering and animation adapters live in `src/render`.
3. Input uses semantic actions, with physical bindings in `src/input`.
4. Audio orchestration lives in `src/audio`.
5. DOM HUD and overlays remain outside the Three.js scene graph.
6. Save/debug snapshots serialize simulation state only.

## Consequences

### Positive

- Deterministic tests can cover core rules without WebGL or DOM.
- Visual systems can evolve independently from game logic.
- Bug reports become reproducible with seed/snapshot data.
- New contributors can reason about subsystem ownership quickly.

### Tradeoffs

- More explicit integration code in `src/main.ts`.
- Requires discipline to avoid shortcutting via direct renderer mutation.
