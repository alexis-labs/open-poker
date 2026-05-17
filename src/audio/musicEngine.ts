// musicEngine.ts — Background music player for open-poker
// Loads the MP3 track and loops it through the provided Web Audio destination
// node (musicGain), keeping it fully separate from SFX.

const MUSIC_SRC = new URL('./Veludo No Copo.mp3', import.meta.url).href;

export class BackgroundMusic {
  private ctx: AudioContext;
  private dest: AudioNode;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private pendingStart = false;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch(MUSIC_SRC);
      const ab  = await res.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(ab);
      if (this.pendingStart) {
        this.pendingStart = false;
        this.playBuffer();
      }
    } catch (err) {
      console.warn('[BackgroundMusic] Failed to load music file:', err);
    }
  }

  start() {
    if (this.buffer) {
      this.playBuffer();
    } else {
      this.pendingStart = true;
    }
  }

  stop() {
    this.pendingStart = false;
    if (this.source) {
      try { this.source.stop(); } catch { /* already stopped */ }
      this.source = null;
    }
  }

  private playBuffer() {
    this.stop(); // stop any existing source first
    if (!this.buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.dest);
    src.start();
    this.source = src;
  }
}
