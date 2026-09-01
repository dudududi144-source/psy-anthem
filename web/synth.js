// PSY ANTHEM - web/synth.js
// Psytrance sound engine for the browser (presentation layer). Phase 8.
//
// Architecture per note:
//   oscillators (1-5, detuned, sub via -1200 cents) -> voice filter
//   (resonant, per-note cutoff envelope) -> optional distortion -> ADSR gain
//   -> master bus + global sends (convolution reverb, tempo-synced delay, chorus)
//
// Master bus: masterGain -> drive shaper -> master filter -> compressor -> out
//
// IMPORTANT: this file has NO imports. The preset library is injected via the
// constructor: new PsySynthBrowser(audioContext, { PRESETS, defaults }).
// (Keeps the module graph flat for tooling compatibility.)

// Pure scheduling math (unit-testable without AudioContext).
export function scheduleEvents(events, bpm, startBeat = 0) {
  const secondsPerBeat = 60 / Math.max(1, bpm);
  const notes = [];
  for (const event of events) {
    if (event.type !== 'note') continue;
    if (event.timestamp + event.duration <= startBeat) continue;
    const pitch = event.data.pitch;
    const frequency = 440 * Math.pow(2, (pitch - 69) / 12);
    const offset = Math.max(0, startBeat - event.timestamp);
    notes.push({
      channel: event.channel,
      frequency,
      startBeat: Math.max(event.timestamp, startBeat),
      startAt: Math.max(0, event.timestamp - startBeat) * secondsPerBeat,
      duration: Math.max(0.05, (event.duration - offset) * secondsPerBeat),
      velocity: event.data.velocity / 127,
      articulation: event.data.articulation || 'normal',
      pitch,
    });
  }
  notes.sort((a, b) => a.startAt - b.startAt);
  const totalBeats = events.reduce((m, e) => {
    if (e.type !== 'note') return m;
    return Math.max(m, e.timestamp + e.duration);
  }, 0);
  return { notes, totalSeconds: Math.max(0, (totalBeats - startBeat)) * secondsPerBeat, totalBeats };
}

export function midiToFreq(pitch) {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

// Tanh saturation curve. amount 0 -> identity, 1 -> heavy drive.
export function makeDriveCurve(amount) {
  const k = 1 + amount * 20;
  const n = 512;
  const curve = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = amount === 0 ? x : Math.tanh(k * x) / norm;
  }
  return curve;
}

// Stereo impulse response for the convolution reverb (exponential decay noise).
export function makeImpulseResponse(ctx, seconds = 1.8, decay = 3.5) {
  const rate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

// Minimal fallback so the engine never crashes without an injected library.
export const FALLBACK_PRESETS = {
  'basic-lead': {
    name: 'Basic Lead',
    oscillators: [{ type: 'sawtooth', detune: 0, gain: 0.8 }],
    filter: { type: 'lowpass', cutoff: 3000, resonance: 4, envelope: null },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 },
    fx: { distortion: 0.1, delaySend: 0.2, reverbSend: 0.2 },
  },
};
export const FALLBACK_DEFAULTS = { 0: 'basic-lead', 1: 'basic-lead', 2: 'basic-lead', 3: 'basic-lead' };

export class PsySynthBrowser {
  // presetLibrary: { PRESETS, defaults } - injected, no static imports.
  constructor(audioContext, presetLibrary) {
    this.ctx = audioContext;
    const lib = presetLibrary || {};
    this.PRESETS = lib.PRESETS || FALLBACK_PRESETS;
    this.presets = Object.assign({}, lib.defaults || FALLBACK_DEFAULTS);

    // ---------- master chain: masterGain -> drive -> master filter -> compressor -> out
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.driveShaper = this.ctx.createWaveShaper();
    this._drive = 0.1;
    this.driveShaper.curve = makeDriveCurve(this._drive);
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 8000;
    this.masterFilter.Q.value = 0.5;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.masterGain.connect(this.driveShaper);
    this.driveShaper.connect(this.masterFilter);
    this.masterFilter.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // ---------- global reverb send (convolution)
    this.reverbLevel = 0.3;
    this.reverbIn = this.ctx.createGain();
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = makeImpulseResponse(this.ctx);
    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 0.9;
    this.reverbIn.connect(this.convolver);
    this.convolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.masterGain);

    // ---------- global tempo-synced delay send (dotted 8th, feedback 35%)
    this.delayLevel = 0.2;
    this.delayIn = this.ctx.createGain();
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.32;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.35;
    this.delayReturn = this.ctx.createGain();
    this.delayReturn.gain.value = 0.8;
    this.delayIn.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayReturn);
    this.delayReturn.connect(this.masterGain);

    // ---------- global chorus send (modulated delay)
    this.chorusIn = this.ctx.createGain();
    this.chorusDelay = this.ctx.createDelay(0.1);
    this.chorusDelay.delayTime.value = 0.025;
    this.chorusReturn = this.ctx.createGain();
    this.chorusReturn.gain.value = 0.8;
    this.chorusLfo = this.ctx.createOscillator();
    this.chorusLfo.frequency.value = 0.5;
    this.chorusLfoGain = this.ctx.createGain();
    this.chorusLfoGain.gain.value = 0.006;
    this.chorusLfo.connect(this.chorusLfoGain);
    this.chorusLfoGain.connect(this.chorusDelay.delayTime);
    this.chorusIn.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusReturn);
    this.chorusReturn.connect(this.masterGain);
    try { this.chorusLfo.start(0); } catch (e) { /* mock/edge contexts */ }

    this.activeNodes = [];
    this._timer = null;
    this.onFinish = null;
    this.lastNoteCount = 0;
  }

  // ---------- controls ----------
  setPresets(presets) {
    for (const key of Object.keys(presets)) {
      const id = presets[key];
      if (!this.PRESETS[id]) throw new Error('Unknown preset: ' + id);
      this.presets[key] = id;
    }
  }

  setMasterCutoff(hz) {
    this.masterFilter.frequency.value = Math.max(40, Math.min(16000, hz));
  }

  setReverbSend(v) {
    this.reverbLevel = Math.max(0, Math.min(1, v));
  }

  setDelaySend(v) {
    this.delayLevel = Math.max(0, Math.min(1, v));
  }

  setMasterDrive(v) {
    this._drive = Math.max(0, Math.min(1, v));
    this.driveShaper.curve = makeDriveCurve(this._drive);
  }

  setTempo(bpm) {
    // Dotted-eighth delay, classic psytrance echo
    this.delayNode.delayTime.value = (60 / Math.max(1, bpm)) * 0.75;
  }

  // ---------- voice rendering (phase 8 schema) ----------
  _scheduleVoice(note, preset, startTime) {
    const ctx = this.ctx;
    const fx = preset.fx || {};

    // Articulation shapes the note.
    let dur = note.duration;
    let velocity = note.velocity;
    if (note.articulation === 'staccato') dur = Math.min(dur, 0.12);
    if (note.articulation === 'accent') velocity = Math.min(1, velocity * 1.3);
    if (note.articulation === 'ghost') velocity *= 0.45;
    const endTime = startTime + Math.max(0.05, dur);

    const env = preset.envelope;
    const attack = Math.max(0.001, env.attack);
    const decay = Math.max(0.01, env.decay);
    const sustain = env.sustain;
    const release = Math.max(0.02, env.release);

    // --- oscillators: detuned unison; sub-octave via detune -1200 cents
    const mix = ctx.createGain();
    let totalOscGain = 0;
    const oscList = [];
    for (const spec of preset.oscillators) {
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = note.frequency;
      if (osc.detune) osc.detune.value = spec.detune || 0;
      const og = ctx.createGain();
      og.gain.value = spec.gain;
      osc.connect(og);
      og.connect(mix);
      osc.start(startTime);
      osc.stop(endTime + release + 0.05);
      oscList.push(osc);
      totalOscGain += spec.gain;
    }
    mix.gain.value = totalOscGain > 1 ? 1 / totalOscGain : 1;

    // --- voice filter with per-note cutoff envelope (psy sweep: open -> settle)
    const filter = ctx.createBiquadFilter();
    const fSpec = preset.filter;
    filter.type = fSpec.type || 'lowpass';
    filter.Q.value = fSpec.resonance || 0;
    const base = fSpec.cutoff;
    const fEnv = fSpec.envelope;
    if (fEnv && fEnv.amount) {
      filter.frequency.setValueAtTime(Math.min(16000, base + fEnv.amount), startTime);
      filter.frequency.setTargetAtTime(Math.max(40, base), startTime, Math.max(0.01, fEnv.decay));
    } else {
      filter.frequency.setValueAtTime(Math.max(40, base), startTime);
    }
    mix.connect(filter);

    // --- optional per-voice distortion
    let outNode = filter;
    if (fx.distortion && fx.distortion > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDriveCurve(fx.distortion);
      filter.connect(shaper);
      outNode = shaper;
    }

    // --- ADSR voice gain
    const voiceGain = ctx.createGain();
    const g = voiceGain.gain;
    g.setValueAtTime(0, startTime);
    g.linearRampToValueAtTime(velocity, startTime + attack);
    g.linearRampToValueAtTime(velocity * sustain, startTime + attack + decay);
    const relStart = Math.max(startTime + attack + decay, endTime - release);
    g.setValueAtTime(velocity * sustain, relStart);
    g.linearRampToValueAtTime(0.0001, endTime);
    outNode.connect(voiceGain);
    voiceGain.connect(this.masterGain);

    // --- global sends (preset amounts x global macros x velocity)
    if (fx.reverbSend && this.reverbLevel > 0) {
      const rg = ctx.createGain();
      rg.gain.value = fx.reverbSend * this.reverbLevel * velocity;
      voiceGain.connect(rg);
      rg.connect(this.reverbIn);
    }
    if (fx.delaySend && this.delayLevel > 0) {
      const dg = ctx.createGain();
      dg.gain.value = fx.delaySend * this.delayLevel * velocity;
      voiceGain.connect(dg);
      dg.connect(this.delayIn);
    }
    if (fx.chorusSend) {
      const cg = ctx.createGain();
      cg.gain.value = fx.chorusSend * 0.8 * velocity;
      voiceGain.connect(cg);
      cg.connect(this.chorusIn);
    }

    // --- optional LFO: wobble on filterCutoff or vibrato on pitch
    if (preset.lfo) {
      const lfo = ctx.createOscillator();
      lfo.type = preset.lfo.waveform || 'sine';
      lfo.frequency.value = preset.lfo.rate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = preset.lfo.depth || 0;
      lfo.connect(lfoGain);
      if (preset.lfo.target === 'pitch') {
        for (const osc of oscList) lfoGain.connect(osc.frequency);
      } else {
        lfoGain.connect(filter.frequency);
      }
      lfo.start(startTime);
      lfo.stop(endTime + release + 0.05);
      this.activeNodes.push(lfo);
    }

    for (const o of oscList) this.activeNodes.push(o);
  }

  _scheduleNote(note, startTime) {
    const presetId = this.presets[note.channel] || this.presets[0] || Object.keys(this.PRESETS)[0];
    const preset = this.PRESETS[presetId] || FALLBACK_PRESETS['basic-lead'];
    this._scheduleVoice(note, preset, startTime);
  }

  // ---------- transport ----------
  // Play a full AnthemOutput. fromBeat lets the scrubber start mid-piece.
  // Async: awaits the AudioContext unlock (autoplay policy) before scheduling.
  async playEvents(events, bpm = 140, fromBeat = 0) {
    this.stop();
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* context may still be locked */ }
    }
    this.setTempo(bpm);
    const plan = scheduleEvents(events, bpm, fromBeat);
    const t0 = this.ctx.currentTime + 0.06;

    for (const note of plan.notes) {
      this._scheduleNote(note, t0 + Math.max(0, note.startAt));
    }

    this.lastNoteCount = plan.notes.length;
    if (plan.totalSeconds > 0 && this.onFinish) {
      this._timer = setTimeout(() => {
        if (this.onFinish) this.onFinish();
      }, (plan.totalSeconds + 0.4) * 1000);
    }
    return plan.totalSeconds;
  }

  // Audibility check: three staggered tones (C major triad). Returns total seconds.
  async testSound() {
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* ignore */ }
    }
    const testNotes = [
      { pitch: 60, duration: 0.3 }, // C4
      { pitch: 64, duration: 0.3 }, // E4
      { pitch: 67, duration: 0.3 }, // G4
    ];
    const base = this.ctx.currentTime + 0.02;
    for (let i = 0; i < testNotes.length; i++) {
      const n = testNotes[i];
      this._scheduleNote({
        channel: 0,
        frequency: midiToFreq(n.pitch),
        startAt: i * 0.4,
        duration: n.duration,
        velocity: 0.8,
        articulation: 'normal',
        pitch: n.pitch,
      }, base + i * 0.4);
    }
    this.lastNoteCount = testNotes.length;
    return 1.2; // total duration in seconds
  }

  // Audition a single note (piano-roll click).
  playNote(pitch, velocity = 100) {
    if (this.ctx.state !== 'running') {
      try { this.ctx.resume(); } catch (e) { /* ignore */ }
    }
    this._scheduleNote({
      channel: 0,
      frequency: midiToFreq(pitch),
      startAt: 0,
      duration: 0.35,
      velocity: velocity / 127,
      articulation: 'normal',
      pitch,
    }, this.ctx.currentTime + 0.02);
  }

  stop() {
    for (const node of this.activeNodes) {
      try { node.stop(); } catch (e) { /* already stopped */ }
    }
    this.activeNodes = [];
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
}
