// PSY ANTHEM - expression/articulation.ts
import type { Articulation } from '../foundation-shim/protocol';
import type { InternalNoteEvent } from '../types';

// Derive articulation from section energy and note length.
export function deriveArticulation(events: InternalNoteEvent[], energy: number): InternalNoteEvent[] {
  let base: Articulation = 'legato';
  if (energy > 0.75) base = 'accent';
  else if (energy > 0.45) base = 'normal';
  return events.map((e) => {
    const art: Articulation = e.duration <= 0.25 ? 'staccato' : base;
    return { ...e, articulation: art };
  });
}
