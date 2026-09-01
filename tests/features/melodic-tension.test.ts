// PSY ANTHEM - tests/features/melodic-tension.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';
import { generateMelodicTension } from '../../src/motif/generator';
import { createRNG } from '../../src/rng';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

describe('generateMelodicTension', () => {
  it('inserts chromatic approach notes at full probability', () => {
    const motif = [60, 62, 64, 67, 69, 72];
    const out = generateMelodicTension(motif, createRNG(1), 1);
    expect(out.length).toBeGreaterThan(motif.length);
  });

  it('inserts nothing at zero probability', () => {
    const motif = [60, 62, 64, 67, 69, 72];
    const out = generateMelodicTension(motif, createRNG(1), 0);
    expect(out).toEqual(motif);
  });

  it('is deterministic for the same RNG stream', () => {
    const motif = [60, 62, 64, 67, 69, 72];
    const a = generateMelodicTension(motif, createRNG(3), 0.7);
    const b = generateMelodicTension(motif, createRNG(3), 0.7);
    expect(a).toEqual(b);
  });
});

describe('engine chromatic tension pass', () => {
  it('default (no flag) matches the golden-safe output', () => {
    const a = createAnthemEngine(base).generate()!;
    const b = createAnthemEngine({ ...base, chromaticTension: 0 }).generate()!;
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  it('tension > 0 changes the lead and stays valid', () => {
    const plain = createAnthemEngine(base).generate()!;
    const tense = createAnthemEngine({ ...base, chromaticTension: 1 }).generate()!;
    expect(tense).not.toBeNull();
    expect(tense.events.length).toBeGreaterThan(0);
    expect(JSON.stringify(tense.events)).not.toBe(JSON.stringify(plain.events));
    // some lead note carries the tension flag
    const flagged = tense.events.filter((e) => e.type === 'note' && e.channel === 0 && (e.data as { tension?: boolean }).tension === true);
    expect(flagged.length).toBeGreaterThan(0);
  });

  it('tension output is deterministic', () => {
    const cfg = { ...base, chromaticTension: 0.8 };
    const a = createAnthemEngine(cfg).generate()!;
    const b = createAnthemEngine(cfg).generate()!;
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });
});
