// PSY ANTHEM - tests/validation/melodic-analysis.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig, MusicalEvent } from '../../src/types';
import { analyzeMelody, classifyContour, analyzeLeaps } from '../../src/validation';

const config: AnthemConfig = {
  seed: 42, intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' }, energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 }, voices: 3, bars: 16, bpm: 140,
};

function note(pitch: number, timestamp: number, duration: number = 0.5): MusicalEvent {
  return { type: 'note', timestamp, duration, channel: 0, data: { pitch, velocity: 90 } };
}

describe('classifyContour', () => {
  it('detects ascent', () => {
    const shape = classifyContour([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(shape.shape).toBe('ascent');
  });
  it('detects descent', () => {
    const shape = classifyContour([72, 71, 69, 67, 65, 64, 62, 60]);
    expect(shape.shape).toBe('descent');
  });
  it('detects arch', () => {
    const shape = classifyContour([60, 62, 64, 67, 69, 67, 64, 62, 60]);
    expect(shape.shape).toBe('arch');
  });
  it('detects wave', () => {
    const shape = classifyContour([60, 67, 60, 67, 60, 67, 60]);
    expect(shape.shape).toBe('wave');
  });
  it('detects plateau', () => {
    const shape = classifyContour([64, 64, 64, 64, 64, 64]);
    expect(shape.shape).toBe('plateau');
  });
});

describe('analyzeLeaps', () => {
  it('counts recovered leaps', () => {
    // leap up 12, then step down -> recovered
    const r = analyzeLeaps([60, 72, 70]);
    expect(r.count).toBe(1);
    expect(r.recovered).toBe(1);
    expect(r.unrecovered).toBe(0);
  });
  it('counts unrecovered leaps', () => {
    // leap up 12, keeps going up -> unrecovered
    const r = analyzeLeaps([60, 72, 74, 76]);
    expect(r.count).toBe(1);
    expect(r.unrecovered).toBe(1);
  });
  it('ignores small intervals', () => {
    const r = analyzeLeaps([60, 62, 64, 67]);
    expect(r.count).toBe(0);
  });
});

describe('analyzeMelody on real output', () => {
  it('detects a contour and reports motif presence', () => {
    const out = createAnthemEngine(config).generate()!;
    const analysis = analyzeMelody(out.events, {
      motifNotes: out.motifDNA.coreNotes,
      targetRange: config.targetRange,
    });
    expect(analysis.contourClarity).toBeGreaterThanOrEqual(0);
    expect(analysis.contourClarity).toBeLessThanOrEqual(1);
    expect(analysis.stepwiseRatio).toBeGreaterThan(0);
    expect(analysis.motifPresence).toBeGreaterThan(0);
    expect(Array.isArray(analysis.issues)).toBe(true);
  });

  it('handles empty input gracefully', () => {
    const analysis = analyzeMelody([]);
    expect(analysis.contour).toBe('irregular');
    expect(analysis.issues.length).toBeGreaterThan(0);
  });
});
