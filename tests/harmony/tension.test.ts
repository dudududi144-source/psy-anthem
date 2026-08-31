// PSY ANTHEM - tests/harmony/tension.test.ts
import { describe, it, expect } from 'bun:test';
import { sampleEnergyCurve, barEnergy } from '../../src/harmony/tension';
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

describe('Energy Curves', () => {
  it('FLAT is constant 0.5', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(sampleEnergyCurve(EnergyCurve.FLAT, t)).toBe(0.5);
    }
  });

  it('ARC: 0 at edges, 1 at center', () => {
    expect(sampleEnergyCurve(EnergyCurve.ARC, 0)).toBeCloseTo(0, 5);
    expect(sampleEnergyCurve(EnergyCurve.ARC, 0.5)).toBeCloseTo(1, 5);
    expect(sampleEnergyCurve(EnergyCurve.ARC, 1)).toBeCloseTo(0, 5);
  });

  it('BUILD_DROP rises then sustains peak', () => {
    const early = sampleEnergyCurve(EnergyCurve.BUILD_DROP, 0.2);
    const peak = sampleEnergyCurve(EnergyCurve.BUILD_DROP, 0.9);
    expect(peak).toBeGreaterThan(early);
    expect(sampleEnergyCurve(EnergyCurve.BUILD_DROP, 1)).toBe(1);
  });

  it('WAVE oscillates', () => {
    const q1 = sampleEnergyCurve(EnergyCurve.WAVE, 0.125);
    const q3 = sampleEnergyCurve(EnergyCurve.WAVE, 0.375);
    expect(q1).toBeGreaterThan(0.9);
    expect(q3).toBeLessThan(0.1);
  });

  it('CUSTOM interpolates points', () => {
    const pts = [{ position: 0, energy: 0 }, { position: 1, energy: 1 }];
    expect(sampleEnergyCurve(EnergyCurve.CUSTOM, 0.5, pts)).toBeCloseTo(0.5, 5);
    expect(sampleEnergyCurve(EnergyCurve.CUSTOM, 0.25, pts)).toBeCloseTo(0.25, 5);
  });

  it('clamps t to [0,1]', () => {
    expect(sampleEnergyCurve(EnergyCurve.ARC, -1)).toBeCloseTo(0, 5);
    expect(sampleEnergyCurve(EnergyCurve.ARC, 2)).toBeCloseTo(0, 5);
  });
});

describe('barEnergy', () => {
  it('ARC peaks mid-piece', () => {
    const start = barEnergy(0, base);
    const mid = barEnergy(16, base);
    const end = barEnergy(31, base);
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeGreaterThan(end);
  });

  it('values stay within [0,1]', () => {
    for (let b = 0; b < base.bars; b++) {
      const e = barEnergy(b, base);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
    }
  });
});
