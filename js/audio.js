// Sonido estilo Game Boy: ondas cuadradas con WebAudio.
const AudioFX = {
  ctx: null,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  },
  tone(freq, dur, delay = 0, vol = 0.06, type = 'square') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  blip()    { this.tone(880, 0.05); },
  confirm() { this.tone(660, 0.06); this.tone(990, 0.08, 0.06); },
  cancel()  { this.tone(440, 0.08); },
  bump()    { this.tone(110, 0.06, 0, 0.05); },
  hit()     { this.tone(200, 0.1, 0, 0.08, 'sawtooth'); this.tone(150, 0.12, 0.05, 0.06, 'sawtooth'); },
  heal()    { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, i * 0.1)); },
  ball()    { this.tone(700, 0.05); this.tone(500, 0.08, 0.06); },
  shake()   { this.tone(180, 0.08, 0, 0.07); },
  catchOk() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.15, i * 0.09)); },
  faint()   { [400, 300, 200, 120].forEach((f, i) => this.tone(f, 0.1, i * 0.08)); },
  levelUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.1, i * 0.07)); },
  // Grito pseudoaleatorio por especie: secuencia de tonos derivada del id.
  cry(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) % 9973;
    for (let i = 0; i < 3; i++) {
      const f = 200 + ((s * (i + 3) * 7919) % 700);
      this.tone(f, 0.09, i * 0.08, 0.07);
    }
  },
  battleStart() { [660, 587, 523, 466, 415, 370].forEach((f, i) => this.tone(f, 0.07, i * 0.05, 0.07)); },
  victory()     { [523, 523, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, i * 0.1)); },

  // ---- Terror ----
  sweep(f0, f1, dur, vol, type, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  // Sting de asalto: golpe seco disonante — sobresalta sin llegar a screamer.
  sting() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Tres osciladores en cluster disonante (tritono + semitono), ataque instantáneo
    for (const [f, vol] of [[220, 0.28], [311, 0.22], [466, 0.18]]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.55);
    }
    // Golpe de percusión corto (ruido filtrado grave)
    const len = (0.08 * this.ctx.sampleRate) | 0;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gn = this.ctx.createGain(); gn.gain.value = 0.35;
    src.connect(gn); gn.connect(this.ctx.destination);
    src.start(t);
  },
  // Reinicia música tras batalla
  resumeMusic(map) { if (typeof Music !== 'undefined') Music.playForMap(map); },
  drone: null,
  droneStart() {
    if (!this.ctx || this.drone) return;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.07, this.ctx.currentTime + 0.6);
    const oscs = [46, 49, 92.5].map(f => {
      const o = this.ctx.createOscillator();
      o.type = f < 60 ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      o.connect(g); o.start();
      return o;
    });
    g.connect(this.ctx.destination);
    this.drone = { g, oscs };
  },
  droneStop() {
    if (!this.ctx || !this.drone) return;
    const d = this.drone;
    this.drone = null;
    const t = this.ctx.currentTime;
    d.g.gain.setTargetAtTime(0.0001, t, 0.15);
    d.oscs.forEach(o => o.stop(t + 1));
  },
};

// ---- Música de fondo estilo Game Boy ------------------------------------------------
// Notas frecuentes de referencia
const _N = {
  G3:196,A3:220,B3:247,C4:262,D4:294,E4:330,F4:349,G4:392,A4:440,Bb4:466,B4:494,
  C5:523,D5:587,Eb5:622,E5:659,F5:698,G5:784,_:null,
};
const Music = {
  _bpm: 150,
  _pitchMult: 1.0,
  _tempoMult: 1.0,
  _distAmt: 0.0,
  _targetDist: 0.0,
  _horrorOn: false,
  _noteIdx: 0,
  _nextTime: 0,
  _timer: null,
  _gain: null,
  _shaper: null,
  _track: null,
  _prevGameState: null,

  // ---- Pistas: [frecuencia_hz|null, duración_en_tiempos] ----------------------------
  TRACKS: {
    // Tema de pueblo: do mayor, pastoral, evoca Pueblo Paleta
    town: [
      [_N.G4,1],[_N.E4,0.5],[_N.G4,0.5],[_N.A4,1],[_N.G4,0.5],[_N.E4,0.5],[_N.D4,1],[_N._,1],
      [_N.E4,1],[_N.G4,0.5],[_N.A4,0.5],[_N.G4,1],[_N.E4,0.5],[_N.C4,0.5],[_N.D4,2],
      [_N.A4,1],[_N.G4,0.5],[_N.A4,0.5],[_N.C5,1],[_N.B4,0.5],[_N.A4,0.5],[_N.G4,2],
      [_N.E4,1],[_N.G4,1],[_N.A4,1.5],[_N.G4,0.5],[_N.E4,1],[_N.D4,0.5],[_N.C4,0.5],[_N._,1],
      [_N.G4,1],[_N.A4,0.5],[_N.G4,0.5],[_N.E4,1],[_N.D4,1],[_N.E4,1],[_N.G4,1],
      [_N.A4,1],[_N.C5,0.5],[_N.B4,0.5],[_N.A4,1],[_N.G4,0.5],[_N.A4,0.5],[_N.G4,2],
    ],
    // Tema de ruta: re mayor, enérgico, exterior
    route: [
      [_N.D5,0.5],[_N.B4,0.5],[_N.D5,0.5],[_N.B4,0.5],[_N.A4,1],[_N.B4,0.5],[_N.D5,0.5],[_N.D5,1],[_N._,1],
      [_N.A4,0.5],[_N.G4,0.5],[_N.A4,0.5],[_N.B4,0.5],[_N.D5,1],[_N.A4,0.5],[_N.G4,0.5],[_N.A4,2],
      [_N.B4,1],[_N.D5,0.5],[_N.E5,0.5],[_N.D5,1],[_N.B4,0.5],[_N.A4,0.5],[_N.G4,1],[_N._,1],
      [_N.A4,0.5],[_N.B4,0.5],[_N.D5,0.5],[_N.B4,0.5],[_N.A4,1],[_N.G4,1],[_N.A4,2],
      [_N.G4,0.5],[_N.A4,0.5],[_N.B4,0.5],[_N.A4,0.5],[_N.G4,1],[_N.A4,0.5],[_N.B4,0.5],[_N.D5,1],[_N._,1],
      [_N.E5,1],[_N.D5,0.5],[_N.B4,0.5],[_N.A4,1],[_N.G4,0.5],[_N.A4,0.5],[_N.B4,2],
    ],
    // Tema de cueva: la menor, oscuro, esparso (Monte Luna / alcantarillas)
    cave: [
      [_N.A3,1.5],[_N._,0.5],[_N.C4,1],[_N.E4,0.5],[_N.D4,0.5],[_N.C4,1],[_N._,1],
      [_N.B3,1.5],[_N._,0.5],[_N.D4,1],[_N.F4,0.5],[_N.E4,0.5],[_N.D4,1],[_N._,1],
      [_N.A3,1],[_N.C4,0.5],[_N.E4,0.5],[_N.A4,1],[_N._,1],[_N.G4,0.5],[_N.E4,0.5],[_N._,1],
      [_N.G3,1.5],[_N._,0.5],[_N.B3,1],[_N.D4,0.5],[_N.E4,0.5],[_N.D4,1],[_N.C4,1],
      [_N.A3,2],[_N._,1],[_N.E4,0.5],[_N.D4,0.5],[_N.C4,1],[_N.B3,1],
    ],
    // Tema de combate: tenso, cromático
    battle: [
      [_N.G4,0.5],[_N.G4,0.5],[_N._,0.5],[_N.G4,0.5],[_N._,0.5],[_N.Eb5,0.5],[_N.G4,0.5],[_N._,0.5],
      [_N.Bb4,0.5],[_N._,1.5],[_N.G4,0.5],[_N._,0.5],[_N.Bb4,0.5],[_N.A4,0.5],[_N._,1],
      [_N.G4,0.5],[_N.G4,0.5],[_N._,0.5],[_N.G4,0.5],[_N.Eb5,1],[_N.D5,0.5],[_N._,0.5],[_N.C5,1],
      [_N.B4,0.5],[_N.A4,0.5],[_N.G4,0.5],[_N.Bb4,0.5],[_N.A4,0.5],[_N.G4,0.5],[_N.E4,0.5],[_N._,0.5],[_N._,1],
    ],
  },

  // Mapa → pista
  _mapTrack(map) {
    if (!map) return 'town';
    if (['route1','route2','route3','route4','forest'].includes(map)) return 'route';
    if (['mtmoon','sewers_a','sewers_b','sewers_exit'].includes(map)) return 'cave';
    return 'town';
  },

  _distCurve(amt) {
    const n = 256, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1;
      c[i] = amt > 0 ? Math.tanh(x * (1 + amt * 10)) : x;
    }
    return c;
  },

  _init() {
    if (this._gain) return;
    const ctx = AudioFX.ctx;
    if (!ctx) return;
    this._shaper = ctx.createWaveShaper();
    this._shaper.curve = this._distCurve(0);
    this._shaper.oversample = '2x';
    this._gain = ctx.createGain();
    this._gain.gain.value = 0;
    this._shaper.connect(this._gain);
    this._gain.connect(ctx.destination);
  },

  playForMap(map) {
    this.play(this._mapTrack(map));
  },

  play(trackName) {
    if (!AudioFX.ctx) return;
    this._init();
    if (trackName === this._track) return;
    const prev = this._track;
    this._track = trackName;
    this._noteIdx = 0;
    this._nextTime = AudioFX.ctx.currentTime + 0.08;
    // Fade out then in for track changes
    if (prev) {
      this._gain.gain.setTargetAtTime(0, AudioFX.ctx.currentTime, 0.15);
      setTimeout(() => {
        if (this._track !== trackName) return;
        this._gain.gain.setTargetAtTime(0.07, AudioFX.ctx.currentTime, 0.3);
      }, 400);
    } else {
      this._gain.gain.setTargetAtTime(0.07, AudioFX.ctx.currentTime, 0.5);
    }
    if (!this._timer) this._timer = setInterval(() => this._tick(), 25);
  },

  stop() {
    this._track = null;
    if (!this._gain) return;
    this._gain.gain.setTargetAtTime(0, AudioFX.ctx.currentTime, 0.3);
  },

  setHorror(on) {
    this._horrorOn = on;
    if (on) {
      this._pitchMult = 0.52;
      this._tempoMult = 0.35;
      this._targetDist = 1.0;
    } else {
      this._pitchMult = 1.0;
      this._tempoMult = 1.0;
      this._targetDist = 0.0;
    }
  },

  _tick() {
    if (!AudioFX.ctx) return;
    const ctx = AudioFX.ctx;
    // Suavizar distorsión
    this._distAmt += (this._targetDist - this._distAmt) * 0.12;
    if (Math.abs(this._distAmt - this._targetDist) > 0.01 || this._targetDist > 0) {
      this._shaper.curve = this._distCurve(this._distAmt);
    }
    if (!this._track) return;
    const notes = this.TRACKS[this._track];
    if (!notes) return;
    const beat = (60 / this._bpm) / this._tempoMult;
    const lookahead = 0.18;
    while (this._nextTime < ctx.currentTime + lookahead) {
      const entry = notes[this._noteIdx % notes.length];
      const freq = entry[0], beats = entry[1];
      const dur = beats * beat;
      if (freq !== null) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = freq * this._pitchMult;
        const vol = 0.045, att = 0.008, rel = Math.min(dur * 0.8, dur - 0.02);
        g.gain.setValueAtTime(0, this._nextTime);
        g.gain.linearRampToValueAtTime(vol, this._nextTime + att);
        g.gain.setValueAtTime(vol, this._nextTime + rel);
        g.gain.exponentialRampToValueAtTime(0.0001, this._nextTime + dur);
        o.connect(g);
        g.connect(this._shaper);
        o.start(this._nextTime);
        o.stop(this._nextTime + dur + 0.01);
      }
      this._nextTime += dur;
      this._noteIdx = (this._noteIdx + 1) % notes.length;
    }
  },
};
