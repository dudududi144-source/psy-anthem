// PSY ANTHEM - solver/objective.ts
import type { InternalNoteEvent } from '../types';

export function scoreStepwise(prev: number, curr: number): number {
  const i = Math.abs(curr - prev);
  if (i <= 2) return 5;
  if (i <= 4) return 2;
  if (i <= 7) return 0;
  return -3;
}

export function scoreContour(melody: number[]): number {
  if (melody.length < 3) return 0;
  const maxNote = Math.max(...melody);
  const peak = melody.indexOf(maxNote);
  let rising = true;
  for (let i = 1; i <= peak; i++) {
    if (melody[i]! < melody[i - 1]!) rising = false;
  }
  let falling = true;
  for (let i = peak + 1; i < melody.length; i++) {
    if (melody[i]! > melody[i - 1]!) falling = false;
  }
  return (rising && falling) ? 10 : 0;
}

export function scoreRhythmicVariety(durations: number[]): number {
  let maxRun = 1;
  let cur = 1;
  for (let i = 1; i < durations.length; i++) {
    if (durations[i] === durations[i - 1]) {
      cur++;
      if (cur > maxRun) maxRun = cur;
    } else {
      cur = 1;
    }
  }
  if (maxRun > 8) return -(maxRun - 8) * 2;
  return 0;
}

// Fraction of events whose pitch class belongs to the motif core set.
export function motifCoverage(motifNotes: number[], events: InternalNoteEvent[]): number {
  if (events.length === 0) return 0;
  const set = new Set(motifNotes.map((n) => ((n % 12) + 12) % 12));
  let hits = 0;
  for (const e of events) {
    if (set.has(((e.pitch % 12) + 12) % 12)) hits++;
  }
  return hits / events.length;
}
