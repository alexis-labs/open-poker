// Pure synthesis helpers. Each voice schedules a short procedural sound and
// cleans itself up by stopping its sources. Keep the functions stateless so
// call sites can freely layer them during bursts of scoring feedback.

export interface SynthOpts {
  volume?: number; // 0..1 multiplier on top of master
  detune?: number; // cents
  pitch?: number;  // multiplier on base frequencies
  pan?: number;    // -1..1
}

const SILENCE = 0.0001;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function out(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}): AudioNode {
  const pan = clamp(opts.pan ?? 0, -1, 1);
  if (Math.abs(pan) < 0.001) return dest;

  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(dest);
  return panner;
}

function env(
  ctx: AudioContext,
  dest: AudioNode,
  attack: number,
  decay: number,
  peak: number,
  start = ctx.currentTime,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENCE, start);
  g.gain.exponentialRampToValueAtTime(Math.max(SILENCE, peak), start + attack);
  g.gain.exponentialRampToValueAtTime(SILENCE, start + attack + decay);
  g.connect(dest);
  return g;
}

function hitEnv(
  ctx: AudioContext,
  dest: AudioNode,
  attack: number,
  hold: number,
  release: number,
  peak: number,
  start = ctx.currentTime,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENCE, start);
  g.gain.exponentialRampToValueAtTime(Math.max(SILENCE, peak), start + attack);
  g.gain.setValueAtTime(Math.max(SILENCE, peak), start + attack + hold);
  g.gain.exponentialRampToValueAtTime(SILENCE, start + attack + hold + release);
  g.connect(dest);
  return g;
}

function osc(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  duration: number,
  detune = 0,
  start = ctx.currentTime,
) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  o.detune.setValueAtTime(detune, start);
  o.connect(dest);
  o.start(start);
  o.stop(start + duration + 0.05);
  return o;
}

function noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function noise(ctx: AudioContext, dest: AudioNode, duration: number, start = ctx.currentTime) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, duration);
  src.connect(dest);
  src.start(start);
  src.stop(start + duration + 0.05);
  return src;
}

function filter(
  ctx: AudioContext,
  dest: AudioNode,
  type: BiquadFilterType,
  freq: number,
  q = 1,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(dest);
  return f;
}

function bellPartial(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  volume: number,
  duration: number,
  start: number,
  detune = 0,
) {
  const g = env(ctx, dest, 0.002, duration, volume, start);
  const tone = osc(ctx, g, 'triangle', freq, duration, detune, start);
  tone.frequency.exponentialRampToValueAtTime(freq * 0.985, start + duration);
}

// ---------- voices ----------

export function click(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.07;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  const g = env(ctx, bus, 0.0015, 0.045, v, t);
  const hp = filter(ctx, g, 'highpass', 550 * pitch, 0.7);
  const lp = filter(ctx, hp, 'lowpass', 2100 * pitch, 0.45);
  noise(ctx, lp, 0.055, t);

  const body = env(ctx, bus, 0.002, 0.035, v * 0.28, t);
  osc(ctx, body, 'sine', 180 * pitch, 0.04, opts.detune ?? 0, t);
}

export function select(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.18;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  const body = hitEnv(ctx, bus, 0.008, 0.018, 0.16, v, t);
  const lp = filter(ctx, body, 'lowpass', 900 * pitch, 0.65);
  const tone = osc(ctx, lp, 'sine', 138 * pitch, 0.2, opts.detune ?? 0, t);
  tone.frequency.exponentialRampToValueAtTime(220 * pitch, t + 0.09);

  const felt = env(ctx, bus, 0.003, 0.11, v * 0.42, t + 0.006);
  const bp = filter(ctx, felt, 'bandpass', 760 * pitch, 0.9);
  noise(ctx, bp, 0.13, t + 0.006);
}

export function deselect(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.14;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  const body = hitEnv(ctx, bus, 0.007, 0.01, 0.15, v, t);
  const lp = filter(ctx, body, 'lowpass', 760 * pitch, 0.55);
  const tone = osc(ctx, lp, 'sine', 250 * pitch, 0.18, opts.detune ?? 0, t);
  tone.frequency.exponentialRampToValueAtTime(120 * pitch, t + 0.12);

  const felt = env(ctx, bus, 0.003, 0.08, v * 0.34, t + 0.01);
  const bp = filter(ctx, felt, 'bandpass', 560 * pitch, 0.8);
  noise(ctx, bp, 0.1, t + 0.01);
}

export function deal(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.32;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  const snap = env(ctx, bus, 0.001, 0.095, v, t);
  const paper = filter(ctx, snap, 'bandpass', 2600 * pitch, 1.15);
  paper.frequency.exponentialRampToValueAtTime(930 * pitch, t + 0.11);
  noise(ctx, paper, 0.12, t);

  const landing = env(ctx, bus, 0.002, 0.06, v * 0.16, t + 0.045);
  osc(ctx, landing, 'triangle', 92 * pitch, 0.075, opts.detune ?? 0, t + 0.045);
}

export function flip(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.28;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  const rush = env(ctx, bus, 0.004, 0.13, v, t);
  const bp = filter(ctx, rush, 'bandpass', 2900 * pitch, 1.8);
  bp.frequency.exponentialRampToValueAtTime(760 * pitch, t + 0.14);
  noise(ctx, bp, 0.15, t);

  const edge = env(ctx, bus, 0.001, 0.05, v * 0.34, t + 0.035);
  osc(ctx, edge, 'triangle', 820 * pitch, 0.06, (opts.detune ?? 0) + 7, t + 0.035);
}

export function whoosh(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.36;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  const g = hitEnv(ctx, bus, 0.012, 0.03, 0.29, v, t);
  const lp = filter(ctx, g, 'lowpass', 420 * pitch, 1.2);
  lp.frequency.exponentialRampToValueAtTime(2600 * pitch, t + 0.18);
  lp.frequency.exponentialRampToValueAtTime(420 * pitch, t + 0.34);
  noise(ctx, lp, 0.36, t);

  const pressure = env(ctx, bus, 0.015, 0.22, v * 0.18, t + 0.02);
  const tone = osc(ctx, pressure, 'sine', 86 * pitch, 0.26, opts.detune ?? 0, t + 0.02);
  tone.frequency.exponentialRampToValueAtTime(118 * pitch, t + 0.2);
}

export function sweep(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.32;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  const g = hitEnv(ctx, bus, 0.004, 0.015, 0.25, v, t);
  const hp = filter(ctx, g, 'highpass', 180 * pitch, 0.7);
  const lp = filter(ctx, hp, 'lowpass', 4200 * pitch, 0.9);
  lp.frequency.exponentialRampToValueAtTime(380 * pitch, t + 0.28);
  noise(ctx, lp, 0.31, t);

  const drop = env(ctx, bus, 0.006, 0.18, v * 0.2, t + 0.04);
  const tone = osc(ctx, drop, 'triangle', 160 * pitch, 0.22, opts.detune ?? 0, t + 0.04);
  tone.frequency.exponentialRampToValueAtTime(78 * pitch, t + 0.22);
}

export function chipTick(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.16;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  bellPartial(ctx, bus, 930 * pitch, v, 0.055, t, (opts.detune ?? 0) - 5);
  bellPartial(ctx, bus, 1570 * pitch, v * 0.42, 0.04, t + 0.002, (opts.detune ?? 0) + 8);

  const edge = env(ctx, bus, 0.001, 0.025, v * 0.42, t);
  const hp = filter(ctx, edge, 'highpass', 1700 * pitch, 0.5);
  noise(ctx, hp, 0.032, t);
}

export function multTick(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.17;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  bellPartial(ctx, bus, 720 * pitch, v * 0.65, 0.07, t, opts.detune ?? 0);
  bellPartial(ctx, bus, 1440 * pitch, v * 0.54, 0.06, t + 0.004, (opts.detune ?? 0) + 11);
  bellPartial(ctx, bus, 2160 * pitch, v * 0.28, 0.05, t + 0.008, (opts.detune ?? 0) - 9);
}

export function scorePop(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.34;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  [330, 440, 660].forEach((freq, i) => {
    const ts = t + i * 0.045;
    const g = env(ctx, bus, 0.004, 0.22 - i * 0.035, v * (1 - i * 0.16), ts);
    const tone = osc(ctx, g, i === 0 ? 'triangle' : 'sine', freq * pitch, 0.24, opts.detune ?? 0, ts);
    tone.frequency.exponentialRampToValueAtTime(freq * 1.08 * pitch, ts + 0.14);
  });

  const shine = env(ctx, bus, 0.003, 0.16, v * 0.34, t + 0.035);
  const hp = filter(ctx, shine, 'highpass', 2400 * pitch, 0.45);
  noise(ctx, hp, 0.18, t + 0.035);
}

export function chaching(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.42;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  [0, 0.09].forEach((offset, i) => {
    const ts = t + offset;
    const base = (i === 0 ? 1040 : 1320) * pitch;
    bellPartial(ctx, bus, base, v * 0.8, 0.32, ts, (opts.detune ?? 0) + i * 6);
    bellPartial(ctx, bus, base * 1.52, v * 0.38, 0.24, ts + 0.006, (opts.detune ?? 0) - i * 8);

    const scratch = env(ctx, bus, 0.001, 0.055, v * 0.34, ts);
    const hp = filter(ctx, scratch, 'highpass', 2600 * pitch, 0.7);
    noise(ctx, hp, 0.07, ts);
  });

  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const ts = t + 0.16 + i * 0.055;
    bellPartial(ctx, bus, freq * pitch, v * 0.42, 0.28, ts, opts.detune ?? 0);
  });
}

export function win(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.48;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];

  notes.forEach((freq, i) => {
    const ts = t + i * 0.095;
    const dur = i === notes.length - 1 ? 0.65 : 0.42;
    const g = hitEnv(ctx, bus, 0.01, 0.04, dur, v * (i === notes.length - 1 ? 0.9 : 0.62), ts);
    const lp = filter(ctx, g, 'lowpass', 3600 * pitch, 0.8);
    osc(ctx, lp, 'triangle', freq * pitch, dur + 0.04, opts.detune ?? 0, ts);

    const sparkle = env(ctx, bus, 0.002, 0.2, v * 0.18, ts + 0.012);
    osc(ctx, sparkle, 'sine', freq * 2.01 * pitch, 0.22, (opts.detune ?? 0) + 4, ts + 0.012);
  });

  const shimmer = env(ctx, bus, 0.02, 0.6, v * 0.18, t + 0.32);
  const hp = filter(ctx, shimmer, 'highpass', 3200 * pitch, 0.4);
  noise(ctx, hp, 0.7, t + 0.32);
}

export function lose(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.34;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;
  const lp = filter(ctx, bus, 'lowpass', 850 * pitch, 0.45);
  const notes = [196, 174.61, 155.56, 130.81];

  notes.forEach((freq, i) => {
    const ts = t + i * 0.22;
    const dur = i === notes.length - 1 ? 1.0 : 0.62;
    const g = hitEnv(ctx, lp, 0.045, 0.02, dur, v * (1 - i * 0.08), ts);
    const tone = osc(ctx, g, 'triangle', freq * pitch, dur + 0.04, (opts.detune ?? 0) - 5, ts);
    tone.frequency.exponentialRampToValueAtTime(freq * 0.96 * pitch, ts + dur);

    const sub = env(ctx, g, 0.05, dur * 0.82, v * 0.24, ts + 0.01);
    osc(ctx, sub, 'sine', (freq / 2) * pitch, dur, opts.detune ?? 0, ts + 0.01);
  });

  const cloth = env(ctx, bus, 0.03, 0.55, v * 0.18, t + 0.12);
  const lowNoise = filter(ctx, cloth, 'lowpass', 260 * pitch, 0.8);
  noise(ctx, lowNoise, 0.65, t + 0.12);
}

export function buttonClick(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.24;
  const pitch = opts.pitch ?? 1;
  const bus = out(ctx, dest, opts);
  const t = ctx.currentTime;

  const knock = env(ctx, bus, 0.0015, 0.055, v, t);
  const tone = osc(ctx, knock, 'triangle', 360 * pitch, 0.07, opts.detune ?? 0, t);
  tone.frequency.exponentialRampToValueAtTime(170 * pitch, t + 0.055);

  const tick = env(ctx, bus, 0.001, 0.025, v * 0.5, t + 0.002);
  const hp = filter(ctx, tick, 'highpass', 1600 * pitch, 0.6);
  noise(ctx, hp, 0.032, t + 0.002);
}

export type SynthFn = (ctx: AudioContext, dest: AudioNode, opts?: SynthOpts) => void;
