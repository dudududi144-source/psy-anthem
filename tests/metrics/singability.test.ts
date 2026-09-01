// PSY ANTHEM - tests/metrics/singability.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig, MusicalEvent } from '../../src/types';
import {
  analyzeSingability,
  stepwiseRatioOf,
  rangeAppropriatenessOf,
  breathabilityOf,
  hookClarityOf,
} from '../../src/metrics';

const config: AnthemConfig = {
  seed: 42, intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' }, energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 }, voices: 3, bars: 16, bpm: 140,
};

function note(pitch: number, timestamp: number, duration: number = 0.5, velocity: number = 90): MusicalEvent {
  return { type: 'note', timestamp, duration, channel: 0, data: { pitch, velocity } };
}

describe('singability primitives', () => {
  it('stepwise ratio: all steps -> 1', () => {
    const notes = [note(60, 0), note(62, 0.5), note(63, 1), note(65, 1.5)];
    expect(stepwiseRatioOf(notes)).toBe(1);
  });

  it('stepwise ratio: all leaps -> 0', () => {
    const notes = [note(60, 0), note(72, 0.5), note(48, 1), note(72, 1.5)];
    expect(stepwiseRatioOf(notes)).toBe(0);
  });

  it('range appropriateness: octave span is ideal', () => {
    const good = [note(60, 0), note(72, 0.5)];
    expect(rangeAppropriatenessOf(good)).toBe(1);
    const narrow = [note(60, 0), note(63, 0.5)];
    expect(rangeAppropriatenessOf(narrow)).toBeLessThan(1);
  });

  it('breathability counts gaps >= 0.5 beats', () => {
    const withBreaths = [note(60, 0), note(62, 2), note(64, 4), note(65, 6)];
    expect(breathabilityOf(withBreaths, 4)).toBeGreaterThan(0.5);
    const packed = [note(60, 0), note(62, 0.25), note(64, 0.5), note(65, 0.75)];
    expect(breathabilityOf(packed, 4)).toBe(0);
  });

  it('hook clarity rewards repeated cells', () => {
    const hooky: MusicalEvent[] = [];
    const cell = [60, 62, 64];
    let t = 0;
    for (let rep = 0; rep < 5; rep++) {
      for (const p of cell) {
        hooky.push(note(p, t));
        t += 0.5;
      }
    }
    expect(hookClarityOf(hooky)).toBe(1);
  });
});

describe('analyzeSingability on real output', () => {
  it('returns bounded scores and is deterministic', () => {
    const out = createAnthemEngine(config).generate()!;
    const a = analyzeSingability(out);
    const b = analyzeSingability(createAnthemEngine(config).generate()!);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.stepwiseRatio).toBeGreaterThanOrEqual(0);
    expect(a.stepwiseRatio).toBeLessThanOrEqual(1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
