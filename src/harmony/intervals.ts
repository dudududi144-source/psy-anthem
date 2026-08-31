// PSY ANTHEM - harmony/intervals.ts
import { CONSONANT_INTERVALS, DISSONANT_INTERVALS, SCALE_PATTERNS } from '../constants';
import type { ScaleDefinition } from '../types';

export function scalePitchClasses(scale: ScaleDefinition): number[] {
  const pattern = SCALE_PATTERNS[scale.mode];
  return pattern.map((p) => (scale.root + p) % 12);
}

export function isInScale(pitch: number, pcs: number[]): boolean {
  return pcs.includes(((pitch % 12) + 12) % 12);
}

export function intervalClass(a: number, b: number): number {
  return Math.abs(a - b) % 12;
}

export function isConsonant(ic: number): boolean {
  return CONSONANT_INTERVALS.has(ic % 12);
}

export function isDissonant(ic: number): boolean {
  return DISSONANT_INTERVALS.has(ic % 12);
}

// Snap any pitch to the nearest in-scale pitch within [min, max].
export function snapToScale(pitch: number, pcs: number[], min: number, max: number): number {
  const lo = Math.max(min, 0);
  const hi = Math.min(max, 127);
  let best = Math.min(Math.max(pitch, lo), hi);
  let bestDist = Infinity;
  for (let p = lo; p <= hi; p++) {
    if (isInScale(p, pcs)) {
      const d = Math.abs(p - pitch);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
  }
  return best;
}
