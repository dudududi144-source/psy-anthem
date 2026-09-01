// PSY ANTHEM - tests/features/loop-mode.test.ts
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

describe('loopMode', () => {
  it('closes the harmonic loop: last chord root equals first chord root', () => {
    const out = createAnthemEngine({ ...base, loopMode: true }).generate()!;
    const chords = out.harmonicAnalysis.chords;
    expect(chords.length).toBeGreaterThan(1);
    expect(chords[chords.length - 1]!.root).toBe(chords[0]!.root);
    expect(chords[chords.length - 1]!.quality).toBe(chords[0]!.quality);
  });

  it('keeps the same note count as non-loop output', () => {
    const off = createAnthemEngine(base).generate()!;
    const on = createAnthemEngine({ ...base, loopMode: true }).generate()!;
    expect(on.events.length).toBe(off.events.length);
  });

  it('is deterministic', () => {
    const a = createAnthemEngine({ ...base, loopMode: true }).generate()!;
    const b = createAnthemEngine({ ...base, loopMode: true }).generate()!;
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });
});
