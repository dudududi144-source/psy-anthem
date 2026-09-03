// PSY ANTHEM - tests/validation/config-schema.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, parseConfig, safeParseConfig } from '../../src/index';
import { AnthemIntent, EnergyCurve } from '../../src/types';

const base = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

describe('config-schema: safeParseConfig', () => {
  it('accepts a valid config and returns a defensive copy', () => {
    const r = safeParseConfig(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.seed).toBe(42);
      expect(r.data).not.toBe(base);
      expect(r.data.bars).toBe(16);
    }
  });

  it('accepts negative seeds (established engine contract)', () => {
    for (const seed of [0, -42, 2147483647, -2147483648]) {
      expect(safeParseConfig({ ...base, seed }).success).toBe(true);
    }
  });

  it('rejects non-object inputs', () => {
    for (const bad of [null, undefined, 'x', 5, true, [1, 2]]) {
      const r = safeParseConfig(bad);
      expect(r.success).toBe(false);
    }
  });

  it('reports pathed issues for wrong types and enums', () => {
    const r = safeParseConfig({ ...base, seed: 'nope', intent: 'not-a-genre' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path);
      expect(paths).toContain('seed');
      expect(paths).toContain('intent');
      expect(r.error.message.length).toBeGreaterThan(0);
    }
  });

  it('reports nested paths for scale problems', () => {
    const r = safeParseConfig({ ...base, scale: { root: 99, mode: 'xeno' } });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path);
      expect(paths).toContain('scale.root');
      expect(paths).toContain('scale.mode');
    }
  });

  it('accepts all documented optional fields', () => {
    const r = safeParseConfig({
      ...base,
      chromaticTension: 0.2,
      density: 'dense',
      harmonyComplexity: 'complex',
      loopMode: true,
      callResponse: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects malformed optional fields', () => {
    expect(safeParseConfig({ ...base, density: 'wall' }).success).toBe(false);
    expect(safeParseConfig({ ...base, loopMode: 'yes' }).success).toBe(false);
    expect(safeParseConfig({ ...base, bpm: 'fast' }).success).toBe(false);
    expect(safeParseConfig({ ...base, bpm: 5000 }).success).toBe(false);
  });

  it('validates customCurve points when provided', () => {
    const bad = safeParseConfig({
      ...base,
      energyCurve: EnergyCurve.CUSTOM,
      customCurve: [{ position: 2, energy: 0.5 }],
    });
    expect(bad.success).toBe(false);
    const good = safeParseConfig({
      ...base,
      energyCurve: EnergyCurve.CUSTOM,
      customCurve: [{ position: 0, energy: 0.2 }, { position: 1, energy: 0.9 }],
    });
    expect(good.success).toBe(true);
  });
});

describe('config-schema: parseConfig error classes', () => {
  it('throws RangeError for pure range violations', () => {
    expect(() => parseConfig({ ...base, bars: 4 })).toThrow(RangeError);
    expect(() => parseConfig({ ...base, bars: 200 })).toThrow(RangeError);
    expect(() => parseConfig({ ...base, voices: 0 })).toThrow(RangeError);
    expect(() => parseConfig({ ...base, scale: { root: 15, mode: 'minor' } })).toThrow(RangeError);
    expect(() => parseConfig({ ...base, targetRange: { min: 90, max: 60 } })).toThrow(RangeError);
    expect(() => parseConfig({ ...base, seed: 2147483648 })).toThrow(RangeError);
  });

  it('throws TypeError for type / shape / enum / refine violations', () => {
    expect(() => parseConfig({ ...base, seed: 'abc' })).toThrow(TypeError);
    expect(() => parseConfig({ ...base, seed: 3.5 })).toThrow(TypeError);
    expect(() => parseConfig({ ...base, intent: 'nope' })).toThrow(TypeError);
    expect(() => parseConfig(null)).toThrow(TypeError);
    expect(() => parseConfig({ ...base, scale: 'minor' })).toThrow(TypeError);
    expect(() => parseConfig({ ...base, energyCurve: EnergyCurve.CUSTOM, customCurve: undefined })).toThrow(TypeError);
  });

  it('messages name the offending field', () => {
    let caught: Error | null = null;
    try {
      parseConfig({ ...base, bars: 4 });
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(String(caught!.message)).toContain('bars');
  });

  it('generation stays deterministic through validation', () => {
    const a = createAnthemEngine(parseConfig(base)).generate();
    const b = createAnthemEngine(parseConfig(base)).generate();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(JSON.stringify(a!.events)).toBe(JSON.stringify(b!.events));
    expect(a!.metadata.seed).toBe(42);
  });
});
