// PSY ANTHEM - tests/motif/generator.test.ts
import { describe, it, expect } from 'bun:test';
import { generateMotif } from '../../src/motif/generator';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig } from '../../src/types';
import { createRNG } from '../../src/rng';
import { scalePitchClasses, isInScale } from '../../src/harmony/intervals';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
};

describe('Motif Generator', () => {
  it('produces 3-5 notes', () => {
    const m = generateMotif(base, createRNG(42));
    expect(m.coreNotes.length).toBeGreaterThanOrEqual(3);
    expect(m.coreNotes.length).toBeLessThanOrEqual(5);
  });

  it('notes are in scale and range', () => {
    const pcs = scalePitchClasses(base.scale);
    const m = generateMotif(base, createRNG(42));
    for (const n of m.coreNotes) {
      expect(isInScale(n, pcs)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(base.targetRange.min);
      expect(n).toBeLessThanOrEqual(base.targetRange.max);
    }
  });

  it('rhythm matches note count and is positive', () => {
    const m = generateMotif(base, createRNG(42));
    expect(m.coreRhythm.length).toBe(m.coreNotes.length);
    for (const d of m.coreRhythm) expect(d).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    const a = generateMotif(base, createRNG(42));
    const b = generateMotif(base, createRNG(42));
    expect(a.coreNotes).toEqual(b.coreNotes);
    expect(a.coreRhythm).toEqual(b.coreRhythm);
  });

  it('works for every intent', () => {
    for (const intent of Object.values(AnthemIntent)) {
      const m = generateMotif({ ...base, intent }, createRNG(7));
      expect(m.coreNotes.length).toBeGreaterThanOrEqual(3);
    }
  });
});
