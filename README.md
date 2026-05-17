# 🃏 Open Poker

<div align="center">

**A browser-based poker roguelike prototype built with TypeScript, Three.js, Vite, GSAP, and Howler.**

Fast to run, deterministic to debug, and friendly to tinker with.

[🚀 Quick start](#quick-start) • [✨ Features](#features) • [🧪 Testing](#testing--ci) • [🤝 Contributing](#contributing)

</div>

![Open Poker gameplay example](public/examples/gameplay-example.png)

## 💡 What is Open Poker?

Open Poker is a Balatro-inspired, open-source card game that runs entirely in the browser. The project keeps gameplay simulation separate from rendering, so rules can evolve safely while the 3D table, effects, audio, and UI keep getting polished.

| 🎮 Playable loop | 🧠 Deterministic core | 🛠️ Hackable stack |
| --- | --- | --- |
| Play hands, discard cards, beat blinds, and chase score targets. | Seeded runs and snapshots make bugs easier to reproduce. | TypeScript, Three.js, Vite, Vitest, Playwright, GSAP, and Howler. |

<a id="features"></a>

## ✨ Features

- 🃏 **Poker hand evaluation** with chips x multiplier scoring.
- 🎲 **Seeded runs** with antes, blinds, hands, discards, deck state, and score targets.
- 🪄 **3D table and card rendering** powered by Three.js.
- 💥 **Juicy feedback** with scoring popups and win/lose overlays.
- 🎨 **Optional art overrides** from `public/art`.
- 🔊 **Procedural audio** via Howler.
- 🧪 **Deterministic snapshots** for debugging and tests.
- 📊 **Debug overlay** with `F3` or `` ` `` for runtime and renderer metrics.

<a id="quick-start"></a>

## 🚀 Quick start

### Requirements

- ✅ Node.js 20+
- ✅ npm

### Install and run

```bash
npm install
npm run dev
```

The Vite dev server will start locally, usually at:

```text
http://localhost:5173
```

## 🧰 Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | 🚀 Start the Vite dev server with hot reload. |
| `npm run typecheck` | 🔎 Run TypeScript checks with `--noEmit`. |
| `npm run test` | 🧪 Run unit tests once. |
| `npm run test:watch` | 👀 Run unit tests in watch mode. |
| `npm run test:coverage` | 📈 Run unit tests with v8 coverage. |
| `npm run test:smoke` | 🎮 Run the Playwright browser smoke playtest. |
| `npm run build` | 📦 Typecheck and create a production build. |
| `npm run check` | ✅ Run the project quality gate: typecheck, coverage, and build. |
| `npm run preview` | 🖥️ Serve the production build locally. |
| `npm run gen-art` | 🎨 Generate placeholder art into `public/art`. |

## 🗺️ Project map

```text
src/
  main.ts          App bootstrap: state, render, input, and HUD.
  game/            Renderer-agnostic simulation rules and run state.
  render/          Three.js scene, cards, effects, and interaction.
  audio/           Audio manager and procedural synthesis.
  input/           Input action map and physical-key bindings.
public/
  art/             Optional asset overrides: cards, backs, blinds, UI.
  examples/        Media used in docs.
tests/
  unit/            Vitest coverage over game logic.
  smoke/           Playwright gameplay smoke checks.
docs/
  adr/             Architecture decision records.
```

## 🧭 Deterministic debugging

Open Poker is designed to make bugs reproducible instead of mysterious.

- 🧬 `GameState` exposes `toSnapshot()`, `loadSnapshot()`, and `reset(seed|snapshot)`.
- 🌉 A browser test bridge is available as `window.__OPEN_POKER_TEST__` for automated smoke checks.
- 📟 The debug panel shows:
  - seed, phase, blind, and ante
  - score and economy counters
  - hand, deck, and discard counts
  - approximate FPS plus renderer draw/triangle metrics

<a id="testing--ci"></a>

## 🧪 Testing & CI

- ✅ Unit tests validate hand evaluation, scoring math, and run flow transitions.
- 📈 Coverage thresholds are enforced for `src/game` in `vitest.config.ts`.
- 🤖 GitHub Actions:
  - `build.yml`: `typecheck + test:coverage + build`
  - `playtest.yml`: Playwright smoke pass + HTML report artifact

## ⚡ Performance budget

See [`docs/performance-budget.md`](docs/performance-budget.md).

Initial desktop-first targets:

- 🎯 55+ FPS average during normal hand interactions.
- 🧊 Stable draw calls and responsive visible UI during scoring bursts.

<a id="contributing"></a>

## 🤝 Contributing

Contributions are welcome! Start with [`CONTRIBUTING.md`](CONTRIBUTING.md).

Good first areas to explore:

- 🃏 Poker edge-case correctness.
- ✨ HUD and interaction polish.
- ♿ Accessibility and responsive improvements.
- 🛒 Additional gameplay systems such as jokers, consumables, and shop loop.
- 🧰 Test coverage expansions and developer tooling.

See [`docs/good-first-issues.md`](docs/good-first-issues.md) for ready-to-pick starter tasks.

## 📄 License

MIT. See [`LICENSE`](LICENSE).
