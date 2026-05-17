# Contributing To Open Poker

Thanks for wanting to help. This project is early, so clear issues, small pull requests, and practical feedback are especially valuable.

## Ways To Contribute

- Report bugs with steps to reproduce.
- Suggest focused gameplay, UI, audio, or accessibility improvements.
- Improve poker scoring correctness and edge cases.
- Add tests around game state and hand evaluation.
- Add or improve art in `public/art`.
- Improve documentation for setup, architecture, and contributor workflows.

## Local Setup

```bash
npm install
npm run dev
```

Use `npm run build` before opening a pull request.

## Pull Request Checklist

- Keep the change focused on one problem or feature.
- Explain what changed and why.
- Include screenshots or short clips for visible UI, animation, or art changes.
- Mention any known limitations or follow-up work.
- Run `npm run build` and include the result in the PR description.

## Code Guidelines

- Follow the existing TypeScript style.
- Keep game logic in `src/game` when it does not need renderer details.
- Keep Three.js rendering and input behavior in `src/render`.
- Prefer readable names over abbreviations.
- Avoid broad refactors in feature or bug-fix pull requests.

## Art Contributions

Art files live under `public/art` and are served from `/art/...` at runtime.

- Card faces use `{RANK}_{suit}.png`, for example `A_spades.png` or `10_hearts.png`.
- Card backs use `public/art/back/default.png`.
- Blind badges use `small.png`, `big.png`, and `boss.png`.

See `public/art/README.md` for the full asset guide.

Only submit art that you created yourself, have permission to contribute, or can clearly license for the project.

## Reporting Bugs

When reporting a bug, include:

- What you expected to happen.
- What actually happened.
- Steps to reproduce it.
- Browser and operating system.
- Screenshots, console errors, or short videos if useful.

## Community Standards

Please follow `CODE_OF_CONDUCT.md`. Keep discussions kind, specific, and useful.