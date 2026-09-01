// PSY ANTHEM - tests/validation/advanced-theory.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig, MusicalEvent } from '../../src/types';
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
  it('reports bounded scores with healthy balance on real output', () => {
    const out = createAnthemEngine(config).generate()!;
    const vl = analyzeVoiceLeadingFromEvents(out.events, config.voices);
    // Psytrance leads are leap-heavy (P4-octave motif pools), so smoothness
    // is calibrated relatively - see the ranking test below.
    expect(vl.smoothness).toBeGreaterThanOrEqual(0);
    expect(vl.smoothness).toBeLessThanOrEqual(100);
    expect(vl.independence).toBeGreaterThanOrEqual(0);
    expect(vl.independence).toBeLessThanOrEqual(100);
    expect(vl.balance).toBeGreaterThan(40);
    expect(vl.contraryMotion).toBeGreaterThanOrEqual(0);
  });

  it('ranks stepwise textures smoother than real engine output', () => {
    const out = createAnthemEngine(config).generate()!;
    const stepwise: MusicalEvent[] = [];
    for (let v = 0; v < 2; v++) {
      for (let i = 0; i < 16; i++) {
        stepwise.push({ type: 'note', timestamp: i * 0.5, duration: 0.5, channel: v, data: { pitch: 60 + v * 10 + (i % 4), velocity: 90 } });
      }
    }
    const smoothVl = analyzeVoiceLeadingFromEvents(stepwise, 2);
    const engineVl = analyzeVoiceLeadingFromEvents(out.events, config.voices);
    expect(smoothVl.smoothness).toBeGreaterThan(engineVl.smoothness);
  });

  it('handles single-voice input', () => {
    const out = createAnthemEngine({ ...config, voices: 1 }).generate()!;
    const vl = analyzeVoiceLeadingFromEvents(out.events, 1);
    expect(vl.balance).toBe(100);
    expect(vl.independence).toBe(100);
  });
});
