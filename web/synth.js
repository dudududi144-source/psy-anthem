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
