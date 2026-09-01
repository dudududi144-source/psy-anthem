// PSY ANTHEM - tests/features/density-control.test.ts
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

function leadCount(out: { events: { type: string; channel: number }[] }): number {
  return out.events.filter((e) => e.type === 'note' && e.channel === 0).length;
}

describe('density control', () => {
  it('sparse < medium < dense lead note counts', () => {
    const sparse = createAnthemEngine({ ...base, density: 'sparse' }).generate()!;
    const medium = createAnthemEngine({ ...base, density: 'medium' }).generate()!;
    const dense = createAnthemEngine({ ...base, density: 'dense' }).generate()!;
    expect(leadCount(sparse)).toBeLessThan(leadCount(medium));
    expect(leadCount(medium)).toBeLessThan(leadCount(dense));
  });

  it('default density is medium (same output without the flag)', () => {
    const withFlag = createAnthemEngine({ ...base, density: 'medium' }).generate()!;
    const withoutFlag = createAnthemEngine(base).generate()!;
    expect(JSON.stringify(withFlag.events)).toBe(JSON.stringify(withoutFlag.events));
  });

  it('all three densities produce valid output', () => {
    for (const density of ['sparse', 'medium', 'dense'] as const) {
      const out = createAnthemEngine({ ...base, density }).generate();
      expect(out).not.toBeNull();
      expect(out!.events.length).toBeGreaterThan(0);
    }
  });
});
