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
