// Procedural card-face textures using a 2D canvas → CanvasTexture.
// Cheap, dependency-free, and easy to swap for spritesheets later.
//
// Art override: if a PNG exists at `/art/cards/{RANK}_{suit}.png` (or
// `/art/back/default.png` for the back), it is loaded asynchronously and
// painted over the procedural canvas — no rebuild required.

import * as THREE from 'three';
import type { PlayingCard, Suit } from '../game/types';
import { RANK_LABEL, SUIT_GLYPH } from '../game/cards';

const SUIT_COLOR: Record<Suit, string> = {
  hearts: '#e23b3b',
  diamonds: '#e23b3b',
  spades: '#1a1a1a',
  clubs: '#1a1a1a',
};

const W = 256;
const H = 360;

// Cache so identical cards share GPU memory.
const cache = new Map<string, THREE.CanvasTexture>();
// Remember which art URLs we've already probed so we don't refire requests.
const tried = new Set<string>();
let backTex: THREE.CanvasTexture | null = null;

function keyFor(c: PlayingCard): string {
  return `${c.rank}-${c.suit}-${c.enhancement}-${c.edition}-${c.seal}`;
}

/**
 * Try to load `url` and paint it onto the given canvas. On success the
 * provided texture is marked `needsUpdate` so live materials pick up the swap.
 * Fails silently (404 / network / decode) — procedural art stays.
 */
function tryOverlayImage(url: string, canvas: HTMLCanvasElement, tex: THREE.CanvasTexture) {
  if (tried.has(url)) return;
  tried.add(url);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    rounded(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 22);
    ctx.clip();
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    tex.needsUpdate = true;
  };
  img.onerror = () => { /* leave procedural art in place */ };
  img.src = url;
}

/** Try each extension in order; the first one that loads wins. */
function tryOverlayWithExts(base: string, canvas: HTMLCanvasElement, tex: THREE.CanvasTexture) {
  const exts = ['svg', 'png', 'webp', 'jpg'];
  for (const ext of exts) tryOverlayImage(`${base}.${ext}`, canvas, tex);
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function getCardTexture(card: PlayingCard): THREE.CanvasTexture {
  const key = keyFor(card);
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background — enhancement tint
  let bg = '#fdfdfd';
  if (card.enhancement === 'steel')  bg = '#b8c0c8';
  if (card.enhancement === 'gold')   bg = '#f5d36b';
  if (card.enhancement === 'stone')  bg = '#8b8b8b';
  if (card.enhancement === 'glass')  bg = '#e8f4ff';

  ctx.fillStyle = bg;
  rounded(ctx, 6, 6, W - 12, H - 12, 22);
  ctx.fill();

  // Border
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#222';
  rounded(ctx, 6, 6, W - 12, H - 12, 22);
  ctx.stroke();

  if (card.enhancement === 'stone') {
    // No rank/suit for stone cards
    ctx.fillStyle = '#555';
    ctx.font = 'bold 56px serif';
    ctx.textAlign = 'center';
    ctx.fillText('STONE', W / 2, H / 2 + 18);
  } else {
    const color = SUIT_COLOR[card.suit];
    const rankStr = RANK_LABEL[card.rank];
    const suitGlyph = SUIT_GLYPH[card.suit];

    // Top-left
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.font = 'bold 56px "Trebuchet MS", sans-serif';
    ctx.fillText(rankStr, 22, 70);
    ctx.font = 'bold 48px serif';
    ctx.fillText(suitGlyph, 22, 118);

    // Bottom-right (mirrored)
    ctx.save();
    ctx.translate(W - 22, H - 30);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'left';
    ctx.font = 'bold 56px "Trebuchet MS", sans-serif';
    ctx.fillText(rankStr, 0, 0);
    ctx.font = 'bold 48px serif';
    ctx.fillText(suitGlyph, 0, 48);
    ctx.restore();

    // Big centre suit
    ctx.textAlign = 'center';
    ctx.font = 'bold 160px serif';
    ctx.fillText(suitGlyph, W / 2, H / 2 + 56);
  }

  // Seal dot (bottom-centre)
  if (card.seal !== 'none') {
    const sealColor =
      card.seal === 'gold' ? '#ffd24a' :
      card.seal === 'red' ? '#ff5a5a' :
      card.seal === 'blue' ? '#54a8ff' : '#c084ff';
    ctx.fillStyle = sealColor;
    ctx.beginPath();
    ctx.arc(W / 2, H - 50, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);

  // Try to override with `/art/cards/{RANK}_{suit}.{svg|png|...}` (unenhanced
  // cards only — enhancements still come from the procedural layer).
  if (card.enhancement === 'none') {
    const rankPart = RANK_LABEL[card.rank];
    tryOverlayWithExts(`/art/cards/${rankPart}_${card.suit}`, canvas, tex);
  }

  return tex;
}

export function getBackTexture(): THREE.CanvasTexture {
  if (backTex) return backTex;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Deep red back
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#7a1622');
  grad.addColorStop(1, '#3a0a12');
  ctx.fillStyle = grad;
  rounded(ctx, 6, 6, W - 12, H - 12, 22);
  ctx.fill();

  ctx.strokeStyle = '#f0c060';
  ctx.lineWidth = 3;
  rounded(ctx, 18, 18, W - 36, H - 36, 16);
  ctx.stroke();

  // Cross-hatch pattern
  ctx.strokeStyle = 'rgba(240,192,96,0.25)';
  ctx.lineWidth = 1;
  for (let i = -H; i < W; i += 14) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i + H, 0); ctx.stroke();
  }

  // Centre emblem
  ctx.fillStyle = '#f0c060';
  ctx.textAlign = 'center';
  ctx.font = 'bold 96px serif';
  ctx.fillText('♠', W / 2, H / 2 + 36);

  backTex = new THREE.CanvasTexture(canvas);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.anisotropy = 4;

  // Optional override at /art/back/default.{svg|png|...}
  tryOverlayWithExts('/art/back/default', canvas, backTex);

  return backTex;
}
