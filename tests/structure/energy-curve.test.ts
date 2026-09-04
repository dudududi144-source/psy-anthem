// PSY ANTHEM - tests/structure/energy-curve.test.ts
import { describe, it, expect } from 'bun:test';
import { barEnergy } from '../../src/structure/energy-curve';
import { getMacroForm } from '../../src/structure/macro-form';
import { planSections } from '../../src/structure/section-planner';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig } from '../../src/types';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.PROGRESSIVE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
};

describe('barEnergy', () => {
  it('ARC peaks mid-piece', () => {
    const start = barEnergy(0, base);
    const mid = barEnergy(16, base);
    const end = barEnergy(31, base);
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeGreaterThan(end);
  });

  it('all curves return values in [0,1] across the whole piece', () => {
    const curves = [
      EnergyCurve.FLAT, EnergyCurve.ARC, EnergyCurve.BUILD_DROP, EnergyCurve.WAVE,
      EnergyCurve.EMOTIONAL_SWELL, EnergyCurve.DOUBLE_DROP,
      EnergyCurve.PROGRESSIVE_CLIMB, EnergyCurve.SUNRISE, EnergyCurve.PLATEAU_BREAK,
    ];
    for (const curve of curves) {
      for (let bar = 0; bar < 32; bar++) {
        const e = barEnergy(bar, { ...base, energyCurve: curve });
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
    }
  });

  it('EMOTIONAL_SWELL swells late then lifts at the end', () => {
    const swellMid = barEnergy(20, { ...base, energyCurve: EnergyCurve.EMOTIONAL_SWELL });
    const swellEnd = barEnergy(31, { ...base, energyCurve: EnergyCurve.EMOTIONAL_SWELL });
    const swellStart = barEnergy(0, { ...base, energyCurve: EnergyCurve.EMOTIONAL_SWELL });
    expect(swellMid).toBeGreaterThan(swellStart);
    expect(swellEnd).toBeGreaterThan(swellStart);
  });

  it('DOUBLE_DROP has two high peaks', () => {
    const cfg = { ...base, energyCurve: EnergyCurve.DOUBLE_DROP };
    const drop1 = barEnergy(14, cfg);
    const drop2 = barEnergy(28, cfg);
    const valley = barEnergy(17, cfg);
    expect(drop1).toBeGreaterThan(0.7);
    expect(drop2).toBeGreaterThan(0.7);
    expect(valley).toBeLessThan(drop1);
  });

  it('SUNRISE and PROGRESSIVE_CLIMB rise toward the end', () => {
    for (const curve of [EnergyCurve.SUNRISE, EnergyCurve.PROGRESSIVE_CLIMB]) {
      const start = barEnergy(0, { ...base, energyCurve: curve });
      const end = barEnergy(31, { ...base, energyCurve: curve });
      expect(end).toBeGreaterThan(start);
    }
  });
});

describe('getMacroForm', () => {
  it('fractions sum to 1', () => {
    for (const curve of [EnergyCurve.ARC, EnergyCurve.BUILD_DROP, EnergyCurve.WAVE, EnergyCurve.FLAT]) {
      const form = getMacroForm(curve);
      const sum = form.reduce((s, f) => s + f.fraction, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});

describe('planSections', () => {
  it('covers all bars exactly once', () => {
    const plans = planSections(base);
    let covered = 0;
    let prevEnd = 0;
    for (const p of plans) {
      expect(p.startBar).toBe(prevEnd);
      covered += p.bars;
      prevEnd = p.startBar + p.bars;
    }
    expect(covered).toBe(base.bars);
  });

  it('all sections have valid budgets', () => {
    const plans = planSections(base);
    for (const p of plans) {
      expect(p.bars).toBeGreaterThan(0);
      expect(p.harmonicRhythm).toBeGreaterThanOrEqual(1);
      expect(p.densityTarget).toBeGreaterThanOrEqual(0);
      expect(p.densityTarget).toBeLessThanOrEqual(1);
    }
  });
});
