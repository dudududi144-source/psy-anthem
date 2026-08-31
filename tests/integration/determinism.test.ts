// PSY ANTHEM - tests/integration/determinism.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine } from '../../src/index';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig, AnthemOutput } from '../../src/types';

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

// Timing is volatile by design; everything else must be byte-identical.
function stable(out: AnthemOutput): string {
  const meta = { ...out.metadata, generationTimeMs: 0 };
  return JSON.stringify({
    events: out.events,
    harmonicAnalysis: out.harmonicAnalysis,
    motifDNA: out.motifDNA,
    metadata: meta,
  });
}

describe('Determinism', () => {
  it('same seed produces identical output across 100 runs', () => {
    const first = stable(createAnthemEngine(base).generate()!);
    for (let i = 0; i < 100; i++) {
      const again = stable(createAnthemEngine(base).generate()!);
      expect(again).toBe(first);
    }
  });

  it('different seeds produce different events', () => {
    const a = createAnthemEngine({ ...base, seed: 42 }).generate()!;
    const b = createAnthemEngine({ ...base, seed: 43 }).generate()!;
    expect(JSON.stringify(a.events)).not.toBe(JSON.stringify(b.events));
  });

  it('same seed different intent produces different output', () => {
    const a = createAnthemEngine({ ...base, seed: 42 }).generate()!;
    const b = createAnthemEngine({ ...base, seed: 42, intent: AnthemIntent.DARK_PSY }).generate()!;
    expect(JSON.stringify(a.events)).not.toBe(JSON.stringify(b.events));
  });

  it('same seed different scale produces different output', () => {
    const a = createAnthemEngine({ ...base, seed: 42 }).generate()!;
    const b = createAnthemEngine({ ...base, seed: 42, scale: { root: 2, mode: 'minor' } }).generate()!;
    expect(JSON.stringify(a.events)).not.toBe(JSON.stringify(b.events));
  });

  it('edge seeds work', () => {
    for (const seed of [0, -42, 2147483647]) {
      const out = createAnthemEngine({ ...base, seed }).generate();
      expect(out).not.toBeNull();
    }
  });

  it('min/max bars and voices are deterministic', () => {
    const variants: AnthemConfig[] = [
      { ...base, bars: 8 },
      { ...base, bars: 64 },
      { ...base, voices: 1 },
      { ...base, voices: 4 },
    ];
    for (const cfg of variants) {
      const a = stable(createAnthemEngine(cfg).generate()!);
      const b = stable(createAnthemEngine(cfg).generate()!);
      expect(a).toBe(b);
    }
  });
});
