// probe
import { INTENT_INTERVAL_POOLS, RHYTHMIC_CELLS, VOICE_RANGES } from '../constants';
import { AnthemIntent } from '../types';
import type { AnthemConfig, MotifDNA } from '../types';
import type { RNG } from '../rng';
import { scalePitchClasses, snapToScale } from '../harmony/intervals';

export type Contour = 'ARCH' | 'ASCENT' | 'DESCENT' | 'WAVE' | 'PLATEAU';
