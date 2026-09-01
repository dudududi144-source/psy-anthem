// PSY ANTHEM - tests/features/emotional-lead.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';
import { analyzeMelody } from '../../src/validation';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 24,
  bpm: 140,
};

describe('EMOTIONAL_LEAD intent', () => {
  it('exists in the intent list', () => {
    expect(Object.values(AnthemIntent)).toContain(AnthemIntent.EMOTIONAL_LEAD);
  });

  it('generates a valid anthem', () => {
    const out = createAnthemEngine({ ...base, intent: AnthemIntent.EMOTIONAL_LEAD }).generate();
    expect(out).not.toBeNull();
    expect(out!.events.length).toBeGreaterThan(0);
    expect(out!.metadata.intent).toBe(AnthemIntent.EMOTIONAL_LEAD);
  });

  it('produces a singable (step-friendly) lead', () => {
    const out = createAnthemEngine({ ...base, intent: AnthemIntent.EMOTIONAL_LEAD }).generate()!;
    const mel = analyzeMelody(out.events, { motifNotes: out.motifDNA.coreNotes, targetRange: base.targetRange });
    // Step-friendly pool (M2, m3, M3, P4, P5) + engine smoothing -> mostly steps.
    expect(mel.stepwiseRatio).toBeGreaterThan(0.5);
    expect(mel.leaps.unrecovered).toBeLessThanOrEqual(2);
  });

  it('all 7 intents still generate', () => {
    for (const intent of Object.values(AnthemIntent)) {
      const out = createAnthemEngine({ ...base, intent }).generate();
      expect(out).not.toBeNull();
    }
  });
});
