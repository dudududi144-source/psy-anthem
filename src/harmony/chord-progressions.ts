// PSY ANTHEM - harmony/chord-progressions.ts
import { CHORD_INTERVALS } from '../constants';
import type { AnthemConfig, ChordQuality, ChordSymbol, SectionPlan, ScaleDefinition } from '../types';
import type { RNG } from '../rng';

export interface ChordProgression {
  chords: ChordSymbol[];
  key: ScaleDefinition;
}

interface DegreeSpec {
  degree: number;
  quality: ChordQuality;
}

// Diatonic-style progressions: degree = scale index, quality is the typical triad.
const MINOR_PROGRESSIONS: DegreeSpec[][] = [
  [
    { degree: 0, quality: 'minor' },
    { degree: 5, quality: 'major' },
    { degree: 2, quality: 'major' },
    { degree: 6, quality: 'major' },
  ],
  [
    { degree: 0, quality: 'minor' },
    { degree: 3, quality: 'minor' },
    { degree: 6, quality: 'major' },
    { degree: 4, quality: 'minor' },
  ],
];

const MAJOR_PROGRESSIONS: DegreeSpec[][] = [
  [
    { degree: 0, quality: 'major' },
    { degree: 4, quality: 'major' },
    { degree: 5, quality: 'minor' },
    { degree: 3, quality: 'major' },
  ],
  [
    { degree: 0, quality: 'major' },
    { degree: 3, quality: 'major' },
    { degree: 4, quality: 'major' },
    { degree: 3, quality: 'major' },
  ],
];

// Complexity bands ---------------------------------------------------------
// simple: only tonic/subdominant/dominant functions.
const SIMPLE_MINOR: DegreeSpec[][] = [
  [
    { degree: 0, quality: 'minor' },
    { degree: 5, quality: 'minor' },
    { degree: 7, quality: 'major' },
    { degree: 0, quality: 'minor' },
  ],
];
const SIMPLE_MAJOR: DegreeSpec[][] = [
  [
    { degree: 0, quality: 'major' },
    { degree: 5, quality: 'major' },
    { degree: 7, quality: 'major' },
    { degree: 0, quality: 'major' },
  ],
];
// complex: standard language + secondary dominants (V7/V, V7/vi, V7/IV).
const COMPLEX_MINOR_EXTRA: DegreeSpec[][] = [
  [
    { degree: 0, quality: 'minor' },
    { degree: 2, quality: 'dominant7' },
    { degree: 5, quality: 'major' },
    { degree: 6, quality: 'major' },
  ],
  [
    { degree: 0, quality: 'minor' },
    { degree: 4, quality: 'dominant7' },
    { degree: 7, quality: 'major' },
    { degree: 3, quality: 'dominant7' },
  ],
];
const COMPLEX_MAJOR_EXTRA: DegreeSpec[][] = [
  [
    { degree: 0, quality: 'major' },
    { degree: 2, quality: 'dominant7' },
    { degree: 5, quality: 'major' },
    { degree: 9, quality: 'minor' },
  ],
  [
    { degree: 0, quality: 'major' },
    { degree: 7, quality: 'dominant7' },
    { degree: 4, quality: 'dominant7' },
    { degree: 5, quality: 'major' },
  ],
];

function isMajorLike(mode: string): boolean {
  return mode === 'major' || mode === 'lydian' || mode === 'mixolydian';
}

// Approximate semitone offset of a scale degree index (natural-minor/major layout).
function scaleDegreeSemitone(degreeIndex: number): number {
  const pattern = [0, 2, 4, 5, 7, 9, 11, 12];
  return pattern[degreeIndex % pattern.length] ?? 0;
}

export function generateChordProgression(
  config: AnthemConfig,
  sections: SectionPlan[],
  rng: RNG,
): ChordProgression {
  const majorLike = isMajorLike(config.scale.mode);
  const complexity = config.harmonyComplexity ?? 'standard';
  let bank: DegreeSpec[][];
  if (complexity === 'simple') {
    bank = majorLike ? SIMPLE_MAJOR : SIMPLE_MINOR;
  } else if (complexity === 'complex') {
    bank = majorLike
      ? MAJOR_PROGRESSIONS.concat(COMPLEX_MAJOR_EXTRA)
      : MINOR_PROGRESSIONS.concat(COMPLEX_MINOR_EXTRA);
  } else {
    bank = majorLike ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;
  }
  const progression = rng.pick(bank);

  const chords: ChordSymbol[] = [];
  let bar = 0;
  let idx = 0;
  while (bar < config.bars) {
    const spec = progression[idx % progression.length]!;
    const section = sections.find((s) => bar >= s.startBar && bar < s.startBar + s.bars);
    const hr = Math.max(1, section ? section.harmonicRhythm : 1);
    const dur = Math.max(1, Math.floor(1 / hr));
    const semitones = scaleDegreeSemitone(spec.degree);
    chords.push({
      root: (config.scale.root + semitones) % 12,
      quality: spec.quality,
      extensions: [],
      startBar: bar,
      durationBars: Math.min(dur, config.bars - bar),
    });
    bar += dur;
    idx++;
  }
  return { chords, key: config.scale };
}

export function chordTones(chord: ChordSymbol): number[] {
  const intervals = CHORD_INTERVALS[chord.quality] ?? CHORD_INTERVALS['major']!;
  return intervals.map((i) => (chord.root + i) % 12);
}
