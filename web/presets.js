// PSY ANTHEM - web/presets.js
// Phase 9 preset library: modern synthesis techniques (2026 sound design).
// Each preset selects a technique via preset.technique:
//   'FM' | 'Additive' | 'Granular' | 'Wavetable' | 'Physical' | 'Glitch'

export const PRESETS = {
  // ===== LEAD =====
  'crystal-lead': {
    name: 'Crystal Lead',
    technique: 'FM',
    // Inharmonic 3.5:1 ratio -> metallic, bright, modern.
    fm: {
      carrier: { type: 'sine' },
      modulator: { ratio: 3.5, depth: 800, decay: 0.15 },
    },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.2 },
    fx: { shimmer: 0.6, bitcrush: 0.1, delaySend: 0.3, reverbSend: 0.2 },
  },

  'plasma-lead': {
    name: 'Plasma Lead',
    technique: 'Additive',
    // Detuned (inharmonic) partials + spectral morph over the note.
    additive: {
      partials: [
        { ratio: 1,    amplitude: 1.0 },
        { ratio: 2.01, amplitude: 0.7 },
        { ratio: 3.03, amplitude: 0.5 },
        { ratio: 5.07, amplitude: 0.3 },
        { ratio: 7.11, amplitude: 0.2 },
      ],
      morph: {
        start: [1.0, 0.7, 0.5, 0.3, 0.2],
        end:   [0.3, 0.5, 1.0, 0.7, 0.4],
        duration: 0.6,
      },
    },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.55, release: 0.3 },
    fx: { reverbSend: 0.5, delaySend: 0.3, chorusSend: 0.4 },
  },

  // ===== HARMONY =====
  'nebula-pad': {
    name: 'Nebula Pad',
    technique: 'Granular',
    // Slow dense grain cloud with pitch jitter = living, breathing texture.
    granular: { grainSize: 0.1, density: 12, randomize: 0.2 },
    envelope: { attack: 0.4, decay: 0.2, sustain: 0.9, release: 1.4 },
    fx: { reverbSend: 0.8, delaySend: 0.4, chorusSend: 0.5 },
  },

  // ===== COUNTER =====
  'glitch-pluck': {
    name: 'Glitch Pluck',
    technique: 'Glitch',
    // Stochastic stutter retriggers with pitch jitter.
    glitch: { rate: 4, stochastic: 0.4 },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0.1, release: 0.12 },
    fx: { delaySend: 0.5, reverbSend: 0.3, bitcrush: 0.15 },
  },

  // ===== BASS =====
  'neuro-bass': {
    name: 'Neuro Bass',
    technique: 'Wavetable',
    // Wave-pair morph (sine->square) + sub harmonic one octave down.
    wavetable: {
      types: ['sine', 'triangle', 'sawtooth', 'square'],
      position: { start: 0, end: 0.7, duration: 0.3 },
      subHarmonic: { enabled: true, depth: 0.5, octaves: -1 },
    },
    filter: { type: 'lowpass', cutoff: 900, resonance: 6, envelope: null },
    envelope: { attack: 0.004, decay: 0.09, sustain: 0.45, release: 0.06 },
    fx: { distortion: 0.6, reverbSend: 0.1, delaySend: 0 },
  },

  'quantum-bass': {
    name: 'Quantum Bass',
    technique: 'Physical',
    // Plucked resonant body: noise excitation + damped fundamental.
    physical: { pluck: 0.9, damping: 0.3 },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0.35, release: 0.1 },
    fx: { distortion: 0.3, reverbSend: 0.2, delaySend: 0 },
  },
};

// Alias for clarity in phase-9 docs/specs.
export const PRESETS_V2 = PRESETS;

export const DEFAULT_VOICE_PRESETS = {
  0: 'crystal-lead',   // Lead
  1: 'nebula-pad',     // Harmony
  2: 'glitch-pluck',   // Counter
  3: 'neuro-bass',     // Bass
};

// Voice categories for the UI dropdowns.
export const PRESET_CATEGORIES = {
  lead: ['crystal-lead', 'plasma-lead'],
  harmony: ['nebula-pad'],
  counter: ['glitch-pluck'],
  bass: ['neuro-bass', 'quantum-bass'],
};
