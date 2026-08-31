// PSY ANTHEM - tests/harmony/voice-leading.test.ts
import { describe, it, expect } from 'bun:test';
import { detectParallelFifths, detectParallelOctaves, buildVoices } from '../../src/harmony/voice-leading';
import { generateChordProgression } from '../../src/harmony/chord-progressions';
import { generateMotif } from '../../src/motif/generator';
import { planSections } from '../../src/structure/section-planner';
import { createRNG } from '../../src/rng';
import { AnthemIntent, EnergyCurve } from '../../src/types';
import type { AnthemConfig } from '../../src/types';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
};

describe('Parallel detection', () => {
  it('detects parallel fifths', () => {
    expect(detectParallelFifths(60, 67, 62, 69)).toBe(true);
  });
  it('allows non-parallel motion', () => {
    expect(detectParallelFifths(60, 67, 64, 69)).toBe(false);
  });
  it('detects parallel octaves', () => {
    expect(detectParallelOctaves(60, 72, 62, 74)).toBe(true);
  });
  it('unison on same pitch is not parallel octaves', () => {
    expect(detectParallelOctaves(60, 72, 60, 72)).toBe(false);
  });
});

describe('buildVoices', () => {
  it('produces requested number of voices, all events in range', () => {
    const rng = createRNG(42);
    const sections = planSections(base);
    const motif = generateMotif(base, rng);
    const progression = generateChordProgression(base, sections, rng);
    const result = buildVoices({ motif, sections, progression, config: base }, rng);

    expect(result.voices.length).toBe(base.voices);
    expect(result.complete).toBe(true);
    for (const v of result.voices) {
      expect(v.events.length).toBeGreaterThan(0);
      for (const e of v.events) {
        expect(e.pitch).toBeGreaterThanOrEqual(base.targetRange.min);
        expect(e.pitch).toBeLessThanOrEqual(base.targetRange.max);
      }
    }
  });

  it('bass voice exists when voices=4', () => {
    const cfg = { ...base, voices: 4 };
    const rng = createRNG(42);
    const sections = planSections(cfg);
    const motif = generateMotif(cfg, rng);
    const progression = generateChordProgression(cfg, sections, rng);
    const result = buildVoices({ motif, sections, progression, config: cfg }, rng);
    expect(result.voices.length).toBe(4);
    const bass = result.voices[3]!;
    expect(bass.events.length).toBe(cfg.bars * 4);
  });

  it('is deterministic for same inputs', () => {
    function run() {
      const rng = createRNG(42);
      const sections = planSections(base);
      const motif = generateMotif(base, rng);
      const progression = generateChordProgression(base, sections, rng);
      return buildVoices({ motif, sections, progression, config: base }, rng);
    }
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
