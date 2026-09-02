// PSY ANTHEM - tests/drums/drum-pattern.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig } from '../../src/types';

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 8,
  bpm: 140,
};

const DRUM_PITCHES = new Set([36, 38, 39, 42, 46, 43, 50]);

describe('Drum pattern (opt-in)', () => {
  it('drums are OFF by default (no channel 9 events)', () => {
    const out = createAnthemEngine(config).generate();
    expect(out).not.toBeNull();
    const drums = out!.events.filter((e) => e.type === 'note' && e.channel === 9);
    expect(drums.length).toBe(0);
  });

  it('drums are added when drums=true', () => {
    const out = createAnthemEngine({ ...config, drums: true }).generate();
    expect(out).not.toBeNull();
    const drums = out!.events.filter((e) => e.type === 'note' && e.channel === 9);
    expect(drums.length).toBeGreaterThan(0);
  });

  it('drum events use valid GM drum pitches', () => {
    const out = createAnthemEngine({ ...config, drums: true }).generate()!;
    const drums = out.events.filter((e) => e.type === 'note' && e.channel === 9);
    for (const d of drums) {
      const pitch = (d.data as { pitch: number }).pitch;
      expect(DRUM_PITCHES.has(pitch)).toBe(true);
    }
  });

  it('drums include a kick on every bar', () => {
    const out = createAnthemEngine({ ...config, drums: true }).generate()!;
    const kicks = out.events.filter((e) => e.type === 'note' && e.channel === 9 && (e.data as { pitch: number }).pitch === 36);
    // At least one kick per bar (kick on beats 0,1,2,3 -> 4 per bar)
    expect(kicks.length).toBeGreaterThanOrEqual(config.bars);
  });

  it('drums are deterministic', () => {
    const a = createAnthemEngine({ ...config, drums: true }).generate()!;
    const b = createAnthemEngine({ ...config, drums: true }).generate()!;
    const drumsA = a.events.filter((e) => e.channel === 9);
    const drumsB = b.events.filter((e) => e.channel === 9);
    expect(JSON.stringify(drumsA)).toBe(JSON.stringify(drumsB));
  });
});
