// PSY ANTHEM - tests/web/scheduler.test.ts
// Lookahead window scheduler: bounded live graph, full eventual coverage.
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser } from '../../web/synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';
import { MockAudioContext } from './mock-audio-context';

function makeSynth(ctx: MockAudioContext): PsySynthBrowser {
  return new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
}

function makeLongSong(seconds: number) {
  const events = [];
  const beats = Math.ceil(seconds * (140 / 60));
  for (let b = 0; b < beats; b++) {
    events.push({
      type: 'note' as const, timestamp: b, duration: 0.5, channel: b % 4,
      data: { pitch: 55 + (b % 7), velocity: 95 },
    });
  }
  return events;
}

async function pump(synth: PsySynthBrowser, ctx: MockAudioContext, step = 5, wait = 280, maxIter = 40) {
  let guard = 0;
  while (synth.pendingNotes > 0 && guard < maxIter) {
    ctx.currentTime += step;
    await new Promise((r) => setTimeout(r, wait));
    guard++;
  }
}

describe('Lookahead window scheduler', () => {
  it('schedules only the lookahead window up front', async () => {
    const ctx = new MockAudioContext();
    const synth = makeSynth(ctx);
    await synth.playEvents(makeLongSong(30), 140, 0);
    expect(synth.totalNotes).toBeGreaterThan(30);
    expect(synth.scheduledNotes).toBeGreaterThan(0);
    expect(synth.pendingNotes).toBeGreaterThan(0);        // not all upfront
    expect(synth.scheduledNotes).toBeLessThan(synth.totalNotes);
    synth.stop();
  });

  it('fills the whole song as the clock advances', async () => {
    const ctx = new MockAudioContext();
    const synth = makeSynth(ctx);
    await synth.playEvents(makeLongSong(20), 140, 0);
    await pump(synth, ctx);
    expect(synth.pendingNotes).toBe(0);
    expect(synth.scheduledNotes).toBe(synth.totalNotes);
    synth.stop();
  });

  it('stop() cancels pending scheduling', async () => {
    const ctx = new MockAudioContext();
    const synth = makeSynth(ctx);
    await synth.playEvents(makeLongSong(30), 140, 0);
    const atStop = synth.scheduledNotes;
    synth.stop();
    ctx.currentTime += 20;
    await new Promise((r) => setTimeout(r, 300));
    expect(synth.scheduledNotes).toBe(atStop);
    expect(synth.pendingNotes).toBe(0); // plan cleared
  });
});
