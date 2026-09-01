// PSY ANTHEM - tests/features/call-response.test.ts
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

describe('callResponse', () => {
  it('changes the answer bars (output differs from plain generation)', () => {
    const plain = createAnthemEngine(base).generate()!;
    const cr = createAnthemEngine({ ...base, callResponse: true }).generate()!;
    expect(cr.events.length).toBe(plain.events.length);
    expect(JSON.stringify(cr.events)).not.toBe(JSON.stringify(plain.events));
  });

  it('keeps rhythm identical (only pitches shift on answer bars)', () => {
    const plain = createAnthemEngine(base).generate()!;
    const cr = createAnthemEngine({ ...base, callResponse: true }).generate()!;
    const rhythmOf = (events: typeof plain.events) =>
      events.map((e) => e.timestamp.toFixed(3) + ':' + e.duration.toFixed(3)).join('|');
    expect(rhythmOf(cr.events)).toBe(rhythmOf(plain.events));
  });

  it('is deterministic', () => {
    const a = createAnthemEngine({ ...base, callResponse: true }).generate()!;
    const b = createAnthemEngine({ ...base, callResponse: true }).generate()!;
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });
});
