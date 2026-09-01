// PSY ANTHEM - metrics/singability.ts
// How singable is the lead melody? (0-100)
import type { AnthemOutput, MusicalEvent, NoteData } from '../types';

export interface SingabilityReport {
  score: number;
  stepwiseRatio: number;
  rangeAppropriateness: number;
  breathability: number;
  hookClarity: number;
}

function leadNotes(output: AnthemOutput): MusicalEvent[] {
  return output.events
    .filter((e) => e.type === 'note' && e.channel === 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Fraction of melodic intervals that are steps (m2/M2).
export function stepwiseRatioOf(notes: MusicalEvent[]): number {
  if (notes.length < 2) return 0;
  let steps = 0;
  for (let i = 1; i < notes.length; i++) {
    const a = (notes[i - 1]!.data as NoteData).pitch;
    const b = (notes[i]!.data as NoteData).pitch;
    if (Math.abs(b - a) <= 2) steps++;
  }
  return steps / (notes.length - 1);
}

// Melodic span: ideal singable range is ~a fifth to ~an octave+ (7-19 semitones).
export function rangeAppropriatenessOf(notes: MusicalEvent[]): number {
  if (notes.length === 0) return 0;
  let lo = 127;
  let hi = 0;
  for (const n of notes) {
    const p = (n.data as NoteData).pitch;
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  const span = hi - lo;
  if (span >= 7 && span <= 19) return 1;
  if (span < 7) return clamp01(span / 7);
  // Too wide: decay to 0.3 at 36 semitones
  return clamp01(0.3 + 0.7 * (1 - (span - 19) / 17));
}

// Places to breathe: gaps >= 0.5 beats between consecutive notes.
export function breathabilityOf(notes: MusicalEvent[], bars: number): number {
  if (notes.length < 2 || bars <= 0) return 0;
  let breaths = 0;
  for (let i = 1; i < notes.length; i++) {
    const prevEnd = notes[i - 1]!.timestamp + notes[i - 1]!.duration;
    const gap = notes[i]!.timestamp - prevEnd;
    if (gap >= 0.5) breaths++;
  }
  const needed = Math.max(1, bars / 4);
  return clamp01(breaths / needed);
}

// Hook clarity: repetition of 3-note pitch-class cells.
export function hookClarityOf(notes: MusicalEvent[]): number {
  if (notes.length < 6) return 0;
  const cells = new Map<string, number>();
  for (let i = 0; i + 2 < notes.length; i++) {
    const a = (notes[i]!.data as NoteData).pitch % 12;
    const b = (notes[i + 1]!.data as NoteData).pitch % 12;
    const c = (notes[i + 2]!.data as NoteData).pitch % 12;
    const key = a + ',' + b + ',' + c;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  let maxCount = 0;
  for (const v of cells.values()) {
    if (v > maxCount) maxCount = v;
  }
  // 1 occurrence = no hook; 4+ = strong hook
  return clamp01((maxCount - 1) / 3);
}

export function analyzeSingability(output: AnthemOutput): SingabilityReport {
  const notes = leadNotes(output);
  const bars = output.metadata.bars;
  const stepwise = stepwiseRatioOf(notes);
  const range = rangeAppropriatenessOf(notes);
  const breath = breathabilityOf(notes, bars);
  const hook = hookClarityOf(notes);
  const score = Math.round(35 * stepwise + 25 * range + 20 * breath + 20 * hook);
  return {
    score,
    stepwiseRatio: stepwise,
    rangeAppropriateness: range,
    breathability: breath,
    hookClarity: hook,
  };
}
