// PSY ANTHEM - tests/harmony/extended-chords.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve, chordTones } from '../../src/index';
import type { AnthemConfig, ChordSymbol } from '../../src/types';

function chord(root: number, quality: ChordSymbol['quality']): ChordSymbol {
  return { root, quality, extensions: [], startBar: 0, durationBars: 1 };
}

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

describe('Extended chord tones', () => {
  it('major9 includes the 9th', () => {
    const tones = chordTones(chord(0, 'major9'));
    expect(tones).toContain(2);  // 9th = D in Cmaj9
    expect(tones).toContain(11); // major 7th
  });

  it('dominant13 includes b7 and 13th', () => {
    const tones = chordTones(chord(0, 'dominant13'));
    expect(tones).toContain(10); // b7
    expect(tones).toContain(9);  // 13th = A in C13
  });

  it('minor11 includes the 11th', () => {
    const tones = chordTones(chord(0, 'minor11'));
    expect(tones).toContain(5);  // 11th = F in Cm11
    expect(tones).toContain(3);  // minor 3rd
  });

  it('minor9 carries b7 + 9th', () => {
    const tones = chordTones(chord(0, 'minor9'));
    expect(tones).toContain(10);
    expect(tones).toContain(2);
  });

  it('transposes correctly (D major9 keeps its color)', () => {
    const tones = chordTones(chord(2, 'major9'));
    expect(tones).toContain(2);  // root D
    expect(tones).toContain(4);  // 9th = E
  });
});

describe('Extended chords in generation', () => {
  it('complex bank produces 9/11/13 chords across a seed scan', () => {
    let foundExtended = false;
    for (let seed = 1; seed <= 40; seed++) {
      const out = createAnthemEngine({ ...base, harmonyComplexity: 'complex', seed }).generate()!;
      const hasExtended = out.harmonicAnalysis.chords.some((c) =>
        c.quality.includes('9') || c.quality.includes('11') || c.quality.includes('13'),
      );
      if (hasExtended) { foundExtended = true; break; }
    }
    expect(foundExtended).toBe(true);
  });

  it('simple bank never produces extended chords', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const out = createAnthemEngine({ ...base, harmonyComplexity: 'simple', seed }).generate()!;
      for (const c of out.harmonicAnalysis.chords) {
        expect(c.quality.includes('9')).toBe(false);
        expect(c.quality.includes('11')).toBe(false);
        expect(c.quality.includes('13')).toBe(false);
      }
    }
  });
});
