# Open Poker

Browser-based poker roguelike prototype built with TypeScript, Three.js, Vite, GSAP, and Howler.

Open Poker is a Balatro-inspired, open-source card game that runs entirely in the browser. The codebase is organized so simulation logic can evolve safely without coupling to rendering.

![Open Poker gameplay example](public/examples/gameplay-example.png)

## What is implemented

- 3D table and card rendering with Three.js.
- Poker hand evaluation with chips x multiplier scoring.
- Seeded runs with antes, blinds, hands, discards, deck, and score targets.
- Play and discard loop, scoring popup, and win/lose overlays.
- Optional art overrides from `public/art`.
- Procedural audio via Howler.
- Deterministic run snapshots for debugging and tests.
- Debug overlay toggle (`F3` or `` ` ``) with runtime and renderer metrics.

## Getting started

### Requirements

- Node.js 20+
- npm

### Install and run

```bash
npm install
npm run dev
```

The dev server runs on a local Vite URL (typically `http://localhost:5173`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with hot reload. |
| `npm run typecheck` | Run TypeScript checks (`--noEmit`). |
| `npm run test` | Run unit tests once. |
| `npm run test:watch` | Run unit tests in watch mode. |
| `npm run test:coverage` | Run unit tests with v8 coverage. |
| `npm run test:smoke` | Run browser smoke playtest with Playwright. |
| `npm run build` | Typecheck and produce production build. |
| `npm run check` | Project quality gate (`typecheck + coverage + build`). |
| `npm run preview` | Serve production build locally. |
| `npm run gen-art` | Generate placeholder art into `public/art`. |

## Project structure

```text
src/
  main.ts          App bootstrap (state + render + input + HUD).
  game/            Renderer-agnostic simulation rules and run state.
  render/          Three.js scene, cards, effects, and interaction.
  audio/           Audio manager and procedural synthesis.
  input/           Input action map and physical-key bindings.
public/
  art/             Optional asset overrides (cards, backs, blinds, UI).
  examples/        Media used in docs.
tests/
  unit/            Vitest coverage over game logic.
  smoke/           Playwright gameplay smoke checks.
docs/
  adr/             Architecture decision records.
```

## Deterministic debugging

- `GameState` exposes `toSnapshot()`, `loadSnapshot()`, and `reset(seed|snapshot)`.
- A test bridge is exposed in-browser as `window.__OPEN_POKER_TEST__` for automated smoke checks.
- The debug panel shows:
  - seed, phase, blind, ante
  - score and economy counters
  - hand/deck/discard counts
  - approximate FPS and renderer draw/triangle metrics

## Testing and CI

- Unit tests validate hand evaluation, scoring math, and run flow transitions.
- Coverage threshold is enforced for `src/game` in `vitest.config.ts`.
- GitHub Actions:
  - `build.yml`: `typecheck + test:coverage + build`
  - `playtest.yml`: Playwright smoke pass + HTML report artifact

## Performance budget (desktop first)

See [`docs/performance-budget.md`](docs/performance-budget.md).

Initial targets:
- 55+ FPS average during normal hand interactions on desktop.
- Keep draw calls stable and visible UI responsive during scoring bursts.

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md).

Suggested first areas:
- Poker edge-case correctness.
- HUD and interaction polish.
- Accessibility and responsive improvements.
- Additional gameplay systems (jokers, consumables, shop loop).
- Test coverage expansions and developer tooling.

See [`docs/good-first-issues.md`](docs/good-first-issues.md) for ready-to-pick starter tasks.

## License

MIT. See [`LICENSE`](LICENSE).
