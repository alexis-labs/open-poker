// AudioManager — singleton wrapping a single AudioContext, master gain, and
// a tiny voice registry. Each registered sound can be a synth function
// (runtime-generated) and/or a URL to an audio file (preferred when available).
// Designed so we can later drop in samples without touching call sites.

import * as Synth from './synth';
import type { SynthFn, SynthOpts } from './synth';
import { BackgroundMusic } from './musicEngine';

interface VoiceDef {
  synth?: SynthFn;
  url?: string;
  buffer?: AudioBuffer; // decoded sample, lazy
}

const MUTE_KEY       = 'open-poker:muted';
const VOL_KEY        = 'open-poker:volume';
const MUSIC_MUTE_KEY = 'open-poker:music-muted';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxLimiter: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private music: { start: () => void; stop: () => void } | null = null;
  private musicLoadPending = false;
  private voices = new Map<string, VoiceDef>();
  private unlocked = false;
  private muted = false;
  private volume = 0.7;
  private mutedListeners = new Set<(m: boolean) => void>();
  private musicMuted = false;
  private readonly musicVolume = 0.06;
  private musicMutedListeners = new Set<(m: boolean) => void>();

  constructor() {
    try {
      this.muted       = localStorage.getItem(MUTE_KEY) === '1';
      this.musicMuted  = localStorage.getItem(MUSIC_MUTE_KEY) === '1';
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
      this.sfxLimiter = this.ctx.createDynamicsCompressor();
      this.sfxLimiter.threshold.value = -13;
      this.sfxLimiter.knee.value = 8;
      this.sfxLimiter.ratio.value = 5;
      this.sfxLimiter.attack.value = 0.003;
      this.sfxLimiter.release.value = 0.16;
      this.master.connect(this.sfxLimiter);
      this.sfxLimiter.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicMuted ? 0 : this.musicVolume;
      this.musicGain.connect(this.ctx.destination);
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
    this.startMusicWhenReady(ctx);
  }

  private startMusicWhenReady(ctx: AudioContext) {
    if (this.musicMuted || this.music || this.musicLoadPending || !this.musicGain) return;
    this.musicLoadPending = true;
    if (this.music || !this.musicGain || this.ctx !== ctx) {
      this.musicLoadPending = false;
      return;
    }
    this.music = new BackgroundMusic(ctx, this.musicGain);
    this.music.start();
    this.musicLoadPending = false;
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

  setMusicMuted(m: boolean) {
    this.musicMuted = m;
    try { localStorage.setItem(MUSIC_MUTE_KEY, m ? '1' : '0'); } catch {}
    if (this.musicGain) this.musicGain.gain.value = m ? 0 : this.musicVolume;
    if (!m && this.unlocked && this.ctx) this.startMusicWhenReady(this.ctx);
    for (const fn of this.musicMutedListeners) fn(m);
  }

  toggleMusicMute() {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  isMusicMuted() { return this.musicMuted; }

  onMusicMutedChange(fn: (m: boolean) => void): () => void {
    this.musicMutedListeners.add(fn);
    return () => this.musicMutedListeners.delete(fn);
  }

  dispose() {
    this.music?.stop();
    this.music = null;
    try { void this.ctx?.close(); } catch {}
    this.ctx = null;
    this.master = null;
    this.sfxLimiter = null;
    this.musicGain = null;
    this.musicLoadPending = false;
    this.unlocked = false;
  }
}

export const audio = new AudioManagerImpl();
audio.registerDefaults();
audio.installUnlockListener();
