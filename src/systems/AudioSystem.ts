/**
 * Procedural Web Audio: every SFX and music track is synthesized at runtime, so the game ships with zero
 * audio files. Swap in OGG/MP3 later via ASSET_MANIFEST.md without touching gameplay code.
 */
export type Sfx =
  | 'punch'
  | 'kick'
  | 'heavy'
  | 'whoosh'
  | 'hurt'
  | 'enemyHurt'
  | 'down'
  | 'jump'
  | 'land'
  | 'dodge'
  | 'skill'
  | 'ultimate'
  | 'pickup'
  | 'coin'
  | 'warning'
  | 'explosion'
  | 'roar'
  | 'spit'
  | 'train'
  | 'freeze'
  | 'ui'
  | 'confirm'
  | 'victory'
  | 'defeat'
  | 'guard'
  | 'break';

interface Track {
  bpm: number;
  root: number; // midi
  scale: number[];
  bass: number[]; // scale degrees, -1 = rest
  lead: number[];
  drums: string; // per 16th: k = kick, s = snare, h = hat, . = rest
  wave: OscillatorType;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];

const TRACKS: Track[] = [
  { bpm: 132, root: 45, scale: MINOR, bass: [0, 0, 7, 0, 5, 5, 3, 4], lead: [7, -1, 9, 7, 4, -1, 2, 4, 7, -1, 9, 11, 9, 7, 4, 2], drums: 'k.h.s.h.k.hks.h.', wave: 'square' },
  { bpm: 124, root: 48, scale: DORIAN, bass: [0, 3, 4, 3, 0, 5, 4, 2], lead: [4, 5, 7, -1, 7, 9, 7, 5, 4, -1, 2, 4, 5, 4, 2, 0], drums: 'k.h.s.hhk.h.s.h.', wave: 'triangle' },
  { bpm: 112, root: 41, scale: PHRYG, bass: [0, 0, 1, 0, 0, 0, 3, 1], lead: [7, -1, -1, 8, 7, -1, 5, -1, 3, -1, 1, -1, 0, -1, -1, -1], drums: 'k...s..hk.k.s...', wave: 'sawtooth' },
  { bpm: 140, root: 43, scale: MINOR, bass: [0, 0, 0, 3, 0, 0, 5, 4], lead: [0, 3, 7, 3, 0, 3, 8, 7, 0, 3, 7, 10, 8, 7, 5, 3], drums: 'k.hhs.hhk.hhs.hk', wave: 'square' },
  { bpm: 128, root: 46, scale: DORIAN, bass: [0, 4, 3, 4, 0, 5, 4, 3], lead: [7, 9, 10, 9, 7, -1, 5, 4, 2, 4, 5, 7, 9, -1, 7, -1], drums: 'k.h.s.h.kkh.s.hh', wave: 'triangle' },
  { bpm: 118, root: 44, scale: PHRYG, bass: [0, 1, 0, 1, 3, 1, 0, -1], lead: [0, -1, 1, -1, 3, -1, 1, 0, 7, -1, 8, -1, 7, 5, 3, 1], drums: 'k..hs..hk..hs.hh', wave: 'sawtooth' },
  { bpm: 150, root: 42, scale: MINOR, bass: [0, 0, 5, 5, 3, 3, 4, 4], lead: [7, 7, 10, 7, 12, 10, 7, 5, 3, 5, 7, 5, 3, 2, 0, 2], drums: 'k.hks.hkk.hks.hs', wave: 'square' },
  { bpm: 108, root: 50, scale: MINOR, bass: [0, -1, 5, -1, 3, -1, 4, -1], lead: [9, -1, 7, -1, 5, -1, 4, 5, 7, -1, -1, -1, 4, -1, 2, -1], drums: 'k...h...s...h...', wave: 'triangle' },
  { bpm: 136, root: 40, scale: PHRYG, bass: [0, 0, 1, 1, 0, 0, 3, 1], lead: [0, 7, 8, 7, 0, 7, 10, 8, 0, 7, 8, 7, 5, 3, 1, 0], drums: 'k.hks.h.k.hks.hh', wave: 'sawtooth' },
  { bpm: 146, root: 38, scale: PHRYG, bass: [0, 0, 1, 0, 3, 0, 1, -1], lead: [12, -1, 13, 12, 10, -1, 8, 7, 8, -1, 7, 5, 3, 1, 0, -1], drums: 'kkhks.hkk.hks.hs', wave: 'sawtooth' },
  // 10: menu theme
  { bpm: 116, root: 50, scale: [0, 2, 4, 5, 7, 9, 11], bass: [0, 0, 5, 5, 3, 3, 4, 4], lead: [4, -1, 5, 7, -1, 7, 9, 7, 4, -1, 2, 4, 5, 4, 2, -1], drums: 'k.h.s.h.k.h.s.hh', wave: 'triangle' },
];

export class AudioSystem {
  private static inst: AudioSystem | null = null;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private duck = 1;
  private track: Track | null = null;
  private trackIndex = -1;
  private nextNoteTime = 0;
  private step = 0;
  private timer: number | null = null;
  private lastPlayed = new Map<Sfx, number>();

  static get(): AudioSystem {
    if (!AudioSystem.inst) AudioSystem.inst = new AudioSystem();
    return AudioSystem.inst;
  }

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.connect(this.master);
        this.sfxGain.connect(this.master);
        this.applyVolumes();
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        if (this.trackIndex >= 0) this.startScheduler();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (e) {
      console.warn('[audio] WebAudio unavailable', e);
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  /** Lower music while paused (GDD §6.4). */
  setDuck(on: boolean): void {
    this.duck = on ? 0.35 : 1;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.musicVol * 0.32 * this.duck, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol * 0.7, t, 0.02);
  }

  playMusic(index: number): void {
    if (index === this.trackIndex) return;
    this.trackIndex = index;
    this.track = TRACKS[index % TRACKS.length];
    this.step = 0;
    if (this.ctx) this.startScheduler();
  }

  stopMusic(): void {
    this.trackIndex = -1;
    this.track = null;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private startScheduler(): void {
    if (!this.ctx) return;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    // Audio scheduling clock (not gameplay logic) – lookahead pattern.
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  private schedule(): void {
    const ctx = this.ctx;
    const tr = this.track;
    if (!ctx || !tr) return;
    const sixteenth = 60 / tr.bpm / 4;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const s = this.step;
      const t = this.nextNoteTime;
      const d = tr.drums[s % 16];
      if (d === 'k') this.kick(t);
      if (d === 's') this.snare(t);
      if (d === 'h' || d === 's' || s % 2 === 0) this.hat(t, d === 'h' ? 0.05 : 0.025);
      if (s % 2 === 0) {
        const deg = tr.bass[(s / 2) % tr.bass.length | 0];
        if (deg >= 0) this.note(t, this.midi(tr, deg) - 12, sixteenth * 1.8, 'square', 0.16, 900);
      }
      const ld = tr.lead[s % tr.lead.length];
      const bar = Math.floor(s / 16) % 4;
      if (ld >= 0 && bar !== 3) this.note(t, this.midi(tr, ld) + 12, sixteenth * 0.9, tr.wave, 0.07, 2400);
      if (bar === 3 && s % 4 === 0) this.note(t, this.midi(tr, [0, 4, 2, 6][(s / 4) % 4 | 0]) + 12, sixteenth * 3, 'triangle', 0.06, 3000);
      this.nextNoteTime += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  private midi(tr: Track, degree: number): number {
    const oct = Math.floor(degree / tr.scale.length);
    const idx = ((degree % tr.scale.length) + tr.scale.length) % tr.scale.length;
    return tr.root + oct * 12 + tr.scale[idx];
  }

  private note(t: number, midi: number, dur: number, type: OscillatorType, vol: number, cutoff: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.2);
  }

  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, dest: GainNode, q = 1): void {
    const ctx = this.ctx!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number): void {
    this.noise(t, 0.14, 0.28, 'highpass', 1500, this.musicGain);
  }

  private hat(t: number, vol: number): void {
    this.noise(t, 0.04, vol, 'highpass', 7000, this.musicGain);
  }

  private tone(t: number, f0: number, f1: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // anti-spam: same sfx max ~25/s
    const last = this.lastPlayed.get(name) ?? 0;
    if (now - last < 0.04) return;
    this.lastPlayed.set(name, now);
    const t = now + 0.005;
    const S = this.sfxGain;
    switch (name) {
      case 'punch':
        this.noise(t, 0.08, 0.5, 'lowpass', 1800, S);
        this.tone(t, 180, 60, 0.09, 'sine', 0.5);
        break;
      case 'kick':
        this.noise(t, 0.1, 0.5, 'lowpass', 1300, S);
        this.tone(t, 140, 45, 0.13, 'sine', 0.6);
        break;
      case 'heavy':
        this.noise(t, 0.22, 0.7, 'lowpass', 900, S);
        this.tone(t, 110, 30, 0.25, 'sine', 0.8);
        break;
      case 'whoosh':
        this.noise(t, 0.12, 0.18, 'bandpass', 1200, S, 2);
        break;
      case 'hurt':
        this.tone(t, 520, 260, 0.14, 'square', 0.12);
        break;
      case 'enemyHurt':
        this.tone(t, 300, 150, 0.1, 'sawtooth', 0.08);
        break;
      case 'down':
        this.noise(t, 0.2, 0.4, 'lowpass', 500, S);
        break;
      case 'jump':
        this.tone(t, 300, 700, 0.12, 'triangle', 0.15);
        break;
      case 'land':
        this.noise(t, 0.08, 0.2, 'lowpass', 600, S);
        break;
      case 'dodge':
        this.noise(t, 0.15, 0.22, 'bandpass', 2400, S, 3);
        break;
      case 'skill':
        this.tone(t, 400, 1200, 0.18, 'square', 0.12);
        this.tone(t + 0.05, 600, 1600, 0.16, 'triangle', 0.1);
        break;
      case 'ultimate':
        this.tone(t, 200, 1400, 0.5, 'sawtooth', 0.16);
        this.tone(t + 0.1, 300, 2000, 0.45, 'square', 0.1);
        this.noise(t, 0.6, 0.3, 'highpass', 3000, S);
        break;
      case 'pickup':
        this.tone(t, 660, 1320, 0.12, 'triangle', 0.2);
        this.tone(t + 0.08, 990, 1980, 0.12, 'triangle', 0.16);
        break;
      case 'coin':
        this.tone(t, 1320, 1320, 0.06, 'square', 0.08);
        this.tone(t + 0.06, 1760, 1760, 0.12, 'square', 0.08);
        break;
      case 'warning':
        this.tone(t, 880, 880, 0.12, 'square', 0.1);
        this.tone(t + 0.16, 880, 880, 0.12, 'square', 0.1);
        break;
      case 'explosion':
        this.noise(t, 0.5, 0.7, 'lowpass', 700, S);
        this.tone(t, 90, 30, 0.5, 'sine', 0.6);
        break;
      case 'roar':
        this.tone(t, 160, 70, 0.7, 'sawtooth', 0.22);
        this.noise(t, 0.7, 0.25, 'bandpass', 400, S, 1.5);
        break;
      case 'spit':
        this.noise(t, 0.12, 0.25, 'bandpass', 900, S, 4);
        break;
      case 'train':
        this.noise(t, 1.2, 0.45, 'lowpass', 400, S);
        this.tone(t, 660, 600, 0.6, 'square', 0.08);
        break;
      case 'freeze':
        this.tone(t, 2000, 3000, 0.3, 'sine', 0.12);
        this.noise(t, 0.3, 0.2, 'highpass', 5000, S);
        break;
      case 'ui':
        this.tone(t, 900, 900, 0.05, 'square', 0.06);
        break;
      case 'confirm':
        this.tone(t, 660, 990, 0.09, 'square', 0.08);
        this.tone(t + 0.07, 990, 1320, 0.12, 'square', 0.08);
        break;
      case 'victory':
        [0, 4, 7, 12].forEach((s, i) => this.tone(t + i * 0.12, 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.25, 'square', 0.1));
        break;
      case 'defeat':
        [7, 4, 0, -5].forEach((s, i) => this.tone(t + i * 0.18, 392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12), 0.3, 'triangle', 0.14));
        break;
      case 'guard':
        this.tone(t, 1600, 1200, 0.08, 'square', 0.08);
        break;
      case 'break':
        this.noise(t, 0.25, 0.5, 'highpass', 2500, S);
        this.tone(t, 900, 200, 0.25, 'sawtooth', 0.12);
        break;
    }
  }
}
