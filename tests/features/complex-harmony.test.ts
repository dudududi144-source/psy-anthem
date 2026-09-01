// PSY ANTHEM - tests/features/complex-harmony.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig, ChordQuality } from '../../src/types';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.PROGRESSIVE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

function generateWith(complexity: 'simple' | 'standard' | 'complex', seed: number) {
  return createAnthemEngine({ ...base, harmonyComplexity: complexity, seed }).generate()!;
}

describe('Harmony complexity levels', () => {
  it('complex bank produces 7th chords across a seed scan', () => {
    let foundSeventh = false;
    for (let seed = 1; seed <= 30; seed++) {
      const out = generateWith('complex', seed);
      const has7 = out.harmonicAnalysis.chords.some((c) => c.quality.includes('7'));
      if (has7) { foundSeventh = true; break; }
    }
    expect(foundSeventh).toBe(true);
  });

  it('extended qualities appear (major7/minor7/dom7)', () => {
    const qualities = new Set<ChordQuality>();
    for (let seed = 1; seed <= 30; seed++) {
      const out = generateWith('complex', seed);
      for (const c of out.harmonicAnalysis.chords) qualities.add(c.quality);
    }
    const sevenths = [...qualities].filter((q) => q.includes('7'));
    expect(sevenths.length).toBeGreaterThanOrEqual(2);
  });

  it('simple stays on primary functions (triads only)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const out = generateWith('simple', seed);
      for (const c of out.harmonicAnalysis.chords) {
        expect(c.quality.includes('7')).toBe(false);
      }
    }
  });

  it('complex variety is >= simple variety (seed scan)', () => {
    let simpleDistinct = 0;
    let complexDistinct = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = generateWith('simple', seed);
      const c = generateWith('complex', seed);
      simpleDistinct += new Set(s.harmonicAnalysis.chords.map((x) => x.root + ':' + x.quality)).size;
      complexDistinct += new Set(c.harmonicAnalysis.chords.map((x) => x.root + ':' + x.quality)).size;
    }
    expect(complexDistinct).toBeGreaterThanOrEqual(simpleDistinct);
  });

  it('all levels remain valid and deterministic', () => {
    for (const level of ['simple', 'standard', 'complex'] as const) {
      const a = generateWith(level, 7);
      const b = generateWith(level, 7);
      expect(a.events.length).toBeGreaterThan(0);
      expect(JSON.stringify(a.harmonicAnalysis.chords)).toBe(JSON.stringify(b.harmonicAnalysis.chords));
    }
  });
});
