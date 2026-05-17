// Generates polished SVG art for every graphic asset in the game.
// Run with: node scripts/generate-dummy-art.mjs
//
// Output: public/art/{cards,back,blinds,jokers,consumables,ui}/*.svg
// The assets stay intentionally vector-only so they are easy to inspect,
// recolor, and replace with PNG/WEBP files later.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');

function write(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

// ---------- Cards ----------
const SUITS = {
  hearts: {
    glyph: '&#9829;',
    color: '#b4142a',
    deep: '#5f0713',
    tint: '#fff0f1',
    glow: '#f5a2ad',
  },
  diamonds: {
    glyph: '&#9830;',
    color: '#b4142a',
    deep: '#680814',
    tint: '#fff1ec',
    glow: '#f8b18d',
  },
  spades: {
    glyph: '&#9824;',
    color: '#151922',
    deep: '#04060a',
    tint: '#eef2f6',
    glow: '#aeb8c7',
  },
  clubs: {
    glyph: '&#9827;',
    color: '#151922',
    deep: '#050708',
    tint: '#edf3ed',
    glow: '#abc4ad',
  },
};

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function cardDefs(id, suit) {
  return `  <defs>
    <linearGradient id="${id}-paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.72" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f6f1e6"/>
    </linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f5d98c"/>
      <stop offset="0.5" stop-color="#c99a45"/>
      <stop offset="1" stop-color="#f3e0aa"/>
    </linearGradient>
    <filter id="${id}-shadow" x="-12%" y="-12%" width="124%" height="124%">
      <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#000000" flood-opacity="0.24"/>
    </filter>
  </defs>`;
}

function suitText(suit, x, y, size, rotate = 0, extra = '') {
  const transform = rotate ? ` transform="translate(${x} ${y}) rotate(${rotate})"` : ` transform="translate(${x} ${y})"`;
  return `<text${transform} x="0" y="0" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="${suit.color}" stroke="${suit.deep}" stroke-width="0.7" paint-order="stroke fill" font-family="Georgia, 'Times New Roman', serif" font-weight="700"${extra}>${suit.glyph}</text>`;
}

function rankText(rank, suit, x, y, size, rotate = 0) {
  const transform = rotate ? ` transform="translate(${x} ${y}) rotate(${rotate})"` : ` transform="translate(${x} ${y})"`;
  return `<text${transform} x="0" y="0" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="${suit.color}" stroke="#fff7df" stroke-width="1.1" paint-order="stroke fill" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="900">${rank}</text>`;
}

function cornerIndex(rank, suit) {
  const rankSize = rank === '10' ? 37 : 45;
  return `    <g>
      ${rankText(rank, suit, 33, 47, rankSize)}
      ${suitText(suit, 33, 84, 30)}
    </g>
    <g transform="translate(256 360) rotate(180)">
      ${rankText(rank, suit, 33, 47, rankSize)}
      ${suitText(suit, 33, 84, 30)}
    </g>`;
}

function cornerFlourishes(id) {
  return `    <g fill="none" stroke="url(#${id}-gold)" stroke-linecap="round" stroke-width="2.2" opacity="0.92">
      <path d="M25 26 H76"/>
      <path d="M25 26 V76"/>
      <path d="M34 40 C47 38 57 31 64 18"/>
      <path d="M230 26 H180"/>
      <path d="M230 26 V76"/>
      <path d="M222 40 C209 38 199 31 192 18"/>
      <path d="M25 334 H76"/>
      <path d="M25 334 V284"/>
      <path d="M34 320 C47 322 57 329 64 342"/>
      <path d="M230 334 H180"/>
      <path d="M230 334 V284"/>
      <path d="M222 320 C209 322 199 329 192 342"/>
    </g>`;
}

function cardBase(id, rank, suit, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 360" width="256" height="360">
${cardDefs(id, suit)}
  <rect x="7" y="8" width="242" height="345" rx="24" fill="#15100c" opacity="0.26" filter="url(#${id}-shadow)"/>
  <rect x="8" y="7" width="240" height="346" rx="24" fill="url(#${id}-paper)" stroke="#1c1712" stroke-width="2.6"/>
  <rect x="16" y="15" width="224" height="330" rx="18" fill="none" stroke="url(#${id}-gold)" stroke-width="2"/>
  <rect x="24" y="23" width="208" height="314" rx="13" fill="none" stroke="#d8c89e" stroke-opacity="0.34" stroke-width="1"/>
${body}
${cornerIndex(rank, suit)}
</svg>
`;
}

function minimalistBody(id, suit) {
  return `  <g>
    ${suitText(suit, 128, 188, 150)}
  </g>`;
}

function cardSVG(rank, suitName) {
  const suit = SUITS[suitName];
  const id = `card-${rank.toLowerCase()}-${suitName}`;
  const body = minimalistBody(id, suit);
  return cardBase(id, rank, suit, body);
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
    <linearGradient id="back-red" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8f1724"/>
      <stop offset="0.58" stop-color="#4a0711"/>
      <stop offset="1" stop-color="#190508"/>
    </linearGradient>
    <linearGradient id="back-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff0a8"/>
      <stop offset="0.45" stop-color="#b8781f"/>
      <stop offset="1" stop-color="#f8d77a"/>
    </linearGradient>
    <pattern id="back-grain" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="7" cy="8" r="0.9" fill="#fff2b8" fill-opacity="0.08"/>
      <circle cx="20" cy="19" r="0.8" fill="#000000" fill-opacity="0.1"/>
    </pattern>
    <filter id="back-shadow" x="-12%" y="-12%" width="124%" height="124%">
      <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect x="7" y="8" width="242" height="345" rx="24" fill="#000000" opacity="0.32" filter="url(#back-shadow)"/>
  <rect x="8" y="7" width="240" height="346" rx="24" fill="url(#back-red)" stroke="#120608" stroke-width="3"/>
  <rect x="8" y="7" width="240" height="346" rx="24" fill="url(#back-grain)"/>
  <rect x="17" y="16" width="222" height="328" rx="18" fill="none" stroke="url(#back-gold)" stroke-width="3"/>
  <rect x="27" y="26" width="202" height="308" rx="13" fill="none" stroke="#fff0a8" stroke-opacity="0.24" stroke-width="1.3"/>
  <circle cx="128" cy="180" r="76" fill="#190508" fill-opacity="0.38" stroke="url(#back-gold)" stroke-width="2.5"/>
  <path d="M128 78 C96 116 72 139 72 166 C72 194 95 211 119 202 C113 226 102 243 88 260 H168 C154 243 143 226 137 202 C161 211 184 194 184 166 C184 139 160 116 128 78 Z"
        fill="url(#back-gold)" stroke="#2a1204" stroke-width="2" stroke-linejoin="round"/>
</svg>
`;
write('back/default.svg', backSVG);

// ---------- Blind badges ----------
function chipEdgeMarks(fill = '#f8f1da') {
  return Array.from({ length: 12 }, (_, i) => {
    const rot = i * 30;
    return `<rect x="59" y="7" width="10" height="20" rx="2" fill="${fill}" transform="rotate(${rot} 64 64)"/>`;
  }).join('\n    ');
}

function blindSVG(kind, label, colors) {
  const [c0, c1, c2] = colors;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="${kind}-chip" cx="0.35" cy="0.28" r="0.76">
      <stop offset="0" stop-color="${c0}"/>
      <stop offset="0.55" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </radialGradient>
    <linearGradient id="${kind}-shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="59" fill="#130a07"/>
  <circle cx="64" cy="64" r="54" fill="url(#${kind}-chip)" stroke="#f2cf78" stroke-width="3"/>
  <g>
    ${chipEdgeMarks()}
  </g>
  <circle cx="64" cy="64" r="38" fill="#f9e7b2" stroke="#2b1605" stroke-width="3"/>
  <circle cx="64" cy="64" r="29" fill="none" stroke="#8a5c1e" stroke-width="2" stroke-dasharray="3 5"/>
  <path d="M29 34 C47 21 81 20 101 38" fill="none" stroke="url(#${kind}-shine)" stroke-width="6" stroke-linecap="round"/>
  <text x="64" y="59" font-size="14" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="900" text-anchor="middle" fill="#2b1605">${label[0]}</text>
  <text x="64" y="77" font-size="14" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="900" text-anchor="middle" fill="#2b1605">${label[1] ?? ''}</text>
</svg>
`;
}
write('blinds/small.svg', blindSVG('small', ['SMALL', 'BLIND'], ['#fff3a8', '#d49b22', '#7a3d07']));
write('blinds/big.svg', blindSVG('big', ['BIG', 'BLIND'], ['#ffbf7a', '#cf4d1f', '#601106']));
write('blinds/boss.svg', blindSVG('boss', ['BOSS', 'BLIND'], ['#ff6b6b', '#9d1628', '#2a0509']));

// ---------- Jokers ----------
function jokerSVG(id, name, hue) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 176" width="128" height="176">
  <defs>
    <linearGradient id="${id}-joker" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 84%, 64%)"/>
      <stop offset="0.55" stop-color="hsl(${hue}, 74%, 34%)"/>
      <stop offset="1" stop-color="hsl(${hue}, 70%, 17%)"/>
    </linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff1ac"/>
      <stop offset="1" stop-color="#a56a19"/>
    </linearGradient>
  </defs>
  <rect x="5" y="5" width="118" height="166" rx="13" fill="#12090a"/>
  <rect x="8" y="8" width="112" height="160" rx="11" fill="url(#${id}-joker)" stroke="url(#${id}-gold)" stroke-width="3"/>
  <rect x="16" y="16" width="96" height="144" rx="8" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="1.4"/>
  <circle cx="64" cy="72" r="36" fill="#fff8df" fill-opacity="0.22" stroke="#fff1ac" stroke-opacity="0.76" stroke-width="2"/>
  <path d="M34 72 C44 49 58 72 64 48 C70 72 84 49 94 72" fill="none" stroke="#fff1ac" stroke-width="7" stroke-linecap="round"/>
  <circle cx="34" cy="72" r="5" fill="#fff8df"/>
  <circle cx="64" cy="48" r="5" fill="#fff8df"/>
  <circle cx="94" cy="72" r="5" fill="#fff8df"/>
  <text x="64" y="97" font-size="38" text-anchor="middle" fill="#fff8df" font-family="Georgia, 'Times New Roman', serif" font-weight="900">J</text>
  <text x="64" y="137" font-size="11" text-anchor="middle" fill="#fff8df" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="900">${name}</text>
</svg>
`;
}
const JOKERS = [
  ['joker_01', 'JOKER', 10],
  ['joker_02', 'GREEDY', 110],
  ['joker_03', 'LUSTY', 340],
  ['joker_04', 'WRATHFUL', 0],
  ['joker_05', 'GLUTTON', 50],
];
for (const [id, name, hue] of JOKERS) {
  write(`jokers/${id}.svg`, jokerSVG(id, name, hue));
}

// ---------- Consumables ----------
function consumableSVG(id, label, hue, glyph) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 156" width="112" height="156">
  <defs>
    <linearGradient id="${label}-card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 65%, 58%)"/>
      <stop offset="1" stop-color="hsl(${hue}, 70%, 20%)"/>
    </linearGradient>
  </defs>
  <rect x="5" y="5" width="102" height="146" rx="12" fill="#12090a"/>
  <rect x="8" y="8" width="96" height="140" rx="10" fill="url(#${label}-card)" stroke="#efd287" stroke-width="2.5"/>
  <rect x="15" y="15" width="82" height="126" rx="7" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="1.2"/>
  <circle cx="56" cy="69" r="34" fill="#fff8dd" fill-opacity="0.16" stroke="#efd287" stroke-opacity="0.7" stroke-width="2"/>
  <text x="56" y="78" font-size="48" text-anchor="middle" fill="#fff8dd" font-family="Georgia, 'Times New Roman', serif" font-weight="900">${glyph}</text>
  <text x="56" y="121" font-size="10" text-anchor="middle" fill="#fff8dd" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="900">${label}</text>
</svg>
`;
}
write('consumables/tarot.svg', consumableSVG('consumables/tarot', 'TAROT', 280, '&#10022;'));
write('consumables/planet.svg', consumableSVG('consumables/planet', 'PLANET', 200, '&#9673;'));
write('consumables/spectral.svg', consumableSVG('consumables/spectral', 'SPECTRAL', 240, '&#10038;'));

// ---------- UI ----------
function buttonSVG(id, label, color) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 64" width="220" height="64">
  <defs>
    <linearGradient id="${id}-btn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color[0]}"/>
      <stop offset="0.52" stop-color="${color[1]}"/>
      <stop offset="1" stop-color="${color[2]}"/>
    </linearGradient>
  </defs>
  <rect x="4" y="5" width="212" height="55" rx="12" fill="#120805"/>
  <rect x="7" y="4" width="206" height="54" rx="10" fill="url(#${id}-btn)" stroke="#f2cc72" stroke-width="2.2"/>
  <path d="M18 16 C60 7 160 7 202 16" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="4" stroke-linecap="round"/>
  <rect x="13" y="11" width="194" height="40" rx="7" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.2"/>
  <text x="110" y="39" font-size="18" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="900" text-anchor="middle" fill="#fff8df" stroke="#2a1106" stroke-width="0.8" paint-order="stroke fill">${label}</text>
</svg>
`;
}
write('ui/btn_play.svg', buttonSVG('btn_play', 'PLAY HAND', ['#38d471', '#18853c', '#0b3d1f']));
write('ui/btn_discard.svg', buttonSVG('btn_discard', 'DISCARD', ['#ff756a', '#b91f2c', '#561018']));
write('ui/btn_new_run.svg', buttonSVG('btn_new_run', 'NEW RUN', ['#c49b64', '#6a4424', '#27160c']));
write('ui/btn_run_info.svg', buttonSVG('btn_run_info', 'RUN INFO', ['#65a9ff', '#265aa4', '#10214d']));
write('ui/btn_options.svg', buttonSVG('btn_options', 'OPTIONS', ['#ffbd65', '#c45a19', '#5b1d09']));

const bgSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="white-table" cx="0.5" cy="0.45" r="0.86">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.68" stop-color="#fbf8f0"/>
      <stop offset="1" stop-color="#eee3cd"/>
    </radialGradient>
    <pattern id="paper-grain" x="0" y="0" width="42" height="42" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="13" r="0.9" fill="#bfa56a" fill-opacity="0.08"/>
      <circle cx="31" cy="29" r="0.8" fill="#ffffff" fill-opacity="0.72"/>
      <path d="M0 41 H42 M41 0 V42" stroke="#d8c79e" stroke-opacity="0.08" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#white-table)"/>
  <rect width="100%" height="100%" fill="url(#paper-grain)"/>
  <ellipse cx="960" cy="540" rx="660" ry="340" fill="none" stroke="#d8c79e" stroke-opacity="0.16" stroke-width="6"/>
</svg>
`;
write('ui/background.svg', bgSVG);

const chipSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <radialGradient id="chip-blue" cx="0.35" cy="0.28" r="0.72">
      <stop offset="0" stop-color="#9de8ff"/>
      <stop offset="0.55" stop-color="#2474d7"/>
      <stop offset="1" stop-color="#0d225b"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="29" fill="#0d0908"/>
  <circle cx="32" cy="32" r="25" fill="url(#chip-blue)" stroke="#f8df93" stroke-width="2"/>
  <g fill="#fff8df">
    <rect x="29" y="5" width="6" height="11" rx="1"/>
    <rect x="29" y="48" width="6" height="11" rx="1"/>
    <rect x="48" y="29" width="11" height="6" rx="1"/>
    <rect x="5" y="29" width="11" height="6" rx="1"/>
  </g>
  <circle cx="32" cy="32" r="15" fill="none" stroke="#fff8df" stroke-dasharray="3 3" stroke-width="2"/>
  <text x="32" y="40" font-size="21" text-anchor="middle" fill="#fff8df" font-family="'Trebuchet MS', Arial, sans-serif" font-weight="900">$</text>
</svg>
`;
write('ui/chip.svg', chipSVG);

const coinSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <radialGradient id="coin-gold" cx="0.35" cy="0.25" r="0.72">
      <stop offset="0" stop-color="#fff6aa"/>
      <stop offset="0.58" stop-color="#d69a22"/>
      <stop offset="1" stop-color="#7a4209"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="29" fill="#130b04"/>
  <circle cx="32" cy="32" r="25" fill="url(#coin-gold)" stroke="#ffe998" stroke-width="2"/>
  <circle cx="32" cy="32" r="18" fill="none" stroke="#6f3a08" stroke-opacity="0.52" stroke-width="2"/>
  <path d="M18 19 C25 12 39 12 46 19" fill="none" stroke="#fff7c6" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>
  <text x="32" y="42" font-size="28" text-anchor="middle" fill="#5d2c05" font-family="Georgia, 'Times New Roman', serif" font-weight="900">$</text>
</svg>
`;
write('ui/coin.svg', coinSVG);

console.log('Generated casino-style SVG art under public/art/');
