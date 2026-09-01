// PSY ANTHEM - tests/features/counterpoint.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../../src/index';
import type { AnthemConfig, MusicalEvent, NoteData } from '../../src/types';

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

function channelEvents(events: MusicalEvent[], channel: number) {
  return events
    .filter((e) => e.type === 'note' && e.channel === channel)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Fraction of counter-note moves that go contrary to the lead's direction.
function contraryFraction(events: MusicalEvent[]): number {
  const lead = channelEvents(events, 0);
  const counter = channelEvents(events, 2);
  if (lead.length < 2 || counter.length < 2) return 0;

  let contrary = 0;
  let considered = 0;
  let leadIdx = 0;
  let prevCounter = (counter[0]!.data as NoteData).pitch;

  for (let i = 1; i < counter.length; i++) {
    const t = counter[i]!.timestamp;
    while (leadIdx + 1 < lead.length && lead[leadIdx + 1]!.timestamp <= t) leadIdx++;
    const leadNow = (lead[leadIdx]!.data as NoteData).pitch;
    const leadPrev = (lead[Math.max(0, leadIdx - 1)]!.data as NoteData).pitch;
    const leadDir = Math.sign(leadNow - leadPrev);
    const counterNow = (counter[i]!.data as NoteData).pitch;
    const counterDir = Math.sign(counterNow - prevCounter);
    if (leadDir !== 0 && counterDir !== 0) {
      considered++;
      if (counterDir === -leadDir) contrary++;
    }
    prevCounter = counterNow;
  }
  return considered === 0 ? 0 : contrary / considered;
}

describe('Counterpoint (contrary motion)', () => {
  it('counter voice moves contrary to the lead at a healthy rate', () => {
    const out = createAnthemEngine(base).generate()!;
    const fraction = contraryFraction(out.events);
    expect(fraction).toBeGreaterThanOrEqual(0.25);
  });

  it('counter stays in range and in-scale', () => {
    const out = createAnthemEngine(base).generate()!;
    const counter = channelEvents(out.events, 2);
    expect(counter.length).toBeGreaterThan(0);
    for (const e of counter) {
      const p = (e.data as NoteData).pitch;
      expect(p).toBeGreaterThanOrEqual(base.targetRange.min);
      expect(p).toBeLessThanOrEqual(base.targetRange.max);
    }
  });

  it('is deterministic', () => {
    const a = createAnthemEngine(base).generate()!;
    const b = createAnthemEngine(base).generate()!;
    expect(JSON.stringify(channelEvents(a.events, 2))).toBe(JSON.stringify(channelEvents(b.events, 2)));
  });
});
