// Procedural card-face textures using a 2D canvas → CanvasTexture.
// Cheap, dependency-free, and easy to swap for spritesheets later.
//
// Art override: if a file exists at `/art/cards/{RANK}_{suit}.{svg|png|webp|jpg}`
// (or `/art/back/default.*` for the back), it is loaded asynchronously and
// painted over the procedural canvas — no rebuild required.
// Enhancements/editions are rendered as a colour overlay ON TOP of the base art.

import * as THREE from 'three';
import type { PlayingCard, Enhancement, Edition, Suit } from '../game/types';
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
let backTex: THREE.CanvasTexture | null = null;

function keyFor(c: PlayingCard): string {
  return `${c.rank}-${c.suit}-${c.enhancement}-${c.edition}-${c.seal}`;
}

// ---------------------------------------------------------------------------
// Image loading — one request per URL, multiple canvases may subscribe.
// ---------------------------------------------------------------------------
const _imgCache = new Map<string, HTMLImageElement>();
const _imgCallbacks = new Map<string, Array<(img: HTMLImageElement) => void>>();

function loadImageOnce(url: string, onLoad: (img: HTMLImageElement) => void): void {
  const hit = _imgCache.get(url);
  if (hit) { onLoad(hit); return; }

  const pending = _imgCallbacks.get(url);
  if (pending) { pending.push(onLoad); return; }

  _imgCallbacks.set(url, [onLoad]);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    _imgCache.set(url, img);
    _imgCallbacks.get(url)?.forEach(cb => cb(img));
    _imgCallbacks.delete(url);
  };
  img.onerror = () => { _imgCallbacks.delete(url); /* leave procedural art */ };
  img.src = url;
}

// ---------------------------------------------------------------------------
// Enhancement / edition overlay colours
// ---------------------------------------------------------------------------
const ENHANCEMENT_OVERLAY: Partial<Record<Enhancement, string>> = {
  bonus:  'rgba( 60, 120, 255, 0.28)',
  mult:   'rgba(220,  55,  55, 0.28)',
  wild:   'rgba(160,  70, 255, 0.28)',
  glass:  'rgba(100, 210, 255, 0.28)',
  steel:  'rgba(180, 192, 208, 0.38)',
  stone:  'rgba(120, 120, 120, 0.50)',
  gold:   'rgba(245, 195,  40, 0.38)',
  lucky:  'rgba( 60, 200,  80, 0.28)',
};

const EDITION_OVERLAY: Partial<Record<Edition, string>> = {
  foil:         'rgba(180, 220, 255, 0.30)',
  holographic:  'rgba(200, 100, 255, 0.28)',
  polychrome:   'rgba(255, 180,  60, 0.25)',
  negative:     'rgba( 20,  20,  20, 0.55)',
};

function paintOverlayOnCanvas(
  ctx: CanvasRenderingContext2D,
  color: string,
  w: number,
  h: number,
) {
  ctx.save();
  rounded(ctx, 6, 6, w - 12, h - 12, 22);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Core paint helpers
// ---------------------------------------------------------------------------

/**
 * Paint `img` onto `canvas`, apply the enhancement/edition overlay, re-stroke
 * the border, then mark the texture dirty.
 */
function paintCardArt(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  tex: THREE.CanvasTexture,
  enhancement: Enhancement,
  edition: Edition,
  seal: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the base art clipped to the card shape.
  ctx.save();
  rounded(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 22);
  ctx.clip();
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Enhancement colour overlay.
  const enhColor = ENHANCEMENT_OVERLAY[enhancement];
  if (enhColor) paintOverlayOnCanvas(ctx, enhColor, canvas.width, canvas.height);

  // Edition colour overlay.
  const edColor = EDITION_OVERLAY[edition];
  if (edColor) paintOverlayOnCanvas(ctx, edColor, canvas.width, canvas.height);

  // Subtle dark border so art reads cleanly against the felt.
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  rounded(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 22);
  ctx.stroke();
  // Inner highlight stroke.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  rounded(ctx, 9, 9, canvas.width - 18, canvas.height - 18, 19);
  ctx.stroke();

  // Seal dot on top of everything.
  if (seal !== 'none') {
    const sealColor =
      seal === 'gold' ? '#ffd24a' :
      seal === 'red'  ? '#ff5a5a' :
      seal === 'blue' ? '#54a8ff' : '#c084ff';
    ctx.fillStyle = sealColor;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height - 50, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
  }

  tex.needsUpdate = true;
}

/**
 * Try to load the base art from `base.{svg|png|webp|jpg}` and apply it.
 * The first extension that resolves wins; others are ignored by the browser cache.
 */
function tryOverlayWithExts(
  base: string,
  canvas: HTMLCanvasElement,
  tex: THREE.CanvasTexture,
  enhancement: Enhancement,
  edition: Edition,
  seal: string,
): void {
  for (const ext of ['svg', 'png', 'webp', 'jpg']) {
    loadImageOnce(`${base}.${ext}`, (img) => paintCardArt(img, canvas, tex, enhancement, edition, seal));
  }
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

  // ── Procedural fallback (shown until the async art loads) ───────────────
  ctx.fillStyle = '#fdfdfd';
  rounded(ctx, 6, 6, W - 12, H - 12, 22);
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#222';
  rounded(ctx, 6, 6, W - 12, H - 12, 22);
  ctx.stroke();

  if (card.enhancement === 'stone') {
    ctx.fillStyle = '#555';
    ctx.font = 'bold 56px serif';
    ctx.textAlign = 'center';
    ctx.fillText('STONE', W / 2, H / 2 + 18);
  } else {
    const color = SUIT_COLOR[card.suit];
    const rankStr = RANK_LABEL[card.rank];
    const suitGlyph = SUIT_GLYPH[card.suit];

    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.font = 'bold 56px "Trebuchet MS", sans-serif';
    ctx.fillText(rankStr, 22, 70);
    ctx.font = 'bold 48px serif';
    ctx.fillText(suitGlyph, 22, 118);

    ctx.save();
    ctx.translate(W - 22, H - 30);
    ctx.rotate(Math.PI);
    ctx.textAlign = 'left';
    ctx.font = 'bold 56px "Trebuchet MS", sans-serif';
    ctx.fillText(rankStr, 0, 0);
    ctx.font = 'bold 48px serif';
    ctx.fillText(suitGlyph, 0, 48);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = 'bold 160px serif';
    ctx.fillText(suitGlyph, W / 2, H / 2 + 56);
  }

  // Seal dot (bottom-centre) — drawn both in the fallback and after art loads.
  const paintSeal = (c: CanvasRenderingContext2D) => {
    if (card.seal === 'none') return;
    const sealColor =
      card.seal === 'gold' ? '#ffd24a' :
      card.seal === 'red'  ? '#ff5a5a' :
      card.seal === 'blue' ? '#54a8ff' : '#c084ff';
    c.fillStyle = sealColor;
    c.beginPath();
    c.arc(W / 2, H - 50, 22, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.stroke();
  };
  paintSeal(ctx);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);

  // ── Async art overlay — works for ALL enhancements / editions ───────────
  // Stone cards have no suit so we keep the procedural fallback for them.
  if (card.enhancement !== 'stone') {
    const rankPart = RANK_LABEL[card.rank];
    const base = `/art/cards/${rankPart}_${card.suit}`;
    tryOverlayWithExts(base, canvas, tex, card.enhancement, card.edition, card.seal);
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
  tryOverlayWithExts('/art/back/default', canvas, backTex, 'none', 'base', 'none');

  return backTex;
}
