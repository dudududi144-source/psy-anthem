// PSY ANTHEM - tests/validation/harmonic-analysis.test.ts
import { describe, it, expect } from 'bun:test';
import type { ChordSymbol, ScaleDefinition } from '../../src/types';
import { analyzeHarmony, detectCadences } from '../../src/validation';

const keyCMajor: ScaleDefinition = { root: 0, mode: 'major' };

function chord(root: number, quality: ChordSymbol['quality'], startBar: number, durationBars: number = 1): ChordSymbol {
  return { root, quality, extensions: [], startBar, durationBars };
}

describe('detectCadences', () => {
  it('finds an authentic cadence (V -> I)', () => {
    const chords = [
      chord(0, 'major', 0),   // I
      chord(5, 'major', 1),   // IV
      chord(7, 'major', 2),   // V
      chord(0, 'major', 3),   // I (bar 3 not on 4-bar grid but final)
    ];
    const cadences = detectCadences(chords, keyCMajor);
    const authentic = cadences.filter((c) => c.type === 'authentic');
    expect(authentic.length).toBeGreaterThan(0);
  });

  it('finds a plagal cadence (IV -> I)', () => {
    const chords = [
      chord(5, 'major', 0),
      chord(0, 'major', 1),
    ];
    const cadences = detectCadences(chords, keyCMajor);
    expect(cadences.some((c) => c.type === 'plagal')).toBe(true);
  });

  it('finds a deceptive resolution (V -> vi)', () => {
    const chords = [
      chord(7, 'major', 0),   // V
      chord(9, 'minor', 1),   // vi (V + 2 semitones root relation)
    ];
    const cadences = detectCadences(chords, keyCMajor);
    expect(cadences.some((c) => c.type === 'deceptive')).toBe(true);
  });
});

describe('analyzeHarmony', () => {
  it('scores strong functional motion (circle of fifths)', () => {
    // C -> F -> G -> C : strong subdominant/dominant motion
    const chords = [
      chord(0, 'major', 0),
      chord(5, 'major', 1),
      chord(7, 'major', 2),
      chord(0, 'major', 3),
    ];
    const report = analyzeHarmony(chords, [0.2, 0.4, 0.6, 0.3], keyCMajor);
    expect(report.functionalScore).toBeGreaterThanOrEqual(70);
    expect(report.cadences.length).toBeGreaterThan(0);
  });

  it('tensionArcMatch is 1 when tension equals target', () => {
    const chords = [chord(0, 'major', 0), chord(5, 'major', 1)];
    const curve = [0.2, 0.8];
    const report = analyzeHarmony(chords, curve, keyCMajor, curve);
    expect(report.tensionArcMatch).toBeCloseTo(1, 5);
  });

  it('variety score lands in range', () => {
    const chords = [chord(0, 'major', 0), chord(5, 'major', 1), chord(7, 'major', 2)];
    const report = analyzeHarmony(chords, [0.3, 0.5, 0.4], keyCMajor);
    expect(report.varietyScore).toBeGreaterThanOrEqual(0);
    expect(report.varietyScore).toBeLessThanOrEqual(100);
  });
});
