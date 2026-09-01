// PSY ANTHEM - web/presets.js
// Phase 8 preset library: real psytrance sound design.
// Schema per preset:
//   oscillators[]: { type, detune (cents), gain }
//   filter: { type, cutoff, resonance, envelope: { amount, decay } | null }
//   envelope: ADSR { attack, decay, sustain, release }
//   lfo (optional): { target: 'filterCutoff' | 'pitch', rate, depth, waveform }
//   fx: { distortion, delaySend, reverbSend }

export const PRESETS = {
  // ===== LEAD =====
  'acid-lead': {
    name: 'Acid Lead (303)',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.6 },
      { type: 'square', detune: -5, gain: 0.4 },
    ],
    filter: {
      type: 'lowpass',
      cutoff: 1200,        // starts low
      resonance: 18,       // high resonance = squelch
      envelope: { amount: 3000, decay: 0.15 }, // filter opens with each note
    },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.08 },
    fx: { distortion: 0.3, delaySend: 0.25, reverbSend: 0.15 },
  },

  'psy-lead': {
    name: 'Psy Lead (Full-On)',
    oscillators: [
      { type: 'sawtooth', detune: -8, gain: 0.35 },
      { type: 'sawtooth', detune: 0, gain: 0.4 },
      { type: 'sawtooth', detune: 8, gain: 0.35 },
    ],
    filter: { type: 'lowpass', cutoff: 4500, resonance: 6, envelope: { amount: 1500, decay: 0.3 } },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.25 },
    fx: { distortion: 0.15, delaySend: 0.3, reverbSend: 0.2 },
  },

  'emotional-lead': {
    name: 'Emotional Lead (Breakdown)',
    oscillators: [
      { type: 'triangle', detune: -6, gain: 0.5 },
      { type: 'sine', detune: 6, gain: 0.5 },
    ],
    filter: { type: 'lowpass', cutoff: 6000, resonance: 2, envelope: null },
    envelope: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.8 },
    fx: { distortion: 0, delaySend: 0.35, reverbSend: 0.5 },
  },

  // ===== HARMONY =====
  'psy-pad': {
    name: 'Psy Pad (Atmospheric)',
    oscillators: [
      { type: 'sawtooth', detune: -12, gain: 0.25 },
      { type: 'sawtooth', detune: -4, gain: 0.25 },
      { type: 'sawtooth', detune: 4, gain: 0.25 },
      { type: 'sawtooth', detune: 12, gain: 0.25 },
    ],
    filter: { type: 'lowpass', cutoff: 2200, resonance: 1, envelope: null },
    envelope: { attack: 0.4, decay: 0.1, sustain: 0.85, release: 1.2 },
    fx: { distortion: 0, delaySend: 0.4, reverbSend: 0.6 },
  },

  // ===== COUNTER =====
  'pluck': {
    name: 'Pluck (Percussive)',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.7 },
      { type: 'square', detune: 7, gain: 0.3 },
    ],
    filter: { type: 'lowpass', cutoff: 5500, resonance: 8, envelope: { amount: 4000, decay: 0.06 } },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0.05, release: 0.12 },
    fx: { distortion: 0.1, delaySend: 0.45, reverbSend: 0.15 },
  },

  // ===== BASS =====
  'psy-bass': {
    name: 'Psy Bass (Offbeat)',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.7 },
      { type: 'sine', detune: -1200, gain: 0.5 },  // sub one octave down
    ],
    filter: { type: 'lowpass', cutoff: 800, resonance: 10, envelope: { amount: 600, decay: 0.08 } },
    envelope: { attack: 0.003, decay: 0.08, sustain: 0.25, release: 0.05 },
    fx: { distortion: 0.35, delaySend: 0, reverbSend: 0.05 },
  },

  'wobble-bass': {
    name: 'Wobble Bass',
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.8 },
    ],
    filter: { type: 'lowpass', cutoff: 1000, resonance: 16, envelope: null },
    lfo: { target: 'filterCutoff', rate: 6, depth: 800, waveform: 'sine' }, // wobble!
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.1 },
    fx: { distortion: 0.4, delaySend: 0, reverbSend: 0.05 },
  },

  'sub-rumble': {
    name: 'Sub Rumble',
    oscillators: [
      { type: 'sine', detune: 0, gain: 1.0 },
    ],
    filter: { type: 'lowpass', cutoff: 250, resonance: 0, envelope: null },
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.08 },
    fx: { distortion: 0.2, delaySend: 0, reverbSend: 0 },
  },
};

export const DEFAULT_VOICE_PRESETS = {
  0: 'psy-lead',      // Lead
  1: 'psy-pad',       // Harmony
  2: 'pluck',         // Counter
  3: 'psy-bass',      // Bass
};

// Voice categories for the UI dropdowns.
export const PRESET_CATEGORIES = {
  lead: ['acid-lead', 'psy-lead', 'emotional-lead'],
  harmony: ['psy-pad'],
  counter: ['pluck'],
  bass: ['psy-bass', 'wobble-bass', 'sub-rumble'],
};
