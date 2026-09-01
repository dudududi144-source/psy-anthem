// PSY ANTHEM - tests/metrics/variety.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig, MusicalEvent } from '../../src/types';
import {
  analyzeVariety,
  rhythmicVarietyOf,
  intervalVarietyOf,
  dynamicVarietyOf,
  articulationVarietyOf,
} from '../../src/metrics';

const config: AnthemConfig = {
  seed: 77, intent: AnthemIntent.PROGRESSIVE,
  scale: { root: 0, mode: 'minor' }, energyCurve: EnergyCurve.WAVE,
  targetRange: { min: 48, max: 84 }, voices: 3, bars: 16, bpm: 132,
};

function note(pitch: number, timestamp: number, duration: number, velocity: number, articulation?: 'legato' | 'staccato' | 'accent' | 'normal' | 'ghost'): MusicalEvent {
  const data = articulation !== undefined ? { pitch, velocity, articulation } : { pitch, velocity };
  return { type: 'note', timestamp, duration, channel: 0, data };
}

describe('variety primitives', () => {
  it('rhythmic variety: monotone durations score low', () => {
    const mono: MusicalEvent[] = [];
    for (let i = 0; i < 16; i++) mono.push(note(60, i * 0.5, 0.5, 90));
    const mixed: MusicalEvent[] = [
      note(60, 0, 0.25, 90), note(62, 0.25, 0.5, 90), note(64, 0.75, 1, 90), note(65, 1.75, 2, 90),
    ];
    expect(rhythmicVarietyOf(mono)).toBeLessThan(rhythmicVarietyOf(mixed));
  });

  it('interval variety: one interval vs many', () => {
    const one: MusicalEvent[] = [note(60, 0, 1, 90), note(67, 1, 1, 90), note(60, 2, 1, 90), note(67, 3, 1, 90)];
    const many: MusicalEvent[] = [note(60, 0, 1, 90), note(62, 1, 1, 90), note(67, 2, 1, 90), note(72, 3, 1, 90)];
    expect(intervalVarietyOf(one)).toBeLessThan(intervalVarietyOf(many));
  });

  it('dynamic variety: constant velocity -> 0', () => {
    const flat: MusicalEvent[] = [];
    for (let i = 0; i < 10; i++) flat.push(note(60 + i, i, 1, 90));
    expect(dynamicVarietyOf(flat)).toBe(0);
    const spread: MusicalEvent[] = [];
    for (let i = 0; i < 10; i++) spread.push(note(60 + i, i, 1, 40 + i * 9));
    expect(dynamicVarietyOf(spread)).toBeGreaterThan(0.5);
  });

  it('articulation variety counts distinct articulations', () => {
    const one = [note(60, 0, 1, 90, 'legato'), note(62, 1, 1, 90, 'legato')];
    const four = [
      note(60, 0, 1, 90, 'legato'), note(62, 1, 1, 90, 'staccato'),
      note(64, 2, 1, 90, 'accent'), note(65, 3, 1, 90, 'ghost'),
    ];
    expect(articulationVarietyOf(one)).toBeCloseTo(0.25, 5);
    expect(articulationVarietyOf(four)).toBe(1);
  });
});

describe('analyzeVariety on real output', () => {
  it('returns bounded scores and is deterministic', () => {
    const out = createAnthemEngine(config).generate()!;
    const a = analyzeVariety(out);
    const b = analyzeVariety(createAnthemEngine(config).generate()!);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
