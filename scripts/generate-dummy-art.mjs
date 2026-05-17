// Generates dummy SVG art for every graphic asset in the game.
// Run with:  node scripts/generate-dummy-art.mjs
//
// Output: public/art/{cards,back,blinds,jokers,ui}/*.svg
// SVGs are pure text — easy to open in any editor (or replace with PNGs of
// the same basename; cardTextures.ts will pick either up automatically).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');

function write(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

// ---------- Cards ----------
const SUITS = {
  hearts:   { glyph: '\u2665', color: '#e23b3b' },
  diamonds: { glyph: '\u2666', color: '#e23b3b' },
  spades:   { glyph: '\u2660', color: '#1a1a1a' },
  clubs:    { glyph: '\u2663', color: '#1a1a1a' },
};
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function cardSVG(rank, suit) {
  const { glyph, color } = SUITS[suit];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 360" width="256" height="360">
  <!-- DUMMY ART — replace this file with your own (same name, .svg or .png) -->
  <rect x="6" y="6" width="244" height="348" rx="22" ry="22" fill="#fdfdfd" stroke="#222" stroke-width="4"/>
  <g font-family="'Trebuchet MS', sans-serif" font-weight="700" fill="${color}">
    <text x="22" y="70" font-size="56" text-anchor="start">${rank}</text>
    <text x="22" y="118" font-size="48" text-anchor="start" font-family="serif">${glyph}</text>
    <g transform="translate(234 330) rotate(180)">
      <text x="0" y="0" font-size="56">${rank}</text>
      <text x="0" y="48" font-size="48" font-family="serif">${glyph}</text>
    </g>
    <text x="128" y="220" font-size="160" font-family="serif" text-anchor="middle">${glyph}</text>
  </g>
  <text x="128" y="350" font-size="10" text-anchor="middle" fill="#888" font-family="monospace">${rank}_${suit}.svg</text>
</svg>
`;
}

for (const rank of RANKS) {
  for (const suit of Object.keys(SUITS)) {
    write(`cards/${rank}_${suit}.svg`, cardSVG(rank, suit));
  }
}

// ---------- Back ----------
const backSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 360" width="256" height="360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7a1622"/>
      <stop offset="1" stop-color="#3a0a12"/>
    </linearGradient>
    <pattern id="hatch" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 14 L14 0 M-1 1 L1 -1 M13 15 L15 13" stroke="rgba(240,192,96,0.25)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect x="6" y="6" width="244" height="348" rx="22" ry="22" fill="url(#bg)"/>
  <rect x="6" y="6" width="244" height="348" rx="22" ry="22" fill="url(#hatch)"/>
  <rect x="18" y="18" width="220" height="324" rx="16" ry="16" fill="none" stroke="#f0c060" stroke-width="3"/>
  <text x="128" y="210" font-size="96" font-family="serif" text-anchor="middle" fill="#f0c060">\u2660</text>
  <text x="128" y="350" font-size="10" text-anchor="middle" fill="#f0c060" font-family="monospace">back/default.svg</text>
</svg>
`;
write('back/default.svg', backSVG);

// ---------- Blind badges ----------
function blindSVG(kind, label, fillStops) {
  const [c0, c1, c2] = fillStops;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="g" cx="0.35" cy="0.3" r="0.7">
      <stop offset="0" stop-color="${c0}"/>
      <stop offset="0.55" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </radialGradient>
  </defs>
  <circle cx="64" cy="64" r="58" fill="url(#g)" stroke="#000" stroke-width="6"/>
  <circle cx="64" cy="64" r="50" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
  <text x="64" y="60" font-size="13" font-family="'Silkscreen', monospace" font-weight="700"
        text-anchor="middle" fill="#3a1a08">${label[0]}</text>
  <text x="64" y="78" font-size="13" font-family="'Silkscreen', monospace" font-weight="700"
        text-anchor="middle" fill="#3a1a08">${label[1] ?? ''}</text>
  <text x="64" y="124" font-size="6" text-anchor="middle" fill="#000" font-family="monospace">blinds/${kind}.svg</text>
</svg>
`;
}
write('blinds/small.svg', blindSVG('small', ['SMALL', 'BLIND'], ['#f2c14a', '#c88a1a', '#6b3a08']));
write('blinds/big.svg',   blindSVG('big',   ['BIG',   'BLIND'], ['#f2843a', '#a4421a', '#5a1f08']));
write('blinds/boss.svg',  blindSVG('boss',  ['BOSS',  ''     ], ['#d04848', '#7a1818', '#3a0606']));

// ---------- Jokers ----------
function jokerSVG(id, name, hue) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 176" width="128" height="176">
  <defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 70%, 60%)"/>
      <stop offset="1" stop-color="hsl(${hue}, 80%, 25%)"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="168" rx="10" ry="10" fill="url(#g${id})" stroke="#000" stroke-width="4"/>
  <rect x="10" y="10" width="108" height="156" rx="6" ry="6" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
  <circle cx="64" cy="76" r="34" fill="rgba(255,255,255,0.18)" stroke="#000" stroke-width="2"/>
  <text x="64" y="86" font-size="40" text-anchor="middle" fill="#fff" font-family="serif">?</text>
  <text x="64" y="135" font-size="11" text-anchor="middle" fill="#fff"
        font-family="'Silkscreen', monospace" font-weight="700">${name}</text>
  <text x="64" y="168" font-size="7" text-anchor="middle" fill="#000" font-family="monospace">jokers/${id}.svg</text>
</svg>
`;
}
const JOKERS = [
  ['joker_01', 'JOKER',  10],
  ['joker_02', 'GREEDY', 110],
  ['joker_03', 'LUSTY',  340],
  ['joker_04', 'WRATHFUL', 0],
  ['joker_05', 'GLUTTON', 50],
];
for (const [id, name, hue] of JOKERS) {
  write(`jokers/${id}.svg`, jokerSVG(id, name, hue));
}

// ---------- Consumables ----------
function consumableSVG(id, label, hue) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 156" width="112" height="156">
  <rect x="4" y="4" width="104" height="148" rx="10" ry="10"
        fill="hsl(${hue}, 60%, 35%)" stroke="#000" stroke-width="4"/>
  <rect x="10" y="10" width="92" height="136" rx="6" ry="6"
        fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
  <text x="56" y="90" font-size="48" text-anchor="middle" fill="#fff" font-family="serif">\u2605</text>
  <text x="56" y="118" font-size="10" text-anchor="middle" fill="#fff"
        font-family="'Silkscreen', monospace" font-weight="700">${label}</text>
  <text x="56" y="148" font-size="6" text-anchor="middle" fill="#000" font-family="monospace">${id}.svg</text>
</svg>
`;
}
write('consumables/tarot.svg',  consumableSVG('consumables/tarot',  'TAROT',  280));
write('consumables/planet.svg', consumableSVG('consumables/planet', 'PLANET', 200));
write('consumables/spectral.svg', consumableSVG('consumables/spectral', 'SPECTRAL', 240));

// ---------- UI ----------
function buttonSVG(id, label, color) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 64" width="220" height="64">
  <defs>
    <linearGradient id="b${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color[0]}"/>
      <stop offset="1" stop-color="${color[1]}"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="212" height="56" rx="12" ry="12" fill="url(#b${id})" stroke="#000" stroke-width="3"/>
  <rect x="9" y="9" width="202" height="46" rx="9" ry="9" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
  <text x="110" y="40" font-size="18" font-family="'Silkscreen', monospace" font-weight="700"
        text-anchor="middle" fill="#fff">${label}</text>
  <text x="110" y="58" font-size="6" text-anchor="middle" fill="#000" font-family="monospace">ui/${id}.svg</text>
</svg>
`;
}
write('ui/btn_play.svg',     buttonSVG('btn_play',     'PLAY HAND', ['#4ad06a', '#1d7a36']));
write('ui/btn_discard.svg',  buttonSVG('btn_discard',  'DISCARD',   ['#ff6464', '#a82424']));
write('ui/btn_new_run.svg',  buttonSVG('btn_new_run',  'NEW RUN',   ['#6a5444', '#3a2a1f']));
write('ui/btn_run_info.svg', buttonSVG('btn_run_info', 'RUN INFO',  ['#ff6464', '#a82424']));
write('ui/btn_options.svg',  buttonSVG('btn_options',  'OPTIONS',   ['#f29033', '#c25f1a']));

// Felt background
const bgSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="felt" cx="0.5" cy="0.5" r="0.8">
      <stop offset="0" stop-color="#2d6b46"/>
      <stop offset="0.6" stop-color="#1a3a2a"/>
      <stop offset="1" stop-color="#0d1a14"/>
    </radialGradient>
    <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.2" fill="rgba(255,255,255,0.04)"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#felt)"/>
  <rect width="100%" height="100%" fill="url(#dots)"/>
  <text x="960" y="1060" font-size="14" text-anchor="middle" fill="#fff" opacity="0.4" font-family="monospace">ui/background.svg</text>
</svg>
`;
write('ui/background.svg', bgSVG);

// Chip + coin icons
const chipSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="28" fill="#5bb8ff" stroke="#000" stroke-width="4"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="#fff" stroke-dasharray="4 4" stroke-width="2"/>
  <text x="32" y="40" font-size="22" text-anchor="middle" fill="#fff" font-family="'Silkscreen', monospace" font-weight="700">\u2731</text>
</svg>
`;
write('ui/chip.svg', chipSVG);

const coinSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="28" fill="#ffd24a" stroke="#000" stroke-width="4"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>
  <text x="32" y="42" font-size="28" text-anchor="middle" fill="#5a3a08" font-family="serif" font-weight="700">$</text>
</svg>
`;
write('ui/coin.svg', coinSVG);

console.log('Generated dummy art under public/art/');
