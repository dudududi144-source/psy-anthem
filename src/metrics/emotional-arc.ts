// PSY ANTHEM - metrics/emotional-arc.ts
// Does the generated tension curve deliver the intended emotional journey? (0-100)
import { EnergyCurve } from '../types';
import type { AnthemConfig, AnthemOutput } from '../types';
import { sampleEnergyCurve } from '../harmony/tension';

export interface EmotionalArcReport {
  score: number;
  arcShapeMatch: number;   // 0-1 correlation vs intended curve
  buildRelease: number;    // 0-1 presence of rise and fall
  peakPlacement: number;   // 0-1 peak at the intended position
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// Pearson correlation; returns 0 when undefined.
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i]!;
    mb += b[i]!;
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  if (den < 1e-9) return 0;
  return num / den;
}

function expectedPeakPosition(curve: EnergyCurve): number | null {
  if (curve === EnergyCurve.ARC) return 0.5;
  // BUILD_DROP: peak is detected at the first plateau point (t = 0.75)
  if (curve === EnergyCurve.BUILD_DROP) return 0.75;
  return null; // FLAT / WAVE / CUSTOM: no single expected peak
}

export function analyzeEmotionalArc(output: AnthemOutput, config: AnthemConfig): EmotionalArcReport {
  const tension = output.harmonicAnalysis.tensionCurve;
  const bars = tension.length;

  // Target curve sampled at the same bar positions
  const target: number[] = [];
  for (let b = 0; b < bars; b++) {
    const t = bars <= 1 ? 0 : b / (bars - 1);
    target.push(sampleEnergyCurve(config.energyCurve, t, config.customCurve));
  }

  const match = clamp01(pearson(tension, target));

  // Build/release: compare quarter means
  const q = Math.max(1, Math.floor(bars / 4));
  const mean = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length);
  const first = mean(tension.slice(0, q));
  const middle = mean(tension.slice(q, bars - q));
  const last = mean(tension.slice(bars - q));
  let buildRelease = 0;
  if (middle > first + 0.05) buildRelease += 0.5;
  if (middle > last + 0.05) buildRelease += 0.5;

  // Peak placement
  let peakPlacement = 1;
  const expected = expectedPeakPosition(config.energyCurve);
  if (expected !== null && bars > 0) {
    let peakBar = 0;
    for (let b = 1; b < bars; b++) {
      if (tension[b]! > tension[peakBar]!) peakBar = b;
    }
    const actual = bars <= 1 ? 0 : peakBar / (bars - 1);
    const dist = Math.abs(actual - expected);
    if (dist <= 0.1) peakPlacement = 1;
    else if (dist >= 0.3) peakPlacement = 0;
    else peakPlacement = 1 - (dist - 0.1) / 0.2;
  }

  const score = Math.round(50 * match + 30 * buildRelease + 20 * peakPlacement);
  return { score, arcShapeMatch: match, buildRelease, peakPlacement };
}
