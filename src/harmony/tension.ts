// PSY ANTHEM - harmony/tension.ts
import { INTENT_TENSION_WEIGHTS } from '../constants';
import { EnergyCurve } from '../types';
import type { AnthemConfig, BarTension, CustomCurvePoint } from '../types';

export function sampleEnergyCurve(
  curve: EnergyCurve,
  t: number,
  customCurve?: CustomCurvePoint[],
): number {
  const x = Math.min(1, Math.max(0, t));
  switch (curve) {
    case EnergyCurve.FLAT:
      return 0.5;
    case EnergyCurve.ARC:
      return Math.sin(x * Math.PI);
    case EnergyCurve.BUILD_DROP: {
      if (x < 0.75) {
        const f = x / 0.75;
        return f * f;
      }
      return 1;
    }
    case EnergyCurve.WAVE:
      return 0.5 + 0.5 * Math.sin(x * Math.PI * 4);
    case EnergyCurve.EMOTIONAL_SWELL: {
      if (x < 0.65) return 0.25 + 0.65 * Math.pow(x / 0.65, 1.4);
      if (x < 0.78) {
        const f = (x - 0.65) / 0.13;
        return 0.9 - 0.35 * Math.sin(f * Math.PI);
      }
      return 0.75 + 0.25 * ((x - 0.78) / 0.22);
    }
    case EnergyCurve.DOUBLE_DROP: {
      if (x < 0.35) {
        const f = x / 0.35;
        return 0.2 + 0.7 * f * f;
      }
      if (x < 0.45) return 0.9;
      if (x < 0.55) return 0.9 - 0.45 * ((x - 0.45) / 0.10);
      if (x < 0.80) {
        const f = (x - 0.55) / 0.25;
        return 0.45 + 0.55 * f * f;
      }
      return 1;
    }
    case EnergyCurve.PROGRESSIVE_CLIMB: {
      const stepped = Math.floor(x * 8) / 8;
      return 0.15 + 0.85 * (0.7 * Math.pow(x, 1.2) + 0.3 * stepped);
    }
    case EnergyCurve.SUNRISE:
      return 0.1 + 0.9 * Math.pow(x, 2.2);
    case EnergyCurve.PLATEAU_BREAK: {
      if (x < 0.35) return 0.5 + 0.3 * (x / 0.35);
      if (x < 0.45) return 0.8;
      if (x < 0.62) {
        const f = (x - 0.45) / 0.17;
        return 0.8 - 0.5 * Math.sin(f * Math.PI);
      }
      return 0.8 + 0.2 * ((x - 0.62) / 0.38);
    }
    case EnergyCurve.CUSTOM: {
      const pts = (customCurve ?? []).slice().sort((a, b) => a.position - b.position);
      if (pts.length === 0) return 0.5;
      const first = pts[0]!;
      const last = pts[pts.length - 1]!;
      if (x <= first.position) return first.energy;
      if (x >= last.position) return last.energy;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        if (x >= a.position && x <= b.position) {
          const span = Math.max(1e-9, b.position - a.position);
          const f = (x - a.position) / span;
          return a.energy + f * (b.energy - a.energy);
        }
      }
      return last.energy;
    }
  }
}

export function barEnergy(bar: number, config: AnthemConfig): number {
  if (config.bars <= 1) return sampleEnergyCurve(config.energyCurve, 0, config.customCurve);
  const t = bar / (config.bars - 1);
  return sampleEnergyCurve(config.energyCurve, t, config.customCurve);
}

export function compositeTension(bar: number, config: AnthemConfig, extras?: Partial<BarTension>): number {
  const e = barEnergy(bar, config);
  const weights = INTENT_TENSION_WEIGHTS[config.intent];
  const harmonic = extras && extras.harmonic !== undefined ? extras.harmonic : e;
  const rhythmic = extras && extras.rhythmic !== undefined ? extras.rhythmic : e;
  const register = extras && extras.register !== undefined ? extras.register : e;
  const dynamic = extras && extras.dynamic !== undefined ? extras.dynamic : e;
  const density = extras && extras.density !== undefined ? extras.density : e;
  const v = harmonic * weights.harmonic + rhythmic * weights.rhythmic +
    register * weights.register + dynamic * weights.dynamic + density * weights.density;
  return Math.min(1, Math.max(0, v));
}
