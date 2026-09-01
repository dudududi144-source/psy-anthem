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
