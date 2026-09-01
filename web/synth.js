// PSY ANTHEM - web/synth.js
// Psytrance sound engine for the browser (presentation layer).
// Per-voice architecture:
//   oscillators (1-5 detuned) + sub-osc -> voice filter (resonant, enveloped)
//   -> optional distortion -> ADSR voice gain -> master bus + global sends
// Master bus: masterGain -> drive shaper -> master filter -> compressor -> out
// Global sends: convolution reverb, tempo-synced feedback delay, modulated chorus.

import { PRESETS, DEFAULT_PRESETS } from './presets.js';

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

export class PsySynthBrowser {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.presets = Object.assign({}, DEFAULT_PRESETS);

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
      if (!PRESETS[id]) throw new Error('Unknown preset: ' + id);
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
