/* ==========================================================
   FEISAR — synthesized anti-gravity engine (WebAudio, no samples)
   Exposed as window.FEISAR_AUDIO so the UI can toggle it.
   ========================================================== */
class EngineAudio {
  constructor() { this.ctx = null; this.on = false; this.speed = 0; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    // low hull drone
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 300; this.lp.Q.value = 6;
    const droneGain = ctx.createGain(); droneGain.gain.value = .07;
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth'; this.o1.frequency.value = 46;
    this.o2 = ctx.createOscillator(); this.o2.type = 'square'; this.o2.frequency.value = 46.4;
    this.o1.connect(this.lp); this.o2.connect(this.lp); this.lp.connect(droneGain).connect(this.master);

    // turbine whine
    this.whine = ctx.createOscillator(); this.whine.type = 'sine'; this.whine.frequency.value = 900;
    this.whineGain = ctx.createGain(); this.whineGain.gain.value = .012;
    const trem = ctx.createOscillator(); trem.frequency.value = 7; const tremG = ctx.createGain(); tremG.gain.value = 6;
    trem.connect(tremG).connect(this.whine.frequency);
    this.whine.connect(this.whineGain).connect(this.master);

    // air / field noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = ctx.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true;
    this.bp = ctx.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.frequency.value = 800; this.bp.Q.value = .7;
    this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = .02;
    this.noise.connect(this.bp).connect(this.noiseGain).connect(this.master);

    [this.o1, this.o2, this.whine, trem, this.noise].forEach(n => n.start());
  }

  enable() {
    this.init(); if (!this.ctx) return;
    this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(.55, this.ctx.currentTime, .4);
    window.dispatchEvent(new CustomEvent('feisar:sound', { detail: true }));
  }

  disable() {
    if (!this.ctx) return;
    this.on = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .15);
    window.dispatchEvent(new CustomEvent('feisar:sound', { detail: false }));
  }

  toggle() { this.on ? this.disable() : this.enable(); }

  // v: 0..1
  setSpeed(v) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    v = Math.max(0, Math.min(1, v));
    this.o1.frequency.setTargetAtTime(46 + v * 110, t, .08);
    this.o2.frequency.setTargetAtTime(46.4 + v * 111, t, .08);
    this.lp.frequency.setTargetAtTime(260 + v * 2400, t, .1);
    this.whine.frequency.setTargetAtTime(700 + v * 2900, t, .1);
    this.whineGain.gain.setTargetAtTime(.008 + v * .03, t, .1);
    this.bp.frequency.setTargetAtTime(500 + v * 2600, t, .1);
    this.noiseGain.gain.setTargetAtTime(.015 + v * .13, t, .1);
  }

  ignite() {
    if (!this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(2400, t + 1.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .3); g.gain.exponentialRampToValueAtTime(.0001, t + 2.2);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 2.3);
    const k = ctx.createOscillator(), kg = ctx.createGain();
    k.frequency.setValueAtTime(90, t + 1.5); k.frequency.exponentialRampToValueAtTime(28, t + 2.4);
    kg.gain.setValueAtTime(0, t + 1.5); kg.gain.linearRampToValueAtTime(.5, t + 1.52); kg.gain.exponentialRampToValueAtTime(.0001, t + 2.6);
    k.connect(kg).connect(this.master); k.start(t + 1.5); k.stop(t + 2.7);
  }

  blip(freq = 1800) {
    if (!this.on) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + .05);
    g.gain.setValueAtTime(.04, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + .1);
  }
}

window.FEISAR_AUDIO = new EngineAudio();
