// PSY ANTHEM - web/presets.js
// Preset library for the browser psytrance sound engine.
// Each preset defines: oscillators (detuned), optional sub-osc,
// resonant filter with envelope, ADSR, optional LFO, and FX sends.

export const PRESETS = {
  // ===== LEAD VOICES =====
  'psy-lead': {
    name: 'Psy Lead (Classic)',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.5 },
      { type: 'sawtooth', detune: -7, gain: 0.3 },
      { type: 'sawtooth', detune: +7, gain: 0.3 },
    ],
    sub: { type: 'sine', octaves: -1, gain: 0.4 },
    filter: { type: 'lowpass', cutoff: 2800, resonance: 12, envelope: 0.6 },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.2 },
    fx: { distortion: 0.15, chorus: 0.2, delay: 0.3 },
  },

  'acid-lead': {
    name: 'Acid Lead (TB-303 style)',
    oscillators: [
      { type: 'square', detune: 0, gain: 0.7 },
      { type: 'sawtooth', detune: 0, gain: 0.3 },
    ],
    filter: { type: 'lowpass', cutoff: 800, resonance: 22, envelope: 0.9 },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.1 },
    fx: { distortion: 0.4, delay: 0.2 },
  },

  'emotional-lead': {
    name: 'Emotional Lead (breakdown)',
    oscillators: [
      { type: 'triangle', detune: 0, gain: 0.6 },
      { type: 'sine', detune: +5, gain: 0.3 },
    ],
    filter: { type: 'lowpass', cutoff: 4000, resonance: 4, envelope: 0.2 },
    envelope: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.8 },
    fx: { reverb: 0.6, chorus: 0.3 },
  },

  // ===== HARMONY VOICES =====
  'psy-pad': {
    name: 'Psy Pad (Atmospheric)',
    oscillators: [
      { type: 'sawtooth', detune: -12, gain: 0.25 },
      { type: 'sawtooth', detune: -5, gain: 0.25 },
      { type: 'sawtooth', detune: +5, gain: 0.25 },
      { type: 'sawtooth', detune: +12, gain: 0.25 },
    ],
    filter: { type: 'lowpass', cutoff: 1800, resonance: 2, envelope: 0.1 },
    envelope: { attack: 0.3, decay: 0.1, sustain: 0.9, release: 1.5 },
    fx: { reverb: 0.7, chorus: 0.4, delay: 0.4 },
  },

  'supersaw': {
    name: 'Supersaw (JP-8000 style)',
    oscillators: [
      { type: 'sawtooth', detune: -20, gain: 0.2 },
      { type: 'sawtooth', detune: -10, gain: 0.2 },
      { type: 'sawtooth', detune: 0, gain: 0.2 },
      { type: 'sawtooth', detune: +10, gain: 0.2 },
      { type: 'sawtooth', detune: +20, gain: 0.2 },
    ],
    filter: { type: 'lowpass', cutoff: 3200, resonance: 6, envelope: 0.4 },
    envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.4 },
    fx: { chorus: 0.5, reverb: 0.3 },
  },

  // ===== COUNTER VOICES =====
  'pluck': {
    name: 'Pluck (Short, percussive)',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.7 },
      { type: 'square', detune: 0, gain: 0.3 },
    ],
    filter: { type: 'lowpass', cutoff: 5000, resonance: 8, envelope: 0.95 },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0.1, release: 0.15 },
    fx: { delay: 0.4, reverb: 0.2 },
  },

  'arp-sequence': {
    name: 'Arp Sequence',
    oscillators: [
      { type: 'square', detune: 0, gain: 0.5 },
      { type: 'sawtooth', detune: -7, gain: 0.3 },
    ],
    filter: { type: 'lowpass', cutoff: 2500, resonance: 15, envelope: 0.8 },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0.4, release: 0.1 },
    fx: { delay: 0.6, distortion: 0.2 },
  },

  // ===== BASS VOICES =====
  'psy-bass': {
    name: 'Psy Bass (Classic offbeat)',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.6 },
    ],
    sub: { type: 'sine', octaves: -1, gain: 0.8 },
    filter: { type: 'lowpass', cutoff: 600, resonance: 8, envelope: 0.7 },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.05 },
    fx: { distortion: 0.3 },
  },

  'rumble-sub': {
    name: 'Sub Rumble',
    oscillators: [
      { type: 'sine', detune: 0, gain: 1.0 },
    ],
    filter: { type: 'lowpass', cutoff: 200, resonance: 0, envelope: 0 },
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.1 },
    fx: {},
  },

  'wobble-bass': {
    name: 'Wobble Bass',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.7 },
    ],
    sub: { type: 'sine', octaves: -1, gain: 0.6 },
    filter: { type: 'lowpass', cutoff: 1200, resonance: 18, envelope: 0.8 },
    lfo: { rate: 4, depth: 0.7, target: 'filter' }, // 4Hz wobble
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 },
    fx: { distortion: 0.4 },
  },
};

export const PRESET_CATEGORIES = {
  lead: ['psy-lead', 'acid-lead', 'emotional-lead'],
  harmony: ['psy-pad', 'supersaw'],
  counter: ['pluck', 'arp-sequence'],
  bass: ['psy-bass', 'rumble-sub', 'wobble-bass'],
};

export const DEFAULT_PRESETS = {
  0: 'psy-lead',    // Lead
  1: 'psy-pad',     // Harmony
  2: 'pluck',       // Counter
  3: 'psy-bass',    // Bass
};
