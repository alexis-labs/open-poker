# Game Art

Drop image files into the folders below. They are served from `/art/...` at
runtime; if a file exists, it replaces the procedural texture automatically.
SVG, PNG, WEBP, and JPG are supported by the loader.

Recommended resolution: 256 x 360 for cards, matching the 3D card mesh aspect.
Joker, consumable, blind, and UI assets can be smaller, but should keep their
current aspect ratio if replaced.

```
public/art/
|-- cards/        Card faces.   Filename: {RANK}_{suit}.svg or .png
|                                RANK = 2..10, J, Q, K, A
|                                suit = hearts, diamonds, spades, clubs
|                                Examples: A_spades.svg, 10_hearts.png
|
|-- back/         Card back.    Filename: default.svg or .png
|
|-- jokers/       Joker cards.  Filename: {joker_id}.svg or .png
|
|-- blinds/       Blind badges. Filename: small.svg | big.svg | boss.svg
|
`-- ui/           Misc UI art: buttons, chips, icons, background, etc.
```

## Fallback behavior

`src/render/cardTextures.ts` first paints a procedural face, then
asynchronously tries to load the matching SVG/PNG/WEBP/JPG. If it loads, that
asset replaces the canvas image and the texture refreshes in place. If it 404s
or fails for any reason, the procedural art stays.
