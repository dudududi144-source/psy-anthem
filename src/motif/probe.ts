// probe
import { INTENT_INTERVAL_POOLS, RHYTHMIC_CELLS, VOICE_RANGES } from '../constants';
import { AnthemIntent } from '../types';
import type { AnthemConfig, MotifDNA } from '../types';
import type { RNG } from '../rng';
import { scalePitchClasses, snapToScale } from '../harmony/intervals';

export type Contour = 'ARCH' | 'ASCENT' | 'DESCENT' | 'WAVE' | 'PLATEAU';
export type RhythmicCharacter = keyof typeof RHYTHMIC_CELLS;

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
