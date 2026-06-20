# AGENTS.md - Index for AI agents

> Quick guide for any agent (Copilot, Claude, Cursor, etc.) to understand the code structure, architecture boundaries, and where to make safe changes.

## 1. What this project is

**Open Poker** - an open-source *Balatro* clone that runs 100% in the browser.
Stack: **TypeScript + Vite + Three.js + GSAP + Howler**, with tests in **Vitest** (unit) and **Playwright** (smoke).

The goal is to keep the **deterministic simulation** (poker rules, scoring, run state) fully separated from the **3D rendering layer**, audio, and input. See [docs/adr/0001-architecture-boundaries.md](docs/adr/0001-architecture-boundaries.md).

## 2. Repository map

```text
open-poker/
|-- index.html              # Entry HTML (Vite)
|-- src/
|   |-- main.ts             # Bootstrap: connects GameState <-> Three.js <-> Input <-> HUD
|   |-- style.css           # Global styles + DOM HUD
|   |-- game/               # PURE SIMULATION (no DOM, no Three.js)
|   |   |-- types.ts        # Shared types (PlayingCard, ScoreBreakdown, RunSnapshot, InputAction...)
|   |   |-- cards.ts        # Deck, deterministic shuffle (seed)
|   |   |-- pokerEngine.ts  # evaluateHand(): detection and scoring for the 12 Balatro hands
|   |   |-- gameState.ts    # Run state machine (deal, select, play, discard, ante)
|   |   |-- combat/         # Reserved for future combat/joker systems
|   |   `-- run/            # Reserved for meta-progression, shop, runs
|   |-- render/             # VISUAL ADAPTERS (Three.js + GSAP)
|   |   |-- ThreeScene.ts   # Scene, camera, lights, hand/play layout
|   |   |-- CardObject.ts   # 3D mesh for a card + animations
|   |   |-- cardTextures.ts # Card texture generation/cache
|   |   |-- Interaction.ts  # Raycasting, hover, drag, selection
|   |   `-- Particles.ts    # Particle effects (score pops, etc.)
|   |-- input/
|   |   `-- actions.ts      # Semantic actions + keyboard bindings
|   |-- audio/              # AUDIO ORCHESTRATION (Howler + WebAudio)
|   |   |-- AudioManager.ts # `audio` singleton, sfx + music
|   |   |-- musicEngine.ts  # Adaptive music loop
|   |   `-- synth.ts        # Procedural sfx synthesis
|   `-- assets/             # Static assets imported through Vite
|-- public/
|   |-- art/                # Art (cards/, back/, jokers/, blinds/, ui/, consumables/)
|   `-- examples/           # Screenshots for the README
|-- scripts/
|   `-- generate-dummy-art.mjs  # Generates placeholder art for development
|-- tests/
|   |-- unit/               # Vitest - pokerEngine, gameState
|   |-- smoke/              # Playwright - gameplay smoke
|   `-- helpers/            # Fixtures (cards, etc.)
|-- docs/
|   |-- adr/                # Architecture Decision Records
|   |-- good-first-issues.md
|   `-- performance-budget.md
|-- package.json
|-- vite.config.* / tsconfig.json / vitest.config.ts / playwright.config.ts
`-- README.md
```

## 3. Architecture boundaries (non-negotiable rules)

Defined in ADR-0001. **Do not** cross these boundaries without discussion:

| Layer | Folder | May import from | Must not |
|---|---|---|---|
| Simulation | `src/game/**` | only `src/game/**` | `three`, `gsap`, `howler`, DOM, `window` |
| Render | `src/render/**` | `src/game` (types/state), `three`, `gsap` | mutate `GameState` directly |
| Input | `src/input/**` | types from `src/game` | touch Three.js meshes |
| Audio | `src/audio/**` | `howler`, WebAudio | depend on `GameState` |
| HUD/DOM | `src/main.ts` + `style.css` | everything | live inside the scene graph |

The glue between subsystems lives in [src/main.ts](src/main.ts).

## 4. Key concepts

- **`GameState`** ([src/game/gameState.ts](src/game/gameState.ts)) - run state machine. Emits serializable snapshots (`RunSnapshot`) for debug/save.
- **`evaluateHand`** ([src/game/pokerEngine.ts](src/game/pokerEngine.ts)) - receives `PlayingCard[]`, returns `ScoreBreakdown` with `(baseChips + sum(scoringChips)) * mult`. Only *scoring cards* contribute chips (Balatro rule).
- **`InputAction`** ([src/input/actions.ts](src/input/actions.ts)) - semantic actions (`SELECT_CARD`, `PLAY_HAND`, `DISCARD`...) decoupled from physical keys.
- **`CardObject`** ([src/render/CardObject.ts](src/render/CardObject.ts)) - Mesh wrapper with an animation API (`moveTo`, `flip`, `highlight`).
- **Determinism** - all randomness goes through seeds in `cards.ts`. Bugs should be reproducible with a seed + snapshot.

## 5. Game loop (summary)

`Deal 8` -> `Select <=5` -> `Play` -> `evaluateHand -> score` -> `beat blind target` -> `Small -> Big -> Boss` -> `next ante` (8 antes: 300 -> 50,000).

12 hand types are implemented, including the Balatro-exclusive hands: **Five of a Kind**, **Flush House**, **Flush Five**.

## 6. Useful commands

```powershell
npm run dev              # Vite dev server
npm run typecheck        # tsc --noEmit
npm test                 # Vitest (unit)
npm run test:coverage    # coverage
npm run test:smoke       # Playwright
npm run build            # typecheck + production build
npm run check            # typecheck + coverage + build (local CI)
npm run gen-art          # generate placeholder art in public/art
```

> Windows note: see [/memories/repo/vite-windows-notes.md](#) (internal agent memory) for dev server specifics.

## 7. Where to make common changes

| Task | Edit first |
|---|---|
| New scoring rule / new hand type | [src/game/pokerEngine.ts](src/game/pokerEngine.ts) + tests in [tests/unit/pokerEngine.test.ts](tests/unit/pokerEngine.test.ts) |
| Change run flow (antes, blinds, discards) | [src/game/gameState.ts](src/game/gameState.ts) + [tests/unit/gameState.test.ts](tests/unit/gameState.test.ts) |
| Card animations / appearance | [src/render/CardObject.ts](src/render/CardObject.ts), [src/render/ThreeScene.ts](src/render/ThreeScene.ts) |
| Card textures | [src/render/cardTextures.ts](src/render/cardTextures.ts), `public/art/cards/` |
| Selection / drag / hover | [src/render/Interaction.ts](src/render/Interaction.ts) |
| New keyboard shortcut | [src/input/actions.ts](src/input/actions.ts) |
| Sound / music | [src/audio/AudioManager.ts](src/audio/AudioManager.ts) |
| HUD / overlays | [src/main.ts](src/main.ts) + [src/style.css](src/style.css) |
| Jokers / consumables / shop (future) | `src/game/combat/`, `src/game/run/` (create as needed) |

## 8. Checklist before proposing changes

1. `npm run typecheck` passes.
2. `npm test` is green (and tests are added if `src/game` changed).
3. No imports of `three`/`gsap`/`howler`/DOM were introduced inside `src/game`.
4. Visual changes include a screenshot or updated smoke test.
5. If rules changed: confirm against README section `Scoring` and the ante curve.

## 9. Files you should not edit

- `coverage/`, `playwright-report/`, `test-results/` - generated artifacts.
- `public/examples/*.png` - README assets.
- `LICENSE`, `CODE_OF_CONDUCT.md` - only with an explicit decision.
