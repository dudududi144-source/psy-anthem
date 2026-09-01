// PSY ANTHEM - src/melody/generative.ts
// Generative melody algorithms (phase 9). Pure + deterministic via injected RNG.

import type { RNG } from '../rng';

/**
 * Fractal melody via midpoint displacement.
 * Self-similar contour: each level subdivides every segment and displaces
 * the midpoint with a jitter that halves per level.
 * Returns 2^depth + 1 integer MIDI notes.
 */
export function generateFractalMelody(
  rng: RNG,
  depth: number,
  start = 60,
  end = 72,
  range = 12,
): number[] {
  let points: number[] = [start, end];
  for (let level = 0; level < Math.max(0, Math.floor(depth)); level++) {
    const next: number[] = [points[0]!];
    const scale = range / Math.pow(2, level + 1);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const mid = (a + b) / 2 + (rng.next() - 0.5) * 2 * scale;
      next.push(mid, b);
    }
    points = next;
  }
  return points.map((p) => Math.round(p));
}

/**
 * Chaos melody via the logistic map (r = 3.9, chaotic regime).
 * x_{n+1} = r * x * (1 - x), mapped into [low, low + span).
 */
export function generateChaosMelody(
  rng: RNG,
  length: number,
  low = 60,
  span = 24,
): number[] {
  let x = 0.1 + rng.next() * 0.8; // seed the map inside (0,1)
  const r = 3.9;
  const melody: number[] = [];
  for (let i = 0; i < Math.max(0, Math.floor(length)); i++) {
    x = r * x * (1 - x);
    melody.push(Math.floor(low + x * span));
  }
  return melody;
}
