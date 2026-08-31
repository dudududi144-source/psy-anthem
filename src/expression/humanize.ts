// PSY ANTHEM - expression/humanize.ts
import { EXPRESSION_CONFIG } from '../constants';
import type { InternalNoteEvent } from '../types';
import type { RNG } from '../rng';

// Micro-timing: seeded jitter around the grid (never random, always reproducible).
export function humanizeTiming(events: InternalNoteEvent[], rng: RNG): InternalNoteEvent[] {
  const max = EXPRESSION_CONFIG.MAX_TIMING_DEVIATION;
  return events.map((e) => {
    const jitter = rng.nextFloat(-max, max);
    return { ...e, startBeat: Math.max(0, e.startBeat + jitter) };
  });
}
