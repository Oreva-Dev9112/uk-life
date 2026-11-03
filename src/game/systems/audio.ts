// Procedural ambience with WebAudio: rain, distant city hum, car horns, UI blips.
class Ambience {
  private ctx?: AudioContext;
  private master?: GainNode;
  private rain?: GainNode;
  private drops?: GainNode;
  private hum?: GainNode;
  private volume = 0.7;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 3;
    const white = ctx.createBuffer(1, len, ctx.sampleRate);
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = white.getChannelData(0), b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;
      b[i] = last * 3.5;
    }
    const loop = (buf: AudioBuffer) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };

    // fine rain hiss
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6500;
    this.rain = ctx.createGain(); this.rain.gain.value = 0;
    loop(white).connect(hp).connect(lp).connect(this.rain).connect(this.master);
    // heavier patter
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 0.6;
    this.drops = ctx.createGain(); this.drops.gain.value = 0;
    loop(white).connect(bp).connect(this.drops).connect(this.master);
    // city hum
    const hl = ctx.createBiquadFilter(); hl.type = "lowpass"; hl.frequency.value = 180;
    this.hum = ctx.createGain(); this.hum.gain.value = 0.22;
    loop(brown).connect(hl).connect(this.hum).connect(this.master);
  }

  setRain(intensity: number) {
    if (!this.ctx || !this.rain || !this.drops) return;
    const t = this.ctx.currentTime;
    this.rain.gain.setTargetAtTime(intensity * 0.16, t, 0.5);
    this.drops.gain.setTargetAtTime(intensity * intensity * 0.08, t, 0.5);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  honk(distance: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const g = ctx.createGain();
    const vol = Math.max(0.02, 0.22 / (1 + distance * 0.15));
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + 0.35);
    g.gain.linearRampToValueAtTime(0, t + 0.45);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1800;
    g.connect(f).connect(this.master);
    for (const hz of [392, 494]) {
      const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = hz;
      o.connect(g); o.start(t); o.stop(t + 0.5);
    }
  }

  blip(up = true) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(up ? 660 : 440, t);
    o.frequency.exponentialRampToValueAtTime(up ? 990 : 330, t + 0.08);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.13);
  }
}

export const audio = new Ambience();
