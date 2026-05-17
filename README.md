# Open Poker

Open Poker is a browser-based poker roguelike prototype built with Vite, TypeScript, Three.js, GSAP, and Howler. It currently focuses on a playable hand loop, Balatro-style poker scoring, animated 3D cards, procedural card textures, and optional drop-in art assets.

The goal of this repository is to make the project easy to run, understand, and extend with help from the community.

![Open Poker gameplay example](public/examples/gameplay-example.png)

## Current Features

- Seeded run state with antes, blinds, hands, discards, deck, and score targets.
- Poker hand evaluation and Balatro-style chip x multiplier scoring.
- Interactive 3D card table rendered with Three.js.
- Card selection, play, discard, scoring popups, and game-over/win flow.
- Procedural card faces and backs with optional art overrides from `public/art`.
- Synthesized audio effects through Howler.

## Getting Started

### Requirements

- Node.js 20 or newer is recommended.
- npm, which is bundled with Node.js.

### Install

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173`.

### Build

```bash
npm run build
```

### Preview A Production Build

```bash
npm run preview
```

## Project Structure

```text
src/
  audio/      Audio manager and procedural sound synthesis.
  game/       Renderer-agnostic cards, game state, poker engine, and types.
  render/     Three.js scene, card objects, textures, particles, and input.
public/art/   Optional art overrides for cards, backs, blinds, jokers, and UI.
```

## Adding Art

Drop PNG, JPG, or WEBP files into `public/art`. Card art can be added one file at a time; missing images fall back to procedural textures automatically.

See `public/art/README.md` for filenames, recommended resolutions, and override behavior.

## Contributing

Contributions are welcome. Good first areas include:

- Poker rule fixes and scoring edge cases.
- UI polish, accessibility, and responsive layout improvements.
- 3D interaction improvements.
- Sound and animation tuning.
- Card, blind, joker, and UI art.
- Tests for the game and poker engine.
- Documentation improvements.

Before opening a pull request, please read `CONTRIBUTING.md`.

## Development Notes

- Keep game rules in `src/game` renderer-agnostic where possible.
- Keep Three.js-specific behavior in `src/render`.
- Prefer small, focused pull requests that are easy to review.
- Run `npm run build` before submitting changes.

## License

No license has been selected yet. Until a license is added, please ask before reusing this code or assets outside this repository.