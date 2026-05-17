// AudioManager — singleton wrapping a single AudioContext, master gain, and
// a tiny voice registry. Each registered sound can be a synth function
// (runtime-generated) and/or a URL to an audio file (preferred when available).
// Designed so we can later drop in samples without touching call sites.

import * as Synth from './synth';
import type { SynthFn, SynthOpts } from './synth';

interface VoiceDef {
  synth?: SynthFn;
  url?: string;
  buffer?: AudioBuffer; // decoded sample, lazy
}

const MUTE_KEY = 'open-poker:muted';
const VOL_KEY  = 'open-poker:volume';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<string, VoiceDef>();
  private unlocked = false;
  private muted = false;
  private volume = 0.7;
  private mutedListeners = new Set<(m: boolean) => void>();

  constructor() {
    try {
      this.muted  = localStorage.getItem(MUTE_KEY) === '1';
      const v = localStorage.getItem(VOL_KEY);
      if (v) this.volume = Math.max(0, Math.min(1, parseFloat(v)));
    } catch { /* private mode */ }
  }

  /** Register all built-in synth voices. Call once at startup. */
  registerDefaults() {
    const r = (name: string, synth: SynthFn) => this.register(name, { synth });
    r('click', Synth.click);
    r('select', Synth.select);
    r('deselect', Synth.deselect);
    r('deal', Synth.deal);
    r('flip', Synth.flip);
    r('whoosh', Synth.whoosh);
    r('sweep', Synth.sweep);
    r('chipTick', Synth.chipTick);
    r('multTick', Synth.multTick);
    r('scorePop', Synth.scorePop);
    r('chaching', Synth.chaching);
    r('win', Synth.win);
    r('lose', Synth.lose);
    r('buttonClick', Synth.buttonClick);
  }

  register(name: string, def: VoiceDef) {
    this.voices.set(name, def);
  }

  /** Attach a one-shot listener that unlocks the AudioContext on first gesture. */
  installUnlockListener() {
    const handler = () => {
      this.unlock();
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: false });
    window.addEventListener('keydown', handler, { once: false });
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      return null;
    }
    return this.ctx;
  }

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    this.unlocked = true;
  }

  play(name: string, opts: SynthOpts = {}) {
    if (this.muted) return;
    if (!this.unlocked) return; // pre-gesture; silently no-op
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const def = this.voices.get(name);
    if (!def) return;

    if (def.buffer) {
      this.playBuffer(ctx, def.buffer, opts);
      return;
    }
    if (def.url && !def.buffer) {
      // Lazy decode; fall back to synth meanwhile.
      this.loadBuffer(ctx, def);
    }
    if (def.synth) {
      def.synth(ctx, this.master, opts);
    }
  }

  private playBuffer(ctx: AudioContext, buf: AudioBuffer, opts: SynthOpts) {
    if (!this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (opts.detune) src.detune.value = opts.detune;
    if (opts.pitch) src.playbackRate.value = opts.pitch;
    const g = ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    src.connect(g).connect(this.master);
    src.start();
  }

  private loadBuffer(ctx: AudioContext, def: VoiceDef) {
    if (!def.url || def.buffer) return;
    fetch(def.url)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((b) => { def.buffer = b; })
      .catch(() => { /* keep synth fallback */ });
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch {}
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
    for (const fn of this.mutedListeners) fn(m);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted() { return this.muted; }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(VOL_KEY, String(this.volume)); } catch {}
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  onMutedChange(fn: (m: boolean) => void): () => void {
    this.mutedListeners.add(fn);
    return () => this.mutedListeners.delete(fn);
  }
}

export const audio = new AudioManagerImpl();
audio.registerDefaults();
audio.installUnlockListener();
