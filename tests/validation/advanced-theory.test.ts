// PSY ANTHEM - tests/validation/advanced-theory.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';
import { calculateAdvancedQualityScore, analyzeVoiceLeadingFromEvents } from '../../src/validation';

const config: AnthemConfig = {
  seed: 42, intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' }, energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 }, voices: 3, bars: 24, bpm: 140,
};

describe('calculateAdvancedQualityScore', () => {
  it('produces a complete bounded report', () => {
    const out = createAnthemEngine(config).generate()!;
    const report = calculateAdvancedQualityScore(out, config);

    expect(report.overall).toBeGreaterThanOrEqual(0);
    expect(report.overall).toBeLessThanOrEqual(100);
    expect(['masterpiece', 'excellent', 'good', 'acceptable', 'needs-work']).toContain(report.grade);

    const comps = report.componentScores;
    for (const key of Object.keys(comps)) {
      const v = comps[key as keyof typeof comps];
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }

    expect(report.melodic.contourClarity).toBeGreaterThanOrEqual(0);
    expect(report.harmonic.functionalScore).toBeGreaterThan(0);
    expect(report.voiceLeading.smoothness).toBeGreaterThanOrEqual(0);
    expect(report.singability.score).toBeGreaterThanOrEqual(0);
    expect(report.variety.score).toBeGreaterThanOrEqual(0);
    expect(report.emotionalArc.score).toBeGreaterThanOrEqual(0);
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    const a = calculateAdvancedQualityScore(createAnthemEngine(config).generate()!, config);
    const b = calculateAdvancedQualityScore(createAnthemEngine(config).generate()!, config);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('ARC config yields a strong emotional arc', () => {
    const out = createAnthemEngine(config).generate()!;
    const report = calculateAdvancedQualityScore(out, config);
    expect(report.emotionalArc.arcShapeMatch).toBeGreaterThan(0.9);
  });
});

describe('analyzeVoiceLeadingFromEvents', () => {
  it('scores smooth constructed voices well', () => {
    const out = createAnthemEngine(config).generate()!;
    const vl = analyzeVoiceLeadingFromEvents(out.events, config.voices);
    expect(vl.smoothness).toBeGreaterThan(50);
    expect(vl.independence).toBeGreaterThan(50);
    expect(vl.balance).toBeGreaterThan(0);
    expect(vl.contraryMotion).toBeGreaterThanOrEqual(0);
  });

  it('handles single-voice input', () => {
    const out = createAnthemEngine({ ...config, voices: 1 }).generate()!;
    const vl = analyzeVoiceLeadingFromEvents(out.events, 1);
    expect(vl.balance).toBe(100);
    expect(vl.independence).toBe(100);
  });
});
