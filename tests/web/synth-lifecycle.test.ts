// PSY ANTHEM - tests/web/synth-lifecycle.test.ts
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser } from '../../web/synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';
import { MockAudioContext } from './mock-audio-context';

interface SourceLike {
  onended?: (() => void) | null;
}

function makeSynth(): { ctx: MockAudioContext; synth: PsySynthBrowser } {
  const ctx = new MockAudioContext();
  const synth = new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
  return { ctx, synth };
}

const note = { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 60, velocity: 100 } };

function activeCount(synth: PsySynthBrowser): number {
  return (synth as unknown as { activeNodes: unknown[] }).activeNodes.length;
}

function fireAllEndings(ctx: MockAudioContext): number {
  let fired = 0;
  for (const node of ctx.oscillators()) {
    const fn = (node as unknown as SourceLike).onended;
    if (typeof fn === 'function') { fn.call(node); fired++; }
  }
  return fired;
}

describe('Voice lifecycle (no node accumulation)', () => {
  it('schedules onended cleanup handlers on sources', async () => {
    const { ctx, synth } = makeSynth();
    await synth.playEvents([note], 140, 0);
    const oscs = ctx.oscillators();
    expect(oscs.length).toBeGreaterThan(0);
    expect(activeCount(synth)).toBeGreaterThan(0);
    const armed = oscs.filter((o) => typeof (o as unknown as SourceLike).onended === 'function');
    expect(armed.length).toBeGreaterThan(0);
  });

  it('activeNodes empties as sources end', async () => {
    const { ctx, synth } = makeSynth();
    await synth.playEvents([note], 140, 0);
    expect(activeCount(synth)).toBeGreaterThan(0);
    const fired = fireAllEndings(ctx);
    expect(fired).toBeGreaterThan(0);
    expect(activeCount(synth)).toBe(0);
  });

  it('per-note graph is detached once all sources of the note end', async () => {
    const { ctx, synth } = makeSynth();
    await synth.playEvents([note], 140, 0);
    fireAllEndings(ctx);
    const gains = ctx.nodes.filter((n) => n.kind === 'gain');
    const detached = gains.filter((g) => g.disconnected > 0);
    expect(detached.length).toBeGreaterThanOrEqual(1);
  });

  it('many sequential notes do not accumulate active references', async () => {
    const { ctx, synth } = makeSynth();
    const events = [];
    for (let i = 0; i < 64; i++) {
      events.push({ type: 'note' as const, timestamp: i, duration: 0.5, channel: 0, data: { pitch: 50 + (i % 12), velocity: 100 } });
    }
    await synth.playEvents(events, 140, 0);
    expect(activeCount(synth)).toBeGreaterThan(0);
    fireAllEndings(ctx);
    expect(activeCount(synth)).toBe(0);
  });

  it('stop() still clears every reference', async () => {
    const { synth } = makeSynth();
    await synth.playEvents([note], 140, 0);
    synth.stop();
    expect(activeCount(synth)).toBe(0);
  });
});
