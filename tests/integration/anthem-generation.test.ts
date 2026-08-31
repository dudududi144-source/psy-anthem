// PSY ANTHEM - tests/integration/anthem-generation.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine } from '../../src/index';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig } from '../../src/types';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

describe('Full Anthem Generation', () => {
  it('generates a non-empty valid anthem', () => {
    const engine = createAnthemEngine(base);
    const out = engine.generate();
    expect(out).not.toBeNull();
    expect(out!.events.length).toBeGreaterThan(0);
    expect(out!.harmonicAnalysis.chords.length).toBeGreaterThan(0);
    expect(out!.motifDNA.coreNotes.length).toBeGreaterThanOrEqual(3);
    expect(out!.metadata.memorabilityScore).toBeGreaterThan(0);
    expect(out!.harmonicAnalysis.tensionCurve.length).toBe(base.bars);
  });

  it('rejects invalid configs', () => {
    expect(() => createAnthemEngine({ ...base, bars: 4 })).toThrow(RangeError);
    expect(() => createAnthemEngine({ ...base, bars: 200 })).toThrow(RangeError);
    expect(() => createAnthemEngine({ ...base, voices: 0 })).toThrow(RangeError);
    expect(() => createAnthemEngine({ ...base, voices: 5 })).toThrow(RangeError);
    expect(() => createAnthemEngine({ ...base, energyCurve: EnergyCurve.CUSTOM, customCurve: undefined })).toThrow(TypeError);
    expect(() => createAnthemEngine({ ...base, targetRange: { min: 90, max: 60 } })).toThrow(RangeError);
    expect(() => createAnthemEngine({ ...base, scale: { root: 15, mode: 'minor' } })).toThrow(RangeError);
  });

  it('works across all intents', () => {
    for (const intent of Object.values(AnthemIntent)) {
      const out = createAnthemEngine({ ...base, intent }).generate();
      expect(out).not.toBeNull();
      expect(out!.events.length).toBeGreaterThan(0);
    }
  });

  it('works across all standard curves', () => {
    for (const curve of [EnergyCurve.ARC, EnergyCurve.BUILD_DROP, EnergyCurve.WAVE, EnergyCurve.FLAT]) {
      const out = createAnthemEngine({ ...base, energyCurve: curve }).generate();
      expect(out).not.toBeNull();
    }
  });

  it('CUSTOM curve with points works', () => {
    const cfg: AnthemConfig = {
      ...base,
      energyCurve: EnergyCurve.CUSTOM,
      customCurve: [
        { position: 0, energy: 0.2 },
        { position: 0.5, energy: 1 },
        { position: 1, energy: 0.3 },
      ],
    };
    const out = createAnthemEngine(cfg).generate();
    expect(out).not.toBeNull();
  });

  it('all events are valid', () => {
    const out = createAnthemEngine(base).generate()!;
    for (const e of out.events) {
      expect(e.type).toBe('note');
      expect(e.timestamp).toBeGreaterThanOrEqual(0);
      expect(e.duration).toBeGreaterThan(0);
      const d = e.data as { pitch: number; velocity: number };
      expect(d.pitch).toBeGreaterThanOrEqual(base.targetRange.min);
      expect(d.pitch).toBeLessThanOrEqual(base.targetRange.max);
      expect(d.velocity).toBeGreaterThanOrEqual(0);
      expect(d.velocity).toBeLessThanOrEqual(127);
    }
  });
});
