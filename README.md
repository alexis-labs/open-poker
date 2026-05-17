# 🃏 Open Poker

<div align="center">

**An open-source Balatro clone that runs entirely in the browser.**

Built with TypeScript, Three.js, Vite, GSAP, and Howler. Fast to run, deterministic to debug, and friendly to tinker with.

[🚀 Quick start](#quick-start) • [🎮 Gameplay](#gameplay) • [✨ Features](#features) • [🧪 Testing](#testing--ci) • [🤝 Contributing](#contributing)

</div>

![Open Poker gameplay example](public/examples/gameplay-example.png)

> **Disclaimer:** This is a fan-made, non-commercial open-source project. It is not affiliated with or endorsed by [LocalThunk](https://localthunk.com/) or [Playstack](https://www.playstack.com/), the creators of [Balatro](https://www.playbalatro.com/). All original Balatro content, design, and trademarks belong to their respective owners.

## 💡 What is this?

Open Poker is a faithful browser-based clone of **[Balatro](https://www.playbalatro.com/)** — the award-winning poker roguelike by LocalThunk. Balatro is a game where you play poker hands against escalating score targets, using jokers and card modifiers to build powerful, chain-reacting scoring combos.

This project reimplements Balatro's core mechanics from scratch in TypeScript, keeping gameplay simulation cleanly separated from rendering so rules can evolve safely while the 3D table, card effects, audio, and UI get polished.

| 🎮 Playable loop | 🧠 Deterministic core | 🛠️ Hackable stack |
| --- | --- | --- |
| Play hands, discard cards, beat blinds, and chase score targets. | Seeded runs and snapshots make bugs easier to reproduce. | TypeScript, Three.js, Vite, Vitest, Playwright, GSAP, and Howler. |

<a id="gameplay"></a>

## 🎮 Gameplay

Open Poker replicates Balatro's core loop:

1. **Deal** — 8 cards are dealt from a standard 52-card deck.
2. **Select & Play** — Choose up to 5 cards to play as a poker hand.
3. **Score** — The hand scores `(base chips + card chips) × multiplier`. Beat the blind's target score to advance.
4. **Discard** — Optionally discard up to 3 cards per round to fish for better hands.
5. **Progress** — Clear Small Blind → Big Blind → Boss Blind to advance the ante, increasing score targets.

### Scoring formula

Balatro's scoring works differently from standard poker — **only scoring cards contribute chips**:

```
Score = (Hand Base Chips + Σ scoring card chips) × (Hand Base Mult + modifiers)
```

For example, a Pair scores only the two matching cards' chip values. Straights, Flushes, Full Houses, and higher hands score all 5 cards.

### Hand types (all 12 Balatro hands implemented)

| Hand | Base Chips | Base Mult |
| --- | --- | --- |
| High Card | 5 | 1 |
| Pair | 10 | 2 |
| Two Pair | 20 | 2 |
| Three of a Kind | 30 | 3 |
| Straight | 30 | 4 |
| Flush | 35 | 4 |
| Full House | 40 | 4 |
| Four of a Kind | 60 | 7 |
| Straight Flush | 100 | 8 |
| Five of a Kind | 120 | 12 |
| Flush House | 140 | 14 |
| Flush Five | 160 | 16 |

> Five of a Kind, Flush House, and Flush Five are Balatro-exclusive hand types not found in standard poker.

### Ante curve

Score targets escalate across 8 antes, following Balatro's progression: `300 → 800 → 2 000 → 5 000 → 11 000 → 20 000 → 35 000 → 50 000`.

<a id="features"></a>

## ✨ Features

### Implemented

- 🃏 **All 12 Balatro hand types** evaluated and scored correctly.
- 💯 **Chips × Mult scoring** — only scoring cards contribute chips, matching Balatro's exact rules.
- 📈 **Hand levelling** — each hand type tracks its own level, chips, and mult (upgradeable via Planet cards in a future shop system).
- 🎲 **Seeded runs** — fully deterministic with antes, blinds, hands, discards, deck state, and score targets.
- 🃏 **Card enhancements** — Bonus (+30 chips), Mult (+4 mult), Wild (any suit), Glass (×2 mult, 1/4 break chance), Steel (×1.5 while in hand), Stone (+50 chips, no rank/suit), Gold ($3 at round end), Lucky (random mult/money).
- 🔖 **Card seals** — Gold, Red, Blue, and Purple seals.
- ✨ **Card editions** — Foil (+50 chips), Holographic (+10 mult), Polychrome (×1.5 mult), Negative.
- 🪄 **3D table and card rendering** powered by Three.js.
- 💥 **Scoring popups** with animated Chips × Mult readouts and win/lose overlays.
- 🎨 **Optional art overrides** — drop custom sprites into `public/art/` to replace placeholder art.
- 🔊 **Procedural audio** via Howler and a custom synth engine.
- 🧪 **Deterministic snapshots** — save and restore full run state for debugging and tests.
- 📊 **Debug overlay** (`F3` or `` ` ``) with seed, phase, blind, ante, score, FPS, and renderer metrics.

### Planned / not yet implemented

- 🃏 Joker system (passive effects that chain during scoring).
- 🛒 Shop loop (buy/sell jokers, consumables, card packs between rounds).
- 🎴 Consumables (Tarot cards, Planet cards, Spectral cards).
- 👁️ Boss blind special effects.
- 📱 Mobile / touch support.

<a id="quick-start"></a>

## 🚀 Quick start

### Requirements

- Node.js 20+
- npm

### Install and run

```bash
npm install
npm run dev
```

The Vite dev server starts at:

```
http://localhost:5173
```

### Controls

| Action | Key / Click |
| --- | --- |
| Select / deselect card | Click card |
| Play selected cards | `Enter` or Play button |
| Discard selected cards | `Backspace` or Discard button |
| Restart run | `R` |
| Toggle debug overlay | `F3` or `` ` `` |

## 🧰 Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload. |
| `npm run typecheck` | Run TypeScript checks with `--noEmit`. |
| `npm run test` | Run unit tests once. |
| `npm run test:watch` | Run unit tests in watch mode. |
| `npm run test:coverage` | Run unit tests with v8 coverage. |
| `npm run test:smoke` | Run the Playwright browser smoke playtest. |
| `npm run build` | Typecheck and create a production build. |
| `npm run check` | Run the full quality gate: typecheck + coverage + build. |
| `npm run preview` | Serve the production build locally. |
| `npm run gen-art` | Generate placeholder art into `public/art/`. |

## 🗺️ Project map

```text
src/
  main.ts              App bootstrap: state, render, input, and HUD.
  game/
    types.ts           Core domain types (cards, hands, run phases).
    cards.ts           Deck building, RNG, and shuffle utilities.
    pokerEngine.ts     Hand detection and Balatro-style scoring.
    gameState.ts       Run-level state machine (antes, blinds, phases).
  render/
    ThreeScene.ts      Three.js scene setup and card layout.
    CardObject.ts      3D card mesh with texture and animation.
    cardTextures.ts    Texture loading and art override resolution.
    Interaction.ts     Mouse / pointer event handling.
    Particles.ts       Particle effects for scoring feedback.
  audio/
    AudioManager.ts    Global audio singleton.
    musicEngine.ts     Procedural background music.
    synth.ts           Web Audio API synth primitives.
  input/
    actions.ts         Semantic action map and keyboard bindings.
public/
  art/                 Optional asset overrides: cards, backs, blinds, UI.
  examples/            Media used in docs.
tests/
  unit/                Vitest unit tests for game logic.
  smoke/               Playwright browser smoke tests.
docs/
  adr/                 Architecture decision records.
```

## 🏗️ Architecture

The project enforces a strict separation between simulation and rendering:

- **`src/game/`** — Pure TypeScript, no DOM or Three.js imports. All game rules live here.
- **`src/render/`** — Three.js rendering only. Reads from `GameState`; never mutates it directly.
- **`src/audio/`** — Audio concerns only.
- **`src/input/`** — Physical key bindings mapped to semantic `InputAction` values.

This boundary means the poker engine can be unit-tested headlessly at full speed, and the renderer can be swapped out without touching any rules. See [`docs/adr/0001-architecture-boundaries.md`](docs/adr/0001-architecture-boundaries.md) for the full contract.

## 🧭 Deterministic debugging

Open Poker is designed to make bugs reproducible instead of mysterious.

- `GameState` exposes `toSnapshot()`, `loadSnapshot()`, and `reset(seed | snapshot)`.
- A browser test bridge is available as `window.__OPEN_POKER_TEST__` for automated smoke checks.
- The debug panel (`F3` / `` ` ``) shows:
  - seed, phase, blind, and ante
  - score and economy counters
  - hand, deck, and discard counts
  - approximate FPS plus renderer draw/triangle metrics

<a id="testing--ci"></a>

## 🧪 Testing & CI

- Unit tests (`tests/unit/`) validate hand evaluation, scoring math, and run flow transitions.
- Coverage thresholds are enforced for `src/game/` in `vitest.config.ts`.
- GitHub Actions:
  - `build.yml` — `typecheck + test:coverage + build`
  - `playtest.yml` — Playwright smoke pass + HTML report artifact

## ⚡ Performance budget

See [`docs/performance-budget.md`](docs/performance-budget.md).

Desktop-first targets:

- 55+ FPS average during normal hand interactions.
- Stable draw calls and responsive UI during scoring bursts.

<a id="contributing"></a>

## 🤝 Contributing

Contributions are welcome! Start with [`CONTRIBUTING.md`](CONTRIBUTING.md).

Good first areas:

- 🃏 Poker edge-case correctness.
- ✨ HUD and interaction polish.
- ♿ Accessibility and responsive improvements.
- 🃏 Joker system and shop loop.
- 🎴 Consumable cards (Tarot, Planet, Spectral).
- 🧰 Test coverage and developer tooling.

See [`docs/good-first-issues.md`](docs/good-first-issues.md) for ready-to-pick starter tasks.

## 📄 License

MIT. See [`LICENSE`](LICENSE).

---

*Open Poker is a fan project. If you enjoy this, please support the original — [buy Balatro](https://www.playbalatro.com/).*
