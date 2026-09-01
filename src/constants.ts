// PSY ANTHEM — constants.ts
import { AnthemIntent } from './types';
import type { ScaleMode, TensionWeights } from './types';

export const INTERVALS = {
  UNISON: 0, MINOR_SECOND: 1, MAJOR_SECOND: 2, MINOR_THIRD: 3, MAJOR_THIRD: 4,
  PERFECT_FOURTH: 5, TRITONE: 6, PERFECT_FIFTH: 7, MINOR_SIXTH: 8,
  MAJOR_SIXTH: 9, MINOR_SEVENTH: 10, MAJOR_SEVENTH: 11, OCTAVE: 12,
} as const;

export const CONSONANT_INTERVALS = new Set([0, 3, 4, 5, 7, 8, 9]);
export const DISSONANT_INTERVALS = new Set([1, 2, 6, 10, 11]);
export const PERFECT_INTERVALS = new Set([0, 5, 7, 12]);

export const SCALE_PATTERNS: Record<ScaleMode, readonly number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
  doubleHarmonicMajor: [0, 1, 4, 5, 7, 8, 11],
};

export const INTENT_INTERVAL_POOLS: Record<AnthemIntent, readonly number[]> = {
  [AnthemIntent.EUPHORIC_TRANCE]: [5, 7, 9, 10, 12],
  [AnthemIntent.DARK_PSY]: [1, 3, 6, 7],
  [AnthemIntent.PROGRESSIVE]: [2, 4, 5, 7],
  [AnthemIntent.FULL_ON]: [5, 7, 12],
  [AnthemIntent.EMOTIONAL_BREAKDOWN]: [3, 4, 9, 10],
  [AnthemIntent.FOREST]: [2, 3, 6, 7, 10],
  // Step-friendly pool: singable, lyrical leads (M2, m3, M3, P4, P5)
  [AnthemIntent.EMOTIONAL_LEAD]: [2, 3, 4, 5, 7],
};

export const INTENT_TENSION_WEIGHTS: Record<AnthemIntent, TensionWeights> = {
  [AnthemIntent.EUPHORIC_TRANCE]: { harmonic: 0.2, rhythmic: 0.3, register: 0.2, dynamic: 0.15, density: 0.15 },
  [AnthemIntent.DARK_PSY]: { harmonic: 0.35, rhythmic: 0.25, register: 0.15, dynamic: 0.1, density: 0.15 },
  [AnthemIntent.PROGRESSIVE]: { harmonic: 0.25, rhythmic: 0.2, register: 0.25, dynamic: 0.15, density: 0.15 },
  [AnthemIntent.FULL_ON]: { harmonic: 0.15, rhythmic: 0.35, register: 0.2, dynamic: 0.2, density: 0.1 },
  [AnthemIntent.EMOTIONAL_BREAKDOWN]: { harmonic: 0.3, rhythmic: 0.15, register: 0.3, dynamic: 0.15, density: 0.1 },
  [AnthemIntent.FOREST]: { harmonic: 0.3, rhythmic: 0.3, register: 0.15, dynamic: 0.1, density: 0.15 },
  [AnthemIntent.EMOTIONAL_LEAD]: { harmonic: 0.25, rhythmic: 0.15, register: 0.3, dynamic: 0.2, density: 0.1 },
};

// Voice ranges (MIDI): lead, harmony, counter, bass
export const VOICE_RANGES = [
  { name: 'lead', min: 60, max: 84 },
  { name: 'harmony', min: 55, max: 79 },
  { name: 'counter', min: 52, max: 76 },
  { name: 'bass', min: 36, max: 55 },
] as const;

export const RHYTHMIC_CELLS = {
  driving: [0.25, 0.25, 0.5, 0.25, 0.25, 0.5],
  flowing: [0.5, 0.5, 1, 0.5, 0.5],
  syncopated: [0.25, 0, 0.25, 0.5, 0, 0.25],
  sparse: [1, 0, 1, 0, 2],
} as const;

export const CHORD_INTERVALS: Record<string, readonly number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6], augmented: [0, 4, 8],
  dominant7: [0, 4, 7, 10], major7: [0, 4, 7, 11], minor7: [0, 3, 7, 10],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
  // Extended chords (phase 10): pitch-class stacks including 7th + color tones
  major9: [0, 4, 7, 11, 2],
  minor9: [0, 3, 7, 10, 2],
  dominant9: [0, 4, 7, 10, 2],
  major11: [0, 4, 7, 11, 2, 5],
  minor11: [0, 3, 7, 10, 2, 5],
  dominant11: [0, 4, 7, 10, 2, 5],
  major13: [0, 4, 7, 11, 2, 9],
  minor13: [0, 3, 7, 10, 2, 9],
  dominant13: [0, 4, 7, 10, 2, 9],
};

export const SOLVER_CONFIG = {
  TIME_BUDGET_MS: 50,
  HARD_LIMIT_MS: 100,
  MIN_ACCEPT_SCORE: 60,
  EXCELLENT_THRESHOLD: 90,
  MAX_BACKTRACKS: 10000,
} as const;

export const EXPRESSION_CONFIG = {
  MAX_TIMING_DEVIATION: 0.02, // beats (~5ms at 140 BPM)
  VELOCITY_MIN: 40,
  VELOCITY_MAX: 127,
  MIN_DURATION: 0.25,
  MAX_DURATION: 4,
} as const;

export const VALIDATION_THRESHOLDS = {
  MIN_MOTIF_COVERAGE: 0.6,
  MIN_MEMORABILITY: 60,
  PARALLEL_WINDOW: 2,
  MAX_UNRECOVERED_LEAP: 7,
  MAX_REPETITION: 8,
  TENSION_CORRELATION_MIN: 0.8,
} as const;

export const ALLOWED_DURATIONS = [0.25, 0.5, 1, 2, 4] as const;
