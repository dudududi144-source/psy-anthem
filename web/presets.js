// PSY ANTHEM - web/presets.js
// Phase 10 preset library: 15 presets across six modern synthesis techniques.
// technique supports layering via 'A+B' (e.g. 'Granular+FM'); non-engine tokens
// act as modifiers (Distortion, Bitcrush, Sub, Filter).
export const PRESETS = {
  // ===== LEAD (5) =====
  'psy-supersaw': {
    name: 'Psy Supersaw',
    technique: 'Subtractive',
    description: 'Wide 3-voice detuned supersaw with sub warmth - optimized psy lead.',
    oscillators: [
      { type: 'sawtooth', detune: -18, gain: 0.33 },
      { type: 'sawtooth', detune: 0, gain: 0.34 },
      { type: 'sawtooth', detune: 18, gain: 0.33 },
    ],
    sub: { gain: 0.35, octaves: -1 },
    filter: { type: 'lowpass', cutoff: 2600, resonance: 8, envelope: { amount: 2200, decay: 0.18 } },
    envelope: { attack: 0.004, decay: 0.12, sustain: 0.55, release: 0.18 },
    fx: { distortion: 0.3, delaySend: 0.25, reverbSend: 0.2 },
  },

  'crystal-lead': {
    name: 'Crystal Lead',
    technique: 'FM',
    description: 'Metallic-bright FM with inharmonic 3.5:1 sidebands that settle over the note.',
    fm: { carrier: { type: 'sine' }, modulator: { ratio: 3.5, depth: 800, decay: 0.15 } },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.2 },
    fx: { shimmer: 0.6, bitcrush: 0.1, delaySend: 0.3, reverbSend: 0.2 },
  },

  'plasma-lead': {
    name: 'Plasma Lead',
    technique: 'Additive',
    description: 'Five inharmonic partials with spectral morphing across the note.',
    additive: {
      partials: [
        { ratio: 1, amplitude: 1.0 },
        { ratio: 2.01, amplitude: 0.7 },
        { ratio: 3.03, amplitude: 0.5 },
        { ratio: 5.07, amplitude: 0.3 },
        { ratio: 7.11, amplitude: 0.2 },
      ],
      morph: { start: [1.0, 0.7, 0.5, 0.3, 0.2], end: [0.3, 0.5, 1.0, 0.7, 0.4], duration: 0.6 },
    },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.55, release: 0.3 },
    fx: { reverbSend: 0.5, delaySend: 0.3, chorusSend: 0.4 },
  },

  'glass-lead': {
    name: 'Glass Lead',
    technique: 'Physical',
    description: 'Shattering glass: bright resonant body, fast excitation, long shimmer.',
    physical: { pluck: 0.9, damping: 0.1 },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0.2, release: 0.4 },
    fx: { shimmer: 0.7, reverbSend: 0.4, delaySend: 0.2, bitcrush: 0.05 },
  },

  'vapor-lead': {
    name: 'Vapor Lead',
    technique: 'Granular+FM',
    description: 'Dispersing vapor: FM core dissolving into a granular haze.',
    fm: { modulator: { ratio: 2.5, depth: 400, decay: 0.2 } },
    granular: { grainSize: 0.03, density: 15, randomize: 0.4 },
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.5 },
    fx: { reverbSend: 0.6, chorusSend: 0.3, bitcrush: 0.05 },
  },

  'neon-lead': {
    name: 'Neon Lead',
    technique: 'Wavetable+Distortion',
    description: 'Glowing neon: wavetable morph drenched in tube-style saturation.',
    wavetable: {
      types: ['sawtooth', 'square', 'sawtooth'],
      position: { start: 0.3, end: 0.9, duration: 0.35 },
    },
    envelope: { attack: 0.005, decay: 0.12, sustain: 0.65, release: 0.2 },
    fx: { distortion: 0.7, delaySend: 0.4, reverbSend: 0.3 },
  },

  // ===== HARMONY (3) =====
  'nebula-pad': {
    name: 'Nebula Pad',
    technique: 'Granular',
    description: 'Breathing grain cloud, wide reverb, slow pitch drift.',
    granular: { grainSize: 0.1, density: 12, randomize: 0.2 },
    envelope: { attack: 0.4, decay: 0.2, sustain: 0.9, release: 1.4 },
    fx: { reverbSend: 0.8, delaySend: 0.4, chorusSend: 0.5 },
  },

  'aurora-pad': {
    name: 'Aurora Pad',
    technique: 'Additive',
    description: 'Northern lights: 12 partials morphing slowly over seconds.',
    additive: {
      partials: [
        { ratio: 1, amplitude: 1.0 }, { ratio: 2, amplitude: 0.6 }, { ratio: 3, amplitude: 0.45 },
        { ratio: 4, amplitude: 0.35 }, { ratio: 5, amplitude: 0.28 }, { ratio: 6, amplitude: 0.22 },
        { ratio: 7, amplitude: 0.18 }, { ratio: 8, amplitude: 0.15 }, { ratio: 9, amplitude: 0.12 },
        { ratio: 10, amplitude: 0.1 }, { ratio: 11, amplitude: 0.08 }, { ratio: 12, amplitude: 0.06 },
      ],
      morph: {
        start: [1, 0.6, 0.45, 0.35, 0.28, 0.22, 0.18, 0.15, 0.12, 0.1, 0.08, 0.06],
        end: [0.3, 0.5, 0.7, 0.9, 1.0, 0.8, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1],
        duration: 3,
      },
    },
    envelope: { attack: 0.8, decay: 0.3, sustain: 0.9, release: 1.8 },
    fx: { reverbSend: 0.85, delaySend: 0.3, chorusSend: 0.5 },
  },

  'void-pad': {
    name: 'Void Pad',
    technique: 'Granular',
    description: 'Empty space: slow dark grains swallowed by an endless reverb.',
    granular: { grainSize: 0.2, density: 6, randomize: 0.5 },
    envelope: { attack: 1.0, decay: 0.4, sustain: 0.85, release: 2.0 },
    fx: { reverbSend: 0.95, delaySend: 0.5, chorusSend: 0.2 },
  },

  // ===== COUNTER (3) =====
  'glitch-pluck': {
    name: 'Glitch Pluck',
    technique: 'Glitch',
    description: 'Stochastic stutter retriggers with pitch jitter.',
    glitch: { rate: 4, stochastic: 0.4 },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0.1, release: 0.12 },
    fx: { delaySend: 0.5, reverbSend: 0.3, bitcrush: 0.15 },
  },

  'digital-pluck': {
    name: 'Digital Pluck',
    technique: 'FM',
    description: '8-bit flavored FM pluck: integer-ratio modulator crushed hard.',
    fm: { modulator: { ratio: 4, depth: 600, decay: 0.08 } },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0.15, release: 0.12 },
    fx: { bitcrush: 0.4, delaySend: 0.3, reverbSend: 0.2 },
  },

  'metallic-bell': {
    name: 'Metallic Bell',
    technique: 'Additive',
    description: 'Struck metal: inharmonic partial series with a long decay.',
    additive: {
      partials: [
        { ratio: 1, amplitude: 1.0 },
        { ratio: 2.76, amplitude: 0.6 },
        { ratio: 5.4, amplitude: 0.4 },
        { ratio: 8.93, amplitude: 0.25 },
        { ratio: 13.2, amplitude: 0.15 },
      ],
    },
    envelope: { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.2 },
    fx: { reverbSend: 0.6, delaySend: 0.4 },
  },

  // ===== BASS (4) =====
  'neuro-bass': {
    name: 'Neuro Bass',
    technique: 'Wavetable',
    description: 'Wavetable morph (sine->square) with a sub harmonic one octave down.',
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
    description: 'Plucked resonant body with a damped fundamental.',
    physical: { pluck: 0.9, damping: 0.3 },
    envelope: { attack: 0.002, decay: 0.12, sustain: 0.35, release: 0.1 },
    fx: { distortion: 0.3, reverbSend: 0.2, delaySend: 0 },
  },

  'plasma-bass': {
    name: 'Plasma Bass',
    technique: 'Granular+Sub',
    description: 'Granular texture fused with a sine sub two octaves down.',
    granular: { grainSize: 0.08, density: 10, randomize: 0.15 },
    sub: { octaves: -2, gain: 0.6, type: 'sine' },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.1 },
    fx: { distortion: 0.4, reverbSend: 0.1 },
  },

  'gravity-bass': {
    name: 'Gravity Bass',
    technique: 'Physical+Filter',
    description: 'Heavy physical bass under a slow upward filter sweep.',
    physical: { pluck: 0.7, damping: 0.4 },
    filter: { type: 'lowpass', cutoff: 2000, resonance: 5, envelope: { amount: -1800, decay: 3 } },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.15 },
    fx: { distortion: 0.5 },
  },
};

// Alias for clarity in docs/specs.
export const PRESETS_V2 = PRESETS;

export const DEFAULT_VOICE_PRESETS = {
  0: 'psy-supersaw',   // Lead
  1: 'nebula-pad',     // Harmony
  2: 'glitch-pluck',   // Counter
  3: 'neuro-bass',     // Bass
};

// Voice categories for the UI dropdowns.
export const PRESET_CATEGORIES = {
  lead: ['psy-supersaw', 'crystal-lead', 'plasma-lead', 'glass-lead', 'vapor-lead', 'neon-lead'],
  harmony: ['nebula-pad', 'aurora-pad', 'void-pad'],
  counter: ['glitch-pluck', 'digital-pluck', 'metallic-bell'],
  bass: ['neuro-bass', 'quantum-bass', 'plasma-bass', 'gravity-bass'],
};
