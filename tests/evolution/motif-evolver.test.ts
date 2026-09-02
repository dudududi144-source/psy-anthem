// PSY ANTHEM - tests/evolution/motif-evolver.test.ts
import { describe, it, expect } from 'bun:test';
import { MotifEvolver } from '../../src/evolution/motif-evolver';
import type { EvolutionConfig } from '../../src/evolution/motif-evolver';
import { createRNG } from '../../src/rng';
import type { MotifDNA } from '../../src/types';

function makeMotif(notes: number[], rhythm: number[]): MotifDNA {
  return { coreNotes: [...notes], coreRhythm: [...rhythm], transformations: [], occurrences: [] };
}

function makeConfig(overrides: Partial<EvolutionConfig>): EvolutionConfig {
  return {
    mutationRate: 1.0,
    evolutionDepth: 'shallow',
    constraints: { preserveRhythm: false, preserveContour: false, maxIntervalChange: 5 },
    ...overrides,
  };
}

describe('MotifEvolver', () => {
  it('creates evolver with the original motif', () => {
    const evolver = new MotifEvolver(makeMotif([60, 62, 64, 65], [1, 1, 1, 1]), createRNG(42), makeConfig({}));
    expect(evolver.getCurrentMotif().coreNotes).toEqual([60, 62, 64, 65]);
    expect(evolver.getEvolutionHistory().length).toBe(0);
  });

  it('evolves the motif with mutations', () => {
    const evolver = new MotifEvolver(
      makeMotif([60, 62, 64, 65], [1, 1, 1, 1]),
      createRNG(42),
      makeConfig({ evolutionDepth: 'medium' }),
    );
    const evolved = evolver.evolve(0);
    expect(evolved.coreNotes).not.toEqual([60, 62, 64, 65]);
    expect(evolved.transformations.some((t) => t.type === 'EVOLUTION')).toBe(true);
    const history = evolver.getEvolutionHistory();
    expect(history.length).toBe(1);
    expect(history[0]!.mutations.length).toBeGreaterThan(0);
  });

  it('respects mutation rate 0 (never mutates)', () => {
    const evolver = new MotifEvolver(
      makeMotif([60, 62, 64, 65], [1, 1, 1, 1]),
      createRNG(42),
      makeConfig({ mutationRate: 0.0 }),
    );
    const evolved = evolver.evolve(0);
    expect(evolved.coreNotes).toEqual([60, 62, 64, 65]);
    expect(evolver.getEvolutionHistory().length).toBe(0);
  });

  it('preserves rhythm when the constraint is set', () => {
    const evolver = new MotifEvolver(
      makeMotif([60, 62, 64, 65], [0.5, 0.5, 1, 1]),
      createRNG(42),
      makeConfig({ evolutionDepth: 'deep', constraints: { preserveRhythm: true, preserveContour: false, maxIntervalChange: 5 } }),
    );
    const evolved = evolver.evolve(0);
    expect(evolved.coreRhythm).toEqual([0.5, 0.5, 1, 1]);
  });

  it('records evolution history across bars', () => {
    const evolver = new MotifEvolver(
      makeMotif([60, 62, 64, 65], [1, 1, 1, 1]),
      createRNG(42),
      makeConfig({}),
    );
    evolver.evolve(0);
    evolver.evolve(1);
    evolver.evolve(2);
    const history = evolver.getEvolutionHistory();
    expect(history.length).toBe(3);
    expect(history[0]!.bar).toBe(0);
    expect(history[1]!.bar).toBe(1);
    expect(history[2]!.bar).toBe(2);
  });

  it('resets to the original motif', () => {
    const evolver = new MotifEvolver(
      makeMotif([60, 62, 64, 65], [1, 1, 1, 1]),
      createRNG(42),
      makeConfig({}),
    );
    evolver.evolve(0);
    evolver.evolve(1);
    evolver.reset();
    expect(evolver.getCurrentMotif().coreNotes).toEqual([60, 62, 64, 65]);
    expect(evolver.getEvolutionHistory().length).toBe(0);
  });

  it('limits pitch changes to maxIntervalChange from the original', () => {
    const original = [60, 62, 64, 65];
    const evolver = new MotifEvolver(
      makeMotif(original, [1, 1, 1, 1]),
      createRNG(42),
      makeConfig({ constraints: { preserveRhythm: false, preserveContour: false, maxIntervalChange: 2 } }),
    );
    const evolved = evolver.evolve(0);
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs(evolved.coreNotes[i]! - original[i]!)).toBeLessThanOrEqual(2);
    }
    // Guaranteed audible change.
    expect(evolved.coreNotes).not.toEqual(original);
  });

  it('is deterministic for the same RNG seed', () => {
    const run = () => {
      const evolver = new MotifEvolver(
        makeMotif([60, 62, 64, 65], [1, 1, 1, 1]),
        createRNG(7),
        makeConfig({ evolutionDepth: 'deep' }),
      );
      evolver.evolve(0);
      evolver.evolve(1);
      return JSON.stringify(evolver.getCurrentMotif().coreNotes);
    };
    expect(run()).toBe(run());
  });
});
