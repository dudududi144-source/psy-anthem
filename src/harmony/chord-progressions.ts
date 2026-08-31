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
  const bank = majorLike ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;
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
