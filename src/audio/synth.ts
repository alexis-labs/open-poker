// Pure synthesis helpers — each takes an AudioContext + destination node and
// schedules a short voice. No state, no globals. Designed to be cheap enough
// to call dozens of times per second without leaking nodes (everything stops
// itself and is GC'd).

export interface SynthOpts {
  volume?: number; // 0..1 multiplier on top of master
  detune?: number; // cents
  pitch?: number;  // multiplier on base frequencies
}

function env(
  ctx: AudioContext,
  dest: AudioNode,
  attack: number,
  decay: number,
  peak: number,
): GainNode {
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
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
) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  o.detune.setValueAtTime(detune, ctx.currentTime);
  o.connect(dest);
  o.start();
  o.stop(ctx.currentTime + duration + 0.05);
  return o;
}

function noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function noise(ctx: AudioContext, dest: AudioNode, duration: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, duration);
  src.connect(dest);
  src.start();
  src.stop(ctx.currentTime + duration + 0.05);
  return src;
}

// ---------- voices ----------

export function click(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  // Soft "tap" — short filtered-noise puff, no tonal beep.
  const v = opts.volume ?? 0.08;
  const dur = 0.06;
  const g = env(ctx, dest, 0.004, dur, v);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900 * (opts.pitch ?? 1), ctx.currentTime);
  lp.Q.value = 0.6;
  lp.connect(g);
  noise(ctx, lp, dur);
}

export function select(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  // Warm, muted "thup" — low sine with a gentle upward bend + a noise body.
  const v = opts.volume ?? 0.18;
  const dur = 0.18;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200 * (opts.pitch ?? 1);
  lp.Q.value = 0.4;
  lp.connect(g);
  g.connect(dest);
  // tonal body
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(180 * (opts.pitch ?? 1), t);
  o.frequency.exponentialRampToValueAtTime(260 * (opts.pitch ?? 1), t + 0.08);
  o.detune.value = opts.detune ?? 0;
  o.connect(lp);
  o.start(t);
  o.stop(t + dur + 0.05);
  // noise body for paper-on-felt feel
  const ng = ctx.createGain();
  ng.gain.value = 0.35;
  ng.connect(lp);
  noise(ctx, ng, dur * 0.6);
}

export function deselect(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  // Mirror of select: downward bend, slightly quieter.
  const v = opts.volume ?? 0.14;
  const dur = 0.18;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900 * (opts.pitch ?? 1);
  lp.Q.value = 0.4;
  lp.connect(g);
  g.connect(dest);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(240 * (opts.pitch ?? 1), t);
  o.frequency.exponentialRampToValueAtTime(150 * (opts.pitch ?? 1), t + 0.1);
  o.detune.value = opts.detune ?? 0;
  o.connect(lp);
  o.start(t);
  o.stop(t + dur + 0.05);
  const ng = ctx.createGain();
  ng.gain.value = 0.28;
  ng.connect(lp);
  noise(ctx, ng, dur * 0.6);
}

export function deal(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.35;
  const dur = 0.13;
  const g = env(ctx, dest, 0.003, dur, v);
  const lp = ctx.createBiquadFilter();
  lp.type = 'bandpass';
  lp.frequency.value = 1600 * (opts.pitch ?? 1);
  lp.Q.value = 1.2;
  lp.connect(g);
  noise(ctx, lp, dur);
}

export function flip(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.3;
  const dur = 0.16;
  const g = env(ctx, dest, 0.004, dur, v);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2400 * (opts.pitch ?? 1), ctx.currentTime);
  bp.frequency.exponentialRampToValueAtTime(700 * (opts.pitch ?? 1), ctx.currentTime + dur);
  bp.Q.value = 2;
  bp.connect(g);
  noise(ctx, bp, dur);
}

export function whoosh(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.4;
  const dur = 0.32;
  const g = env(ctx, dest, 0.01, dur, v);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400 * (opts.pitch ?? 1), ctx.currentTime);
  lp.frequency.exponentialRampToValueAtTime(2200 * (opts.pitch ?? 1), ctx.currentTime + dur * 0.6);
  lp.frequency.exponentialRampToValueAtTime(300 * (opts.pitch ?? 1), ctx.currentTime + dur);
  lp.Q.value = 1.5;
  lp.connect(g);
  noise(ctx, lp, dur);
}

export function sweep(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.35;
  const dur = 0.3;
  const g = env(ctx, dest, 0.005, dur, v);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3000, ctx.currentTime);
  lp.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + dur);
  lp.connect(g);
  noise(ctx, lp, dur);
}

export function chipTick(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.18;
  const g = env(ctx, dest, 0.001, 0.04, v);
  osc(ctx, g, 'sine', 1200 * (opts.pitch ?? 1), 0.05, opts.detune ?? 0);
}

export function multTick(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.18;
  const g = env(ctx, dest, 0.001, 0.04, v);
  osc(ctx, g, 'sine', 1700 * (opts.pitch ?? 1), 0.05, opts.detune ?? 0);
}

export function scorePop(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.4;
  const dur = 0.25;
  const g = env(ctx, dest, 0.005, dur, v);
  const o = osc(ctx, g, 'sine', 440 * (opts.pitch ?? 1), dur);
  o.frequency.exponentialRampToValueAtTime(1100 * (opts.pitch ?? 1), ctx.currentTime + 0.18);
  // sparkle harmonic
  const g2 = env(ctx, dest, 0.005, dur * 0.6, v * 0.4);
  osc(ctx, g2, 'triangle', 1320 * (opts.pitch ?? 1), dur * 0.6);
}

export function chaching(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.45;
  const t0 = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 maj arpeggio
  notes.forEach((freq, i) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + i * 0.07);
    g.gain.exponentialRampToValueAtTime(v, t0 + i * 0.07 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.07 + 0.35);
    g.connect(dest);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq * (opts.pitch ?? 1);
    o.connect(g);
    o.start(t0 + i * 0.07);
    o.stop(t0 + i * 0.07 + 0.4);
  });
}

export function win(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.5;
  const t0 = ctx.currentTime;
  const notes = [392, 523.25, 659.25, 783.99, 1046.5]; // G4 C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const g = ctx.createGain();
    const ts = t0 + i * 0.1;
    g.gain.setValueAtTime(0.0001, ts);
    g.gain.exponentialRampToValueAtTime(v, ts + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.5);
    g.connect(dest);
    const o = ctx.createOscillator();
    o.type = i === notes.length - 1 ? 'triangle' : 'square';
    o.frequency.value = freq * (opts.pitch ?? 1);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2 * (opts.pitch ?? 1);
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    o2.connect(g2).connect(g);
    o.connect(g);
    o.start(ts); o2.start(ts);
    o.stop(ts + 0.55); o2.stop(ts + 0.55);
  });
}

export function lose(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.4;
  const t0 = ctx.currentTime;
  const notes = [392, 349.23, 311.13, 261.63]; // G4 F4 Eb4 C4 — sad descent
  notes.forEach((freq, i) => {
    const g = ctx.createGain();
    const ts = t0 + i * 0.16;
    g.gain.setValueAtTime(0.0001, ts);
    g.gain.exponentialRampToValueAtTime(v, ts + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.5);
    g.connect(dest);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = (i % 2 === 0 ? -8 : 8); // slight detune for sad feel
    o.connect(g);
    o.start(ts);
    o.stop(ts + 0.55);
  });
}

export function buttonClick(ctx: AudioContext, dest: AudioNode, opts: SynthOpts = {}) {
  const v = opts.volume ?? 0.28;
  const g = env(ctx, dest, 0.002, 0.06, v);
  const o = osc(ctx, g, 'square', 520 * (opts.pitch ?? 1), 0.08);
  o.frequency.exponentialRampToValueAtTime(280 * (opts.pitch ?? 1), ctx.currentTime + 0.06);
}

export type SynthFn = (ctx: AudioContext, dest: AudioNode, opts?: SynthOpts) => void;
