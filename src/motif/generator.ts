// PSY ANTHEM - motif/generator.ts
import { INTENT_INTERVAL_POOLS, RHYTHMIC_CELLS, VOICE_RANGES } from '../constants';
import { AnthemIntent } from '../types';
import type { AnthemConfig, MotifDNA } from '../types';
import type { RNG } from '../rng';
import { scalePitchClasses, snapToScale } from '../harmony/intervals';

export type Contour = 'ARCH' | 'ASCENT' | 'DESCENT' | 'WAVE' | 'PLATEAU';
export type RhythmicCharacter = keyof typeof RHYTHMIC_CELLS;

const CONTOURS: Contour[] = ['ARCH', 'ASCENT', 'DESCENT', 'WAVE', 'PLATEAU'];

export function rhythmicCharacterFor(intent: AnthemIntent, rng: RNG): RhythmicCharacter {
  switch (intent) {
    case AnthemIntent.FULL_ON:
      return rng.pick(['driving', 'driving', 'syncopated'] as const);
    case AnthemIntent.DARK_PSY:
      return rng.pick(['syncopated', 'driving'] as const);
    case AnthemIntent.PROGRESSIVE:
      return 'flowing';
    case AnthemIntent.EMOTIONAL_BREAKDOWN:
      return 'sparse';
    case AnthemIntent.FOREST:
      return rng.pick(['syncopated', 'flowing'] as const);
    case AnthemIntent.EUPHORIC_TRANCE:
      return rng.pick(['driving', 'flowing'] as const);
  }
}

function contourDirection(contour: Contour, i: number, length: number, rng: RNG): number {
  const mid = length / 2;
  switch (contour) {
    case 'ASCENT':
      return 1;
    case 'DESCENT':
      return -1;
    case 'ARCH':
      return i < mid ? 1 : -1;
    case 'WAVE':
      return i % 2 === 0 ? 1 : -1;
    case 'PLATEAU': {
      if (!rng.nextBool(0.25)) return 0;
      return rng.nextBool() ? 1 : -1;
    }
  }
}

function hasStep(notes: number[]): boolean {
  for (let i = 1; i < notes.length; i++) {
    if (Math.abs(notes[i]! - notes[i - 1]!) <= 2) return true;
  }
  return false;
}

export function generateMotif(config: AnthemConfig, rng: RNG): MotifDNA {
  const pcs = scalePitchClasses(config.scale);
  const leadRange = VOICE_RANGES[0]!;
  const rangeLo = Math.max(config.targetRange.min, leadRange.min - 12, 0);
  const rangeHi = Math.min(config.targetRange.max, leadRange.max, 127);
  const pool = INTENT_INTERVAL_POOLS[config.intent];
  const contour = rng.pick(CONTOURS);
  const length = rng.nextInt(3, 5);
  const character = rhythmicCharacterFor(config.intent, rng);
  const cell = RHYTHMIC_CELLS[character];

  // Start on a stable scale degree (root, 3rd, 5th).
  const stableOffsets = [0, 2, 4].map((i) => pcs[i % pcs.length]!);
  let pitch = snapToScale(rangeLo + 12 + rng.pick(stableOffsets), pcs, rangeLo, rangeHi);

  const coreNotes: number[] = [pitch];
  for (let i = 1; i < length; i++) {
    const interval = rng.pick(pool);
    const dir = contourDirection(contour, i, length, rng);
    pitch = snapToScale(pitch + dir * interval, pcs, rangeLo, rangeHi);
    coreNotes.push(pitch);
  }

  // Ensure at least one stepwise motion for singability.
  if (!hasStep(coreNotes) && coreNotes.length > 1) {
    const step = coreNotes[0]! + (rng.nextBool() ? 1 : -1);
    coreNotes[1] = snapToScale(step, pcs, rangeLo, rangeHi);
  }

  const coreRhythm: number[] = [];
  for (let i = 0; i < length; i++) {
    const d = cell[i % cell.length] ?? 0.5;
    coreRhythm.push(d === 0 ? 0.5 : d); // rests become short notes in the core
  }

  return { coreNotes, coreRhythm, transformations: [], occurrences: [] };
}
