# Game Art

Drop image files (PNG / JPG / WEBP — PNG recommended for transparency) into the
folders below. They are served from `/art/...` at runtime; if a file exists, it
**replaces the procedural texture** automatically — no code changes needed.

Recommended resolution: **256 × 360** for cards (keeps the same aspect as the
3D card mesh), **64 × 88** or larger for joker / consumable / blind art.

```
public/art/
├── cards/        Card faces.   Filename:  {RANK}_{suit}.png
│                                 RANK = 2..10, J, Q, K, A
│                                 suit = hearts, diamonds, spades, clubs
│                                 Examples:  A_spades.png, 10_hearts.png, Q_clubs.png
│
├── back/         Card back.    Filename:  default.png
│
├── jokers/       Joker cards.  Filename:  {joker_id}.png  (free-form; wire when joker data exists)
│
├── blinds/       Blind badges. Filename:  small.png | big.png | boss.png
│
└── ui/           Misc UI art:  buttons, chips, icons, etc.
```

## How fallback works

`src/render/cardTextures.ts` first paints the procedural face, then asynchronously
tries to load the matching PNG. If it loads, the PNG replaces the canvas image
and the texture refreshes in place. If it 404s (or fails for any reason) the
procedural art stays. This means you can drop in art piecemeal — half-done sets
work fine.
