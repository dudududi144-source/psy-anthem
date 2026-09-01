// PSY ANTHEM - tests/audio/latency.test.ts
// Scheduling latency + robustness verification.
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser } from '../../web/synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';
import { MockAudioContext } from '../web/mock-audio-context';

function makeSynth() {
  const ctx = new MockAudioContext();
  const synth = new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
  return { synth, ctx };
}

function makeEvents(count: number) {
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push({
      type: 'note' as const,
      timestamp: i * 0.25,
      duration: 0.25,
      channel: i % 4,
      data: { pitch: 48 + (i % 24), velocity: 90 },
    });
  }
  return events;
}

describe('Latency', () => {
  it('single-note scheduling is under 50ms', async () => {
    const { synth } = makeSynth();
    const start = Date.now();
    await synth.playEvents([
      { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 60, velocity: 100 } },
    ], 140, 0);
    const latency = Date.now() - start;
    expect(latency).toBeLessThan(50);
  });

  it('batch of 100 events schedules under 50ms', async () => {
    const { synth } = makeSynth();
    const events = makeEvents(100);
    const start = Date.now();
    await synth.playEvents(events, 140, 0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
    expect(synth.lastNoteCount).toBe(100);
  });

  it('scheduling time is reported via lastScheduleMs', async () => {
    const { synth } = makeSynth();
    await synth.playEvents(makeEvents(50), 140, 0);
    expect(synth.lastScheduleMs).toBeGreaterThanOrEqual(0);
    expect(synth.lastScheduleMs).toBeLessThan(50);
  });
});

describe('Robustness', () => {
  it('filters out invalid events instead of crashing', async () => {
    const { synth } = makeSynth();
    const events = [
      { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 200, velocity: 100 } }, // pitch out of range
      { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 60, velocity: 300 } }, // velocity out of range
      { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 64, velocity: 100 } }, // valid
    ];
    await synth.playEvents(events, 140, 0);
    expect(synth.lastNoteCount).toBe(1); // only the valid event
  });

  it('returns 0 for an empty event list', async () => {
    const { synth } = makeSynth();
    const secs = await synth.playEvents([], 140, 0);
    expect(secs).toBe(0);
    expect(synth.lastNoteCount).toBe(0);
  });

  it('handles malformed input gracefully', async () => {
    const { synth } = makeSynth();
    const secs = await synth.playEvents(null as unknown as never[], 140, 0);
    expect(secs).toBe(0);
  });
});
