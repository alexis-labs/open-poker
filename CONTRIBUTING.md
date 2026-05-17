# Contributing to Open Poker

Thanks for helping build Open Poker.

This project is still early, so focused pull requests with clear intent are the fastest way to move it forward.

## Local setup

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run check
```

## Development boundaries

- Keep simulation and game rules in `src/game`.
- Keep Three.js rendering concerns in `src/render`.
- Keep physical input bindings in `src/input` and map them to semantic actions.
- Keep audio concerns in `src/audio`.
- Do not couple core rules to DOM or Three.js objects.

See [`docs/adr/0001-architecture-boundaries.md`](docs/adr/0001-architecture-boundaries.md) for the architecture contract.

## Definition of Done

A change is done when all items below are true:

- The requested behavior is implemented and documented.
- `npm run check` passes locally.
- Existing tests pass and new behavior has test coverage when applicable.
- Visual changes include screenshots or short clips.
- Any tradeoffs, known gaps, or follow-up items are documented in the PR.

## Pull request checklist

- [ ] Change is scoped to a single feature/fix/theme.
- [ ] Title and summary explain what changed and why.
- [ ] Relevant tests were added or updated.
- [ ] `npm run check` passed.
- [ ] Screenshots/clips included for visible UI or animation changes.
- [ ] Follow-up items or limitations listed.

## Testing expectations

- Unit tests live under `tests/unit`.
- Smoke playtests live under `tests/smoke`.
- Coverage focuses on `src/game` (rules and run state).
- Reproduction-sensitive bug fixes should include deterministic cases (seed/snapshot).

## Reporting bugs

When opening a bug report, include:

- Steps to reproduce.
- Expected behavior vs actual behavior.
- Browser and OS.
- Seed and/or snapshot details when possible.
- Screenshot/video/console evidence.

## Coding guidelines

- Prefer readable names over abbreviations.
- Keep changes small and easy to review.
- Avoid broad refactors bundled with feature work.
- Add comments only where behavior is non-obvious.

## Asset contributions

Assets live in `public/art` and are loaded from `/art/...`.

- Cards: `{RANK}_{suit}.png` (for example `A_spades.png`, `10_hearts.png`).
- Card back: `public/art/back/default.png`.
- Blinds: `small.png`, `big.png`, `boss.png`.

See `public/art/README.md` for full details and fallback behavior.

Only submit assets you created or have explicit permission to contribute.

## Community

Please follow [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
