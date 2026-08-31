// PSY ANTHEM - tests/solver/validator.test.ts
import { describe, it, expect } from 'bun:test';
import { theoryLint } from '../../src/solver/validator';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig, MusicalEvent } from '../../src/types';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
};

function note(pitch: number, velocity: number = 90, duration: number = 1, timestamp: number = 0): MusicalEvent {
  return { type: 'note', timestamp, duration, channel: 0, data: { pitch, velocity } };
}

describe('Theory Lint', () => {
  it('flags out-of-range notes', () => {
    const r = theoryLint([note(120)], base);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.type === 'OUT_OF_RANGE')).toBe(true);
  });

  it('flags out-of-scale notes', () => {
    const r = theoryLint([note(61)], base);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.type === 'OUT_OF_SCALE')).toBe(true);
  });

  it('passes valid in-scale in-range notes', () => {
    const r = theoryLint([note(60), note(63), note(67)], base);
    expect(r.valid).toBe(true);
    expect(r.errors.length).toBe(0);
  });

  it('flags empty output', () => {
    const r = theoryLint([], base);
    expect(r.valid).toBe(false);
  });

  it('warns on unusual durations', () => {
    const r = theoryLint([note(60, 90, 0.75)], base);
    expect(r.warnings.some((w) => w.type === 'UNUSUAL_DURATION')).toBe(true);
  });
});
