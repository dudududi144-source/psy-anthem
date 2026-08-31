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
