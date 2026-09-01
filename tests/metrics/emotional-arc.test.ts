// PSY ANTHEM - tests/metrics/emotional-arc.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';
import { analyzeEmotionalArc, pearson } from '../../src/metrics';

const base: AnthemConfig = {
  seed: 42, intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' }, energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 }, voices: 3, bars: 32, bpm: 140,
};

describe('pearson', () => {
  it('perfect positive correlation -> 1', () => {
    expect(pearson([0, 1, 2, 3], [0, 2, 4, 6])).toBeCloseTo(1, 5);
  });
  it('perfect negative correlation -> -1', () => {
    expect(pearson([0, 1, 2, 3], [6, 4, 2, 0])).toBeCloseTo(-1, 5);
  });
  it('constant series -> 0 (no crash)', () => {
    expect(pearson([1, 1, 1], [0, 1, 2])).toBe(0);
  });
});

describe('analyzeEmotionalArc', () => {
  it('ARC output matches its intended curve with peak mid-piece', () => {
    const out = createAnthemEngine(base).generate()!;
    const arc = analyzeEmotionalArc(out, base);
    expect(arc.arcShapeMatch).toBeGreaterThan(0.95);
    expect(arc.peakPlacement).toBe(1);
    expect(arc.buildRelease).toBe(1);
    expect(arc.score).toBeGreaterThanOrEqual(90);
  });

  it('FLAT output has no build/release but full peak placement (not applicable)', () => {
    const cfg: AnthemConfig = { ...base, energyCurve: EnergyCurve.FLAT };
    const out = createAnthemEngine(cfg).generate()!;
    const arc = analyzeEmotionalArc(out, cfg);
    expect(arc.buildRelease).toBe(0);
    expect(arc.peakPlacement).toBe(1);
  });

  it('BUILD_DROP peaks late', () => {
    const cfg: AnthemConfig = { ...base, energyCurve: EnergyCurve.BUILD_DROP };
    const out = createAnthemEngine(cfg).generate()!;
    const arc = analyzeEmotionalArc(out, cfg);
    expect(arc.arcShapeMatch).toBeGreaterThan(0.9);
    expect(arc.peakPlacement).toBe(1);
  });

  it('is deterministic', () => {
    const a = analyzeEmotionalArc(createAnthemEngine(base).generate()!, base);
    const b = analyzeEmotionalArc(createAnthemEngine(base).generate()!, base);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
