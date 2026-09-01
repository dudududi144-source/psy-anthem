// PSY ANTHEM - tests/melody/generative.test.ts
import { describe, it, expect } from 'bun:test';
import { generateFractalMelody, generateChaosMelody } from '../../src/melody/generative';
import { createRNG } from '../../src/rng';

describe('Fractal melody', () => {
  it('produces 2^depth + 1 notes', () => {
    const m = generateFractalMelody(createRNG(1), 3);
    expect(m.length).toBe(9); // 2^3 + 1
  });

  it('respects the endpoints', () => {
    const m = generateFractalMelody(createRNG(7), 4, 60, 72);
    expect(m[0]).toBe(60);
    expect(m[m.length - 1]).toBe(72);
  });

  it('returns integer MIDI notes', () => {
    const m = generateFractalMelody(createRNG(3), 4);
    for (const n of m) expect(Number.isInteger(n)).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = generateFractalMelody(createRNG(42), 4);
    const b = generateFractalMelody(createRNG(42), 4);
    expect(a).toEqual(b);
  });

  it('different seeds give different contours', () => {
    const a = generateFractalMelody(createRNG(1), 4);
    const b = generateFractalMelody(createRNG(2), 4);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe('Chaos melody (logistic map)', () => {
  it('produces the requested length', () => {
    const m = generateChaosMelody(createRNG(5), 32);
    expect(m.length).toBe(32);
  });

  it('stays within [low, low + span)', () => {
    const m = generateChaosMelody(createRNG(9), 64, 48, 24);
    for (const n of m) {
      expect(n).toBeGreaterThanOrEqual(48);
      expect(n).toBeLessThan(72);
    }
  });

  it('has variation (chaotic, not constant)', () => {
    const m = generateChaosMelody(createRNG(11), 32);
    expect(new Set(m).size).toBeGreaterThan(5);
  });

  it('is deterministic for the same seed', () => {
    const a = generateChaosMelody(createRNG(77), 32);
    const b = generateChaosMelody(createRNG(77), 32);
    expect(a).toEqual(b);
  });
});
