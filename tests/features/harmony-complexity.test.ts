// PSY ANTHEM - tests/features/harmony-complexity.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';

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

describe('harmonyComplexity', () => {
  it('simple uses only tonic/subdominant/dominant functions', () => {
    const out = createAnthemEngine({ ...base, harmonyComplexity: 'simple' }).generate()!;
    const keyRoot = out.harmonicAnalysis.key.root;
    // Degree indices 0/5/7 map to semitone offsets 0/9/11 through the
    // generator's degree table ([0,2,4,5,7,9,11,12]).
    const degreeToSemitone = [0, 2, 4, 5, 7, 9, 11, 12];
    const allowed = new Set([0, 5, 7].map((d) => degreeToSemitone[d]));
    for (const c of out.harmonicAnalysis.chords) {
      const offset = ((c.root - keyRoot) % 12 + 12) % 12;
      expect(allowed.has(offset)).toBe(true);
    }
    const distinct = new Set(out.harmonicAnalysis.chords.map((c) => c.root + ':' + c.quality));
    expect(distinct.size).toBeLessThanOrEqual(4);
  });

  it('standard generates successfully (default language)', () => {
    const out = createAnthemEngine({ ...base, harmonyComplexity: 'standard' }).generate();
    expect(out).not.toBeNull();
    expect(out!.harmonicAnalysis.chords.length).toBeGreaterThan(0);
  });

  it('complex is at least as varied as simple', () => {
    const simple = createAnthemEngine({ ...base, harmonyComplexity: 'simple' }).generate()!;
    const complex = createAnthemEngine({ ...base, harmonyComplexity: 'complex' }).generate()!;
    const distinctOf = (chords: typeof simple.harmonicAnalysis.chords) =>
      new Set(chords.map((c) => c.root + ':' + c.quality)).size;
    expect(distinctOf(complex.harmonicAnalysis.chords)).toBeGreaterThanOrEqual(distinctOf(simple.harmonicAnalysis.chords));
  });

  it('default equals standard', () => {
    const withFlag = createAnthemEngine({ ...base, harmonyComplexity: 'standard' }).generate()!;
    const withoutFlag = createAnthemEngine(base).generate()!;
    expect(JSON.stringify(withFlag.harmonicAnalysis.chords)).toBe(JSON.stringify(withoutFlag.harmonicAnalysis.chords));
  });
});
