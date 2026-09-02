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

// Stereo impulse response for the convolution reverb.
// Richer than plain decay noise: stereo-decorrelated channels, a few early
// reflections for space/definition, then a smooth exponential tail.
export function makeImpulseResponse(ctx, seconds = 2.2, decay = 3.2) {
  const rate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    // Seeded-ish decorrelation: offset the noise phase per channel.
    const phase = ch * 0.37;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Smooth exponential tail (pow curve for a natural-sounding decay).
      const tail = Math.pow(1 - t, decay);
      // Pseudo-random noise, decorrelated between channels.
      const n = Math.sin((i + 1) * (12.9898 + ch * 3.7) + phase) * 43758.5453;
      const noise = (n - Math.floor(n)) * 2 - 1;
      data[i] = noise * tail;
    }
    // Early reflections: a handful of discrete taps in the first ~80ms.
    const early = [0.012, 0.023, 0.037, 0.052, 0.068];
    for (let k = 0; k < early.length; k++) {
      const idx = Math.floor(early[k] * rate) + ch * 3;
      if (idx < length) {
        const amp = 0.5 * Math.pow(1 - early[k] / 0.08, 1.5) * (k % 2 === ch ? 1 : 0.7);
        data[idx] += amp;
        if (idx + 1 < length) data[idx + 1] += amp * 0.5;
      }
    }
  }
  return buffer;
}

// Asymmetric soft-clip curve for analog-style warmth (adds even harmonics).
export function makeWarmCurve(amount) {
  const n = 512;
  const curve = new Float32Array(n);
  const k = 1 + amount * 4;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    // Asymmetric soft clip: slight DC bias adds even harmonics (warmth).
    const driven = Math.tanh((x + 0.02) * k);
    curve[i] = driven / Math.tanh(k * 1.02);
  }
  return curve;
}

// Encode an AudioBuffer to a 16-bit PCM WAV file (Uint8Array).
export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;
  const ab = new ArrayBuffer(bufferSize);
  const view = new DataView(ab);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let s = channels[ch][i];
      s = Math.max(-1, Math.min(1, s));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Uint8Array(ab);
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

// ---------- Drum engine (channel 9 = drums, GM-standard) ----------
// Drum pitch map (GM): kick=36, snare=38, clap=39, hatClosed=42, hatOpen=46,
// percLow=43, percHigh=50.

export function scheduleKick(ctx, dest, time, vel) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
  osc.connect(g); g.connect(dest);
  osc.start(time); osc.stop(time + 0.25);
  return [osc];
}

export function scheduleHat(ctx, dest, time, vel, open) {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBurst(ctx, open ? 0.25 : 0.06);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = open ? 7000 : 8500;
  const g = ctx.createGain();
  const decay = open ? 0.22 : 0.05;
  g.gain.setValueAtTime(vel * 0.6, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + decay);
  src.connect(hp); hp.connect(g); g.connect(dest);
  src.start(time); src.stop(time + decay + 0.02);
  return [src];
}

export function scheduleSnare(ctx, dest, time, vel) {
  const nodes = [];
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBurst(ctx, 0.18);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vel * 0.7, time);
  ng.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
  noise.connect(bp); bp.connect(ng); ng.connect(dest);
  noise.start(time); noise.stop(time + 0.18);
  nodes.push(noise);
  const tone = ctx.createOscillator();
  tone.type = 'triangle'; tone.frequency.value = 190;
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(vel * 0.4, time);
  tg.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
  tone.connect(tg); tg.connect(dest);
  tone.start(time); tone.stop(time + 0.1);
  nodes.push(tone);
  return nodes;
}

export function schedulePerc(ctx, dest, time, vel, pitch) {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  const base = pitch || 400;
  osc.frequency.setValueAtTime(base, time);
  osc.frequency.exponentialRampToValueAtTime(base * 0.5, time + 0.08);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = base; bp.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel * 0.4, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  osc.connect(bp); bp.connect(g); g.connect(dest);
  osc.start(time); osc.stop(time + 0.12);
  return [osc];
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
    this.warmShaper = this.ctx.createWaveShaper();
    this.warmShaper.curve = makeWarmCurve(0.6);
    this.masterGain.connect(this.warmShaper);
    this.warmShaper.connect(this.driveShaper);
    this.driveShaper.connect(this.masterFilter);
    this.masterFilter.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // ---------- per-voice mixer (track gain nodes -> masterGain)
    this.trackGains = [];
    for (let ch = 0; ch < 4; ch++) {
      const tg = this.ctx.createGain();
      tg.gain.value = 1.0;
      tg.connect(this.masterGain);
      this.trackGains.push(tg);
    }

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

  // Phase-8 subtractive path: detuned unison -> resonant filter w/ envelope.
  _subtractiveVoice(note, preset, startTime, endTime, mix) {
    const ctx = this.ctx;
    const nodes = [];
    let totalOscGain = 0;
    const oscSpecs = preset.oscillators || [];
    const nOsc = oscSpecs.length;
    const hasPanner = typeof ctx.createStereoPanner === 'function';
    for (let oi = 0; oi < nOsc; oi++) {
      const spec = oscSpecs[oi];
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = note.frequency;
      if (osc.detune) osc.detune.value = spec.detune || 0;
      const og = ctx.createGain();
      og.gain.value = spec.gain;
      osc.connect(og);
      // Stereo width: spread unison voices across the field for a wide sound.
      if (nOsc > 1 && hasPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = ((oi / (nOsc - 1)) * 2 - 1) * 0.7;
        og.connect(pan);
        pan.connect(mix);
      } else {
        og.connect(mix);
      }
      osc.start(startTime);
      osc.stop(endTime);
      nodes.push(osc);
      totalOscGain += spec.gain;
    }
    // Sub-oscillator: sine an octave (or preset.sub.octaves) below for weight/warmth.
    // Opt-in via preset.sub = { gain, octaves }.
    if (preset.sub) {
      const subGain = preset.sub.gain !== undefined ? preset.sub.gain : 0.4;
      const subOct = preset.sub.octaves !== undefined ? preset.sub.octaves : -1;
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = note.frequency * Math.pow(2, subOct);
      // Gentle warm saturation on the sub for bass weight/growl.
      const subShaper = ctx.createWaveShaper();
      subShaper.curve = makeWarmCurve(0.4);
      const sg = ctx.createGain();
      sg.gain.value = subGain;
      sub.connect(subShaper);
      subShaper.connect(sg);
      sg.connect(mix);
      sub.start(startTime);
      sub.stop(endTime);
      nodes.push(sub);
      totalOscGain += subGain;
    }
    mix.gain.value = totalOscGain > 1 ? 1 / totalOscGain : 1;
    return nodes;
  }

  // ---------- voice dispatcher: technique -> graph -> ADSR -> sends ----------
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

    const env = preset.envelope || { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.15 };
    const attack = Math.max(0.001, env.attack);
    const decay = Math.max(0.01, env.decay);
    const sustain = env.sustain !== undefined ? env.sustain : 0.6;
    const release = Math.max(0.02, env.release);

    // --- technique sound graph -> mix
    // Supports layered techniques written as 'A+B' (e.g. 'Granular+FM'):
    // each known engine renders into its own layer gain; secondary layers sit
    // behind the primary. Non-engine tokens act as modifiers (Distortion, Bitcrush).
    const mix = ctx.createGain();
    const KNOWN_ENGINES = ['FM', 'Additive', 'Granular', 'Wavetable', 'Physical', 'Glitch'];
    const parts = String(preset.technique || '').split('+').map((s) => s.trim()).filter((s) => s.length > 0);
    const engines = parts.filter((p) => KNOWN_ENGINES.includes(p));
    const modifiers = parts.filter((p) => !KNOWN_ENGINES.includes(p));

    let techNodes = [];
    if (engines.length === 0) {
      techNodes = this._subtractiveVoice(note, preset, startTime, endTime, mix);
    } else {
      for (let ei = 0; ei < engines.length; ei++) {
        const layerGain = ctx.createGain();
        layerGain.gain.value = ei === 0 ? 1 : 0.45;
        layerGain.connect(mix);
        const eng = engines[ei];
        let nodes = [];
        if (eng === 'FM') nodes = this._fmVoice(note, preset, startTime, endTime, layerGain);
        else if (eng === 'Additive') nodes = this._additiveVoice(note, preset, startTime, endTime, layerGain);
        else if (eng === 'Granular') nodes = this._granularVoice(note, preset, startTime, endTime, layerGain);
        else if (eng === 'Wavetable') nodes = this._wavetableVoice(note, preset, startTime, endTime, layerGain);
        else if (eng === 'Physical') nodes = this._physicalVoice(note, preset, startTime, endTime, layerGain);
        else if (eng === 'Glitch') nodes = this._glitchVoice(note, preset, startTime, endTime, layerGain);
        for (const n of nodes) techNodes.push(n);
      }
    }

    // --- optional generic sub layer (works with any technique via preset.sub)
    if (preset.sub && preset.sub.octaves) {
      const sub = ctx.createOscillator();
      sub.type = preset.sub.type || 'sine';
      sub.frequency.value = note.frequency;
      if (sub.detune) sub.detune.value = 1200 * preset.sub.octaves; // negative = down
      const subGain = ctx.createGain();
      subGain.gain.value = preset.sub.gain !== undefined ? preset.sub.gain : 0.5;
      sub.connect(subGain);
      subGain.connect(mix);
      sub.start(startTime);
      sub.stop(endTime);
      techNodes.push(sub);
    }

    // --- optional voice filter with per-note cutoff envelope
    let outNode = mix;
    if (preset.filter) {
      const filter = ctx.createBiquadFilter();
      const fSpec = preset.filter;
      filter.type = fSpec.type || 'lowpass';
      filter.Q.value = fSpec.resonance || 0;
      const base = fSpec.cutoff || 2000;
      const fEnv = fSpec.envelope;
      if (fEnv && fEnv.amount) {
        filter.frequency.setValueAtTime(Math.min(16000, base + fEnv.amount), startTime);
        filter.frequency.setTargetAtTime(Math.max(40, base), startTime, Math.max(0.01, fEnv.decay || 0.1));
      } else {
        filter.frequency.setValueAtTime(Math.max(40, base), startTime);
      }
      mix.connect(filter);
      // Gentle drive after the filter for analog warmth.
      const filterDrive = ctx.createWaveShaper();
      filterDrive.curve = makeWarmCurve(0.3);
      filter.connect(filterDrive);
      outNode = filterDrive;
    }

    // --- optional per-voice distortion (modifier-aware: 'Distortion'/'Bitcrush')
    let driveAmount = fx.distortion !== undefined ? fx.distortion : (fx.bitcrush || 0);
    if ((modifiers.includes('Distortion') || modifiers.includes('Bitcrush')) && driveAmount <= 0) {
      driveAmount = 0.5;
    }
    if (driveAmount > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDriveCurve(driveAmount);
      outNode.connect(shaper);
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
    const tg = this.trackGains[note.channel] || this.masterGain;
    voiceGain.connect(tg);

    // --- global sends (preset amounts x global macros x velocity)
    const reverbSend = fx.reverbSend !== undefined ? fx.reverbSend : (fx.reverb || 0);
    const delaySend = fx.delaySend !== undefined ? fx.delaySend : (fx.delay || 0);
    const shimmer = fx.shimmer || 0;
    const totalReverb = Math.min(1, reverbSend + shimmer * 0.5);
    if (totalReverb > 0 && this.reverbLevel > 0) {
      const rg = ctx.createGain();
      rg.gain.value = totalReverb * this.reverbLevel * velocity;
      voiceGain.connect(rg);
      rg.connect(this.reverbIn);
    }
    if (delaySend > 0 && this.delayLevel > 0) {
      const dg = ctx.createGain();
      dg.gain.value = delaySend * this.delayLevel * velocity;
      voiceGain.connect(dg);
      dg.connect(this.delayIn);
    }
    const chorusSend = fx.chorusSend !== undefined ? fx.chorusSend : (fx.chorus || 0);
    if (chorusSend > 0) {
      const cg = ctx.createGain();
      cg.gain.value = chorusSend * 0.8 * velocity;
      voiceGain.connect(cg);
      cg.connect(this.chorusIn);
    }

    // --- optional LFO (phase-8 compat): wobble on cutoff or vibrato on pitch
    if (preset.lfo) {
      const lfo = ctx.createOscillator();
      lfo.type = preset.lfo.waveform || 'sine';
      lfo.frequency.value = preset.lfo.rate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = preset.lfo.depth || 0;
      lfo.connect(lfoGain);
      if (preset.lfo.target === 'pitch') {
        for (const n of techNodes) {
          if (n.frequency) lfoGain.connect(n.frequency);
        }
      } else if (outNode !== mix && outNode.frequency) {
        lfoGain.connect(outNode.frequency);
      }
      lfo.start(startTime);
      lfo.stop(endTime + release + 0.05);
      this.activeNodes.push(lfo);
    }

    for (const n of techNodes) this.activeNodes.push(n);
  }

  _scheduleNote(note, startTime) {
    // Channel 9 is the GM drum channel - route to the drum engine.
    if (note.channel === 9) {
      this._scheduleDrum(note, startTime);
      return;
    }
    const presetId = this.presets[note.channel] || this.presets[0] || Object.keys(this.PRESETS)[0];
    const preset = this.PRESETS[presetId] || FALLBACK_PRESETS['basic-lead'];
    this._scheduleVoice(note, preset, startTime);
  }

  _scheduleDrum(note, startTime) {
    const vel = note.velocity;
    if (vel <= 0.001) return; // silent note
    const pitch = note.pitch;
    const dest = this.masterGain;
    if (pitch === 36) {
      this.activeNodes.push(...scheduleKick(this.ctx, dest, startTime, vel));
    } else if (pitch === 38 || pitch === 39) {
      this.activeNodes.push(...scheduleSnare(this.ctx, dest, startTime, vel));
    } else if (pitch === 42) {
      this.activeNodes.push(...scheduleHat(this.ctx, dest, startTime, vel, false));
    } else if (pitch === 46) {
      this.activeNodes.push(...scheduleHat(this.ctx, dest, startTime, vel, true));
    } else {
      this.activeNodes.push(...schedulePerc(this.ctx, dest, startTime, vel, pitch * 8));
    }
  }

  // ---------- transport ----------
  isValidEvent(event) {
    if (!event || event.type !== 'note' || !event.data) return false;
    const p = event.data.pitch;
    const v = event.data.velocity;
    if (typeof p !== 'number' || p < 0 || p > 127) return false;
    if (typeof v !== 'number' || v < 0 || v > 127) return false;
    if (typeof event.timestamp !== 'number' || event.timestamp < 0) return false;
    if (typeof event.duration !== 'number' || event.duration <= 0) return false;
    return true;
  }

  // Play a full AnthemOutput. fromBeat lets the scrubber start mid-piece.
  // Async: awaits the AudioContext unlock (autoplay policy) before scheduling.
  // Robust: validates events up front and isolates per-note scheduling errors.
  async playEvents(events, bpm = 140, fromBeat = 0) {
    this.stop();
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* context may still be locked */ }
    }

    const valid = Array.isArray(events) ? events.filter((e) => this.isValidEvent(e)) : [];
    if (valid.length === 0) {
      this.lastNoteCount = 0;
      return 0;
    }

    this.setTempo(bpm);
    const plan = scheduleEvents(valid, bpm, fromBeat);

    // ---- Full upfront scheduling ----
    // For a composition engine every note is known ahead of time, so we schedule
    // them all up front. Web Audio is designed for this and it avoids the
    // setInterval-throttling gaps that lookahead scheduling introduced.
    this._plan = plan.notes;
    this._t0 = this.ctx.currentTime + 0.06;
    this._scheduledCount = 0;
    for (const note of plan.notes) {
      try {
        this._scheduleNote(note, this._t0 + Math.max(0, note.startAt));
        this._scheduledCount++;
      } catch (err) {
        console.warn('psy-anthem: failed to schedule one note:', err);
      }
    }

    this.lastNoteCount = plan.notes.length;
    if (plan.totalSeconds > 0 && this.onFinish) {
      this._finishTimer = setTimeout(() => {
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

  // Render events offline to an AudioBuffer (for WAV export). Uses an
  // OfflineAudioContext and schedules all notes up front (no lookahead clock).
  async renderOffline(events, bpm = 140, fromBeat = 0) {
    const valid = Array.isArray(events) ? events.filter((e) => this.isValidEvent(e)) : [];
    if (valid.length === 0) return null;
    const plan = scheduleEvents(valid, bpm, fromBeat);
    if (plan.totalSeconds <= 0) return null;
    const durationSec = plan.totalSeconds + 1.5; // tail for release/reverb
    const sampleRate = this.ctx.sampleRate || 44100;
    const length = Math.ceil(durationSec * sampleRate);
    if (typeof OfflineAudioContext === 'undefined') return null;
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
    const off = new PsySynthBrowser(offlineCtx, { PRESETS: this.PRESETS, defaults: this.presets });
    // Mirror current master drive/warmth so the render matches the live sound.
    const t0 = 0.06;
    for (const note of plan.notes) {
      off._scheduleNote(note, t0 + Math.max(0, note.startAt));
    }
    const buffer = await offlineCtx.startRendering();
    return buffer;
  }

  // Convenience: render events and return WAV bytes.
  async renderToWav(events, bpm = 140, fromBeat = 0) {
    const buffer = await this.renderOffline(events, bpm, fromBeat);
    if (!buffer) return null;
    return audioBufferToWav(buffer);
  }

  // Per-voice mixer: set a voice's volume (0-1).
  setTrackVolume(channel, volume) {
    const tg = this.trackGains[channel];
    if (tg) tg.gain.value = Math.max(0, Math.min(1, volume));
  }

  // Per-voice mixer: mute/unmute a voice.
  setTrackMuted(channel, muted) {
    const tg = this.trackGains[channel];
    if (tg) tg.gain.value = muted ? 0 : 1;
  }

  stop() {
    if (this._schedTimer) { clearInterval(this._schedTimer); this._schedTimer = null; }
    if (this._finishTimer) { clearTimeout(this._finishTimer); this._finishTimer = null; }
    this._plan = null;
    this._planIndex = 0;
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
