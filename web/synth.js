// PSY ANTHEM - web/synth.js
// Psytrance sound engine for the browser (presentation layer). Phase 9.
//
// Voice techniques (preset.technique):
//   'FM'        - frequency modulation (modulator -> carrier.frequency)
//   'Additive'  - inharmonic partial stack with spectral morphing
//   'Granular'  - grain cloud texture (short enveloped oscillators)
//   'Wavetable' - crossfaded wave-pair morph + optional sub harmonic
//   'Physical'  - noise-burst excitation -> resonant body + damped fundamental
//   'Glitch'    - stochastic retriggered pluck (stutter/jitter)
//   (default)   - phase-8 subtractive: detuned unison -> resonant filter
//
// Master bus: masterGain -> drive shaper -> master filter -> compressor -> out
// Global sends: convolution reverb, tempo-synced feedback delay, modulated chorus.
//
// IMPORTANT: this file has NO imports. The preset library is injected via the
// constructor: new PsySynthBrowser(audioContext, { PRESETS, defaults }).

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

// Short decaying white-noise burst for physical-modeling excitation.
export function makeNoiseBurst(ctx, seconds = 0.02) {
  const rate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
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
    this.lastScheduleMs = 0;
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

  // ---------- phase-9 voice engines ----------
  // Each engine builds its sound graph into `mix` and returns the startable
  // nodes (oscillators / buffer sources) for stop() bookkeeping.

  // FM: modulator oscillator drives carrier.frequency (inharmonic sidebands).
  _fmVoice(note, preset, startTime, endTime, mix) {
    const ctx = this.ctx;
    const fm = preset.fm || {};
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = note.frequency;

    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    const ratio = (fm.modulator && fm.modulator.ratio) || 3.5;
    modulator.frequency.value = note.frequency * ratio;

    const modGain = ctx.createGain();
    const depth = (fm.modulator && fm.modulator.depth) || 600;
    modGain.gain.setValueAtTime(depth, startTime);
    // Spectral movement: mod depth settles over the note.
    const settle = (fm.modulator && fm.modulator.decay) || 0.25;
    modGain.gain.setTargetAtTime(depth * 0.35, startTime + 0.01, Math.max(0.02, settle));

    modulator.connect(modGain);
    modGain.connect(carrier.frequency); // FM!
    carrier.connect(mix);

    carrier.start(startTime);
    modulator.start(startTime);
    carrier.stop(endTime);
    modulator.stop(endTime);
    return [carrier, modulator];
  }

  // Additive: inharmonic partial stack with spectral morphing.
  _additiveVoice(note, preset, startTime, endTime, mix) {
    const ctx = this.ctx;
    const add = preset.additive || {};
    const partials = add.partials || [{ ratio: 1, amplitude: 1 }];
    const morph = add.morph || null;
    const totalAmp = partials.reduce((s, p) => s + p.amplitude, 0) || 1;
    const nodes = [];

    for (let i = 0; i < partials.length; i++) {
      const p = partials[i];
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = note.frequency * p.ratio;
      const gain = ctx.createGain();
      const startAmp = morph && morph.start && morph.start[i] !== undefined ? morph.start[i] : p.amplitude;
      gain.gain.setValueAtTime(startAmp / totalAmp, startTime);
      if (morph && morph.end && morph.end[i] !== undefined) {
        const morphDur = Math.max(0.05, Math.min(morph.duration || 0.5, Math.max(0.05, endTime - startTime)));
        gain.gain.linearRampToValueAtTime(morph.end[i] / totalAmp, startTime + morphDur);
      }
      osc.connect(gain);
      gain.connect(mix);
      osc.start(startTime);
      osc.stop(endTime);
      nodes.push(osc);
    }
    return nodes;
  }

  // Granular: cloud of short jittered grains (texture over the note span).
  _granularVoice(note, preset, startTime, endTime, mix) {
    const ctx = this.ctx;
    const gr = preset.granular || {};
    const density = gr.density || 8;
    const grainSize = gr.grainSize || 0.05;
    const jitter = gr.randomize !== undefined ? gr.randomize : 0.3;
    const span = Math.max(0.05, endTime - startTime);
    const count = Math.max(1, Math.min(24, Math.ceil(density * span)));
    const nodes = [];

    for (let i = 0; i < count; i++) {
      const grain = ctx.createOscillator();
      grain.type = i % 3 === 0 ? 'triangle' : 'sine';
      const freqJitter = 1 + (Math.random() - 0.5) * jitter * 0.2;
      grain.frequency.value = note.frequency * freqJitter;
      const grainGain = ctx.createGain();
      const gStart = startTime + (i / density) + (Math.random() - 0.5) * jitter * 0.02;
      const gPeak = 0.25 + Math.random() * 0.15;
      grainGain.gain.setValueAtTime(0, gStart);
      grainGain.gain.linearRampToValueAtTime(gPeak, gStart + 0.004);
      grainGain.gain.linearRampToValueAtTime(0, gStart + grainSize);
      grain.connect(grainGain);
      grainGain.connect(mix);
      grain.start(gStart);
      grain.stop(gStart + grainSize + 0.01);
      nodes.push(grain);
    }
    return nodes;
  }

  // Wavetable: crossfaded wave-pair morph + optional sub harmonic.
  _wavetableVoice(note, preset, startTime, endTime, mix) {
    const ctx = this.ctx;
    const wt = preset.wavetable || {};
    const types = wt.types && wt.types.length > 0 ? wt.types : ['sawtooth', 'square'];
    const pos = wt.position || { start: 0, end: 0.5, duration: 0.4 };
    const startIdx = Math.max(0, Math.min(types.length - 1, Math.round((pos.start || 0) * (types.length - 1))));
    const endIdx = Math.max(0, Math.min(types.length - 1, Math.round((pos.end || 0.5) * (types.length - 1))));
    const morphDur = Math.max(0.05, Math.min(pos.duration || 0.4, Math.max(0.05, endTime - startTime)));
    const nodes = [];

    // Wave A fades out, wave B fades in -> audible spectral morph.
    const oscA = ctx.createOscillator();
    oscA.type = types[startIdx];
    oscA.frequency.value = note.frequency;
    const gainA = ctx.createGain();
    gainA.gain.setValueAtTime(0.6, startTime);
    gainA.gain.linearRampToValueAtTime(0.05, startTime + morphDur);
    oscA.connect(gainA);
    gainA.connect(mix);

    const oscB = ctx.createOscillator();
    oscB.type = types[endIdx];
    oscB.frequency.value = note.frequency;
    const gainB = ctx.createGain();
    gainB.gain.setValueAtTime(0.05, startTime);
    gainB.gain.linearRampToValueAtTime(0.6, startTime + morphDur);
    oscB.connect(gainB);
    gainB.connect(mix);

    oscA.start(startTime); oscA.stop(endTime);
    oscB.start(startTime); oscB.stop(endTime);
    nodes.push(oscA, oscB);

    // Sub-harmonic layer (one octave below) when configured.
    if (wt.subHarmonic && wt.subHarmonic.enabled) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = note.frequency;
      if (sub.detune) sub.detune.value = -1200;
      const subGain = ctx.createGain();
      subGain.gain.value = wt.subHarmonic.depth || 0.5;
      sub.connect(subGain);
      subGain.connect(mix);
      sub.start(startTime);
      sub.stop(endTime);
      nodes.push(sub);
    }
    return nodes;
  }

  // Physical: noise-burst excitation -> resonant body + damped fundamental.
  _physicalVoice(note, preset, startTime, endTime, mix) {
    const ctx = this.ctx;
    const phy = preset.physical || {};
    const damping = phy.damping !== undefined ? phy.damping : 0.3;
    const nodes = [];

    // Excitation: short noise burst through a resonant bandpass (the pluck).
    const burst = ctx.createBufferSource();
    burst.buffer = makeNoiseBurst(ctx, 0.02);
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.value = note.frequency * 2;
    bodyFilter.Q.value = 6;
    const burstGain = ctx.createGain();
    burstGain.gain.value = (phy.pluck !== undefined ? phy.pluck : 0.9) * 0.8;
    burst.connect(bodyFilter);
    bodyFilter.connect(burstGain);
    burstGain.connect(mix);
    burst.start(startTime);

    // Sustained damped fundamental (the vibrating string).
    const fund = ctx.createOscillator();
    fund.type = 'triangle';
    fund.frequency.value = note.frequency;
    const fundGain = ctx.createGain();
    fundGain.gain.setValueAtTime(0.7, startTime);
    fundGain.gain.setTargetAtTime(0.001, startTime + 0.02, Math.max(0.03, 0.35 - damping * 0.3));
    fund.connect(fundGain);
    fundGain.connect(mix);
    fund.start(startTime);
    fund.stop(endTime);
    nodes.push(burst, fund);
    return nodes;
  }

  // Glitch: stochastic retriggered pluck (stutter + pitch jitter).
  _glitchVoice(note, preset, startTime, endTime, mix) {
    const ctx = this.ctx;
    const gl = preset.glitch || {};
    const rate = gl.rate || 4;
    const stochastic = gl.stochastic !== undefined ? gl.stochastic : 0.3;
    const span = Math.max(0.05, endTime - startTime);
    const retriggers = Math.max(1, Math.min(4, 1 + Math.floor(Math.random() * rate)));
    const spacing = span / (retriggers + 1);
    const nodes = [];

    for (let i = 0; i < retriggers; i++) {
      const tStart = startTime + i * spacing;
      const tDur = Math.min(spacing * 0.9, 0.12);
      const pitchJitter = 1 + (Math.random() - 0.5) * stochastic * 0.06;
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.value = note.frequency * pitchJitter;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, tStart);
      gain.gain.linearRampToValueAtTime(0.55 - i * 0.08, tStart + 0.003);
      gain.gain.setTargetAtTime(0.001, tStart + 0.01, Math.max(0.02, tDur * 0.5));
      osc.connect(gain);
      gain.connect(mix);
      osc.start(tStart);
      osc.stop(tStart + tDur + 0.02);
      nodes.push(osc);
    }
    return nodes;
  }
