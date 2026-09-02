// PSY ANTHEM - tests/evolution/harmonic-evolver.test.ts
import { describe, it, expect } from 'bun:test';
import { HarmonicEvolver } from '../../src/evolution/harmonic-evolver';
import type { HarmonicEvolutionConfig } from '../../src/evolution/harmonic-evolver';
import { createRNG } from '../../src/rng';
import type { ChordSymbol } from '../../src/types';

function chord(root: number, quality: ChordSymbol['quality'], startBar = 0): ChordSymbol {
  return { root, quality, extensions: [], startBar, durationBars: 4 };
}

function makeConfig(overrides: Partial<HarmonicEvolutionConfig>): HarmonicEvolutionConfig {
  return { substitutionRate: 1.0, allowedSubstitutions: ['tritone'], ...overrides };
}

describe('HarmonicEvolver', () => {
  it('creates evolver with the progression', () => {
    const progression = [chord(0, 'minor7'), chord(5, 'minor7', 4), chord(7, 'dominant7', 8)];
    const evolver = new HarmonicEvolver(progression, createRNG(42), makeConfig({ substitutionRate: 0.0 }));
    const result = evolver.getProgression();
    expect(result.length).toBe(3);
    expect(result[0]!.root).toBe(0);
  });

  it('applies tritone substitution to dominant chords (G7 -> Db)', () => {
    const evolver = new HarmonicEvolver([chord(7, 'dominant7')], createRNG(42), makeConfig({}));
    const evolved = evolver.evolve();
    expect(evolved[0]!.root).toBe(1); // tritone away from G (7) is Db (1)
    expect(evolved[0]!.quality).toBe('dominant7');
  });

  it('tritone substitution skips non-dominant chords', () => {
    const evolver = new HarmonicEvolver([chord(0, 'major')], createRNG(42), makeConfig({}));
    const evolved = evolver.evolve();
    expect(evolved[0]!.root).toBe(0); // unchanged
  });

  it('applies relative substitution (Am -> C)', () => {
    const evolver = new HarmonicEvolver(
      [chord(9, 'minor7')],
      createRNG(42),
      makeConfig({ allowedSubstitutions: ['relative'] }),
    );
    const evolved = evolver.evolve();
    expect(evolved[0]!.root).toBe(0); // relative major of A is C
    expect(evolved[0]!.quality).toBe('major');
  });

  it('applies parallel substitution (Cm -> C)', () => {
    const evolver = new HarmonicEvolver(
      [chord(0, 'minor7')],
      createRNG(42),
      makeConfig({ allowedSubstitutions: ['parallel'] }),
    );
    const evolved = evolver.evolve();
    expect(evolved[0]!.root).toBe(0);
    expect(evolved[0]!.quality).toBe('major');
  });

  it('applies chromatic approach into the next chord', () => {
    const evolver = new HarmonicEvolver(
      [chord(0, 'major'), chord(5, 'major', 4)],
      createRNG(42),
      makeConfig({ allowedSubstitutions: ['chromatic'] }),
    );
    const evolved = evolver.evolve();
    // First chord becomes a dominant7 approaching F (5) from a half-step below (4).
    expect(evolved[0]!.root).toBe(4);
    expect(evolved[0]!.quality).toBe('dominant7');
  });

  it('respects substitution rate 0 (never substitutes)', () => {
    const evolver = new HarmonicEvolver(
      [chord(7, 'dominant7')],
      createRNG(42),
      makeConfig({ substitutionRate: 0.0 }),
    );
    const evolved = evolver.evolve();
    expect(evolved[0]!.root).toBe(7);
  });

  it('only substitutes allowed types', () => {
    const evolver = new HarmonicEvolver(
      [chord(7, 'dominant7')],
      createRNG(42),
      makeConfig({ allowedSubstitutions: ['relative'] }),
    );
    const evolved = evolver.evolve();
    expect(evolved[0]!.root).not.toBe(1); // not the tritone substitution
  });

  it('is deterministic and supports reset', () => {
    const run = () => {
      const evolver = new HarmonicEvolver(
        [chord(7, 'dominant7'), chord(0, 'major', 4)],
        createRNG(9),
        makeConfig({ allowedSubstitutions: ['tritone', 'relative', 'parallel'] }),
      );
      return JSON.stringify(evolver.evolve());
    };
    expect(run()).toBe(run());
  });
});
