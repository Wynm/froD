// froD audio: all sounds synthesized with WebAudio — zero asset files.
// SFX are short procedural blips/noise; music is a tiny step-sequenced chip loop.
const NOTE = {
  G2: 98.0, A2: 110.0, F2: 87.31, C3: 130.81,
  G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0
};

// 8 bars × 8 steps, A-minor pentatonic over Am–F–C–G
const LEAD = [
  'A4', null, 'C5', null, 'E5', null, 'D5', 'C5',
  'A4', null, null, null, 'G4', null, 'A4', null,
  'A4', null, 'C5', null, 'D5', null, 'C5', 'A4',
  'G4', null, 'A4', null, null, null, null, null,
  'E5', null, 'G5', null, 'E5', null, 'D5', 'C5',
  'D5', null, 'C5', null, 'A4', null, null, null,
  'G4', null, 'A4', null, 'C5', null, 'D5', null,
  'E5', null, 'D5', null, 'C5', null, 'A4', null
];
const BASS_ROOTS = ['A2', 'A2', 'F2', 'F2', 'C3', 'C3', 'G2', 'G2'];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.7;
    this.musicVol = 0.4;
    this.musicOn = true;
    this.muted = false;
    this.paused = false;
    this.transpose = 1;
    this._seqTimer = null;
    this._step = 0;
    this._nextTime = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.applyVolumes();
    this.startMusic();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.sfxGain.gain.value = Math.pow(this.sfxVol, 1.4);
    this.musicGain.gain.value = (this.musicOn && !this.paused) ? this.musicVol * 0.5 : 0;
  }

  configure({ sfx, music, musicOn }) {
    if (sfx !== undefined) this.sfxVol = sfx;
    if (music !== undefined) this.musicVol = music;
    if (musicOn !== undefined) this.musicOn = musicOn;
    this.applyVolumes();
  }

  toggleMute() { this.muted = !this.muted; this.applyVolumes(); return this.muted; }

  setPaused(p) {
    this.paused = p;
    this.applyVolumes();
  }

  setMood(theme) {
    this.transpose = theme === 'night' ? 0.8409 : theme === 'dusk' ? 0.9439 : 1; // -3 / -1 semitones
  }

  // ---- synth primitives ---------------------------------------------------
  tone({ freq, end = freq, dur = 0.1, type = 'square', vol = 0.2, at = 0, dest }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (end !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.2, from = 1200, to = 300, at = 0, dest }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + at;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  arp(freqs, { step = 0.085, dur = 0.12, type = 'triangle', vol = 0.22 } = {}) {
    freqs.forEach((f, i) => this.tone({ freq: f, dur, type, vol, at: i * step }));
  }

  // ---- named SFX ----------------------------------------------------------
  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'hop': this.tone({ freq: 320, end: 520, dur: 0.07, vol: 0.12 }); break;
      case 'splash':
        this.noise({ dur: 0.4, vol: 0.3, from: 900, to: 150 });
        this.tone({ freq: 220, end: 55, dur: 0.35, type: 'sine', vol: 0.25 });
        break;
      case 'hit':
        this.noise({ dur: 0.22, vol: 0.35, from: 2500, to: 200 });
        this.tone({ freq: 160, end: 40, dur: 0.3, type: 'sawtooth', vol: 0.3 });
        break;
      case 'bonk': this.tone({ freq: 180, end: 70, dur: 0.18, type: 'square', vol: 0.25 }); break;
      case 'home': this.arp([523.25, 659.25, 783.99, 1046.5]); break;
      case 'fly': this.arp([987.77, 1318.5], { step: 0.07, dur: 0.09, type: 'square', vol: 0.16 }); break;
      case 'pickup': this.tone({ freq: 660, end: 990, dur: 0.12, type: 'triangle', vol: 0.22 }); break;
      case 'shield': this.arp([880, 1108.7, 1318.5], { step: 0.05, dur: 0.18, vol: 0.15 }); break;
      case 'shieldBreak':
        this.tone({ freq: 240, end: 90, dur: 0.2, type: 'square', vol: 0.25 });
        this.noise({ dur: 0.15, vol: 0.2, from: 3000, to: 500 });
        break;
      case 'tick': this.tone({ freq: 1250, dur: 0.035, vol: 0.1 }); break;
      case 'extraLife': this.arp([392, 523.25, 659.25, 783.99, 1046.5], { step: 0.09 }); break;
      case 'clear': this.arp([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5], { step: 0.1, dur: 0.16 }); break;
      case 'gameover': this.arp([440, 349.23, 293.66, 220], { step: 0.18, dur: 0.3, type: 'sawtooth', vol: 0.14 }); break;
      case 'ui': this.tone({ freq: 700, dur: 0.04, vol: 0.08 }); break;
      case 'achievement': this.arp([880, 1174.7, 1760], { step: 0.09, dur: 0.35, type: 'sine', vol: 0.2 }); break;
      case 'croak':
        this.tone({ freq: 120, end: 75, dur: 0.14, type: 'sawtooth', vol: 0.18 });
        this.tone({ freq: 120, end: 70, dur: 0.12, type: 'sawtooth', vol: 0.14, at: 0.17 });
        break;
      case 'escortPickup': this.arp([659.25, 880, 1174.7], { step: 0.07, dur: 0.16, vol: 0.18 }); break;
      case 'escortHome': this.arp([523.25, 659.25, 880, 1046.5, 1318.5], { step: 0.08, dur: 0.2, vol: 0.2 }); break;
      case 'escortLost': this.tone({ freq: 440, end: 220, dur: 0.25, type: 'triangle', vol: 0.16 }); break;
      case 'snakeAlert': this.noise({ dur: 0.28, vol: 0.12, from: 4500, to: 1800 }); break;
      case 'snakeHit':
        this.noise({ dur: 0.2, vol: 0.25, from: 3500, to: 400 });
        this.tone({ freq: 190, end: 55, dur: 0.25, type: 'sawtooth', vol: 0.2 });
        break;
      case 'heronWarn':
        this.tone({ freq: 880, end: 620, dur: 0.16, type: 'triangle', vol: 0.14 });
        this.tone({ freq: 880, end: 620, dur: 0.16, type: 'triangle', vol: 0.12, at: 0.22 });
        break;
      case 'heronStrike': this.noise({ dur: 0.3, vol: 0.28, from: 2200, to: 250 }); break;
      case 'timeDeath': this.arp([660, 622, 587, 554], { step: 0.1, dur: 0.14, type: 'square', vol: 0.12 }); break;
    }
  }

  // ---- music sequencer ------------------------------------------------------
  startMusic() {
    if (!this.ctx || this._seqTimer) return;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.1;
    this._seqTimer = setInterval(() => this._schedule(), 25);
  }

  stopMusic() {
    if (this._seqTimer) { clearInterval(this._seqTimer); this._seqTimer = null; }
  }

  _schedule() {
    const STEP = 60 / 112 / 2; // 8th notes @112bpm
    while (this._nextTime < this.ctx.currentTime + 0.14) {
      const s = this._step % 64;
      const bar = Math.floor(s / 8);
      const beat = s % 8;
      const at = this._nextTime - this.ctx.currentTime;
      const tr = this.transpose;
      // lead
      const n = LEAD[s];
      if (n) this.tone({ freq: NOTE[n] * tr, dur: 0.22, type: 'square', vol: 0.07, at, dest: this.musicGain });
      // bass: root on 0 & 4, octave pop on 6
      if (beat === 0 || beat === 4) {
        this.tone({ freq: NOTE[BASS_ROOTS[bar]] * tr, dur: 0.24, type: 'triangle', vol: 0.16, at, dest: this.musicGain });
      } else if (beat === 6) {
        this.tone({ freq: NOTE[BASS_ROOTS[bar]] * 2 * tr, dur: 0.1, type: 'triangle', vol: 0.09, at, dest: this.musicGain });
      }
      // hats on off-beats
      if (beat % 2 === 1) this.noise({ dur: 0.03, vol: 0.025, from: 6000, to: 3000, at, dest: this.musicGain });
      // soft kick
      if (beat === 0 || beat === 4) this.tone({ freq: 110, end: 45, dur: 0.09, type: 'sine', vol: 0.12, at, dest: this.musicGain });
      this._nextTime += STEP;
      this._step++;
    }
  }
}
