// PSY ANTHEM - tests/web/playback.test.ts
// End-to-end playback verification on a mock AudioContext for the
// phase-8 psytrance engine: scheduling, routing, sends, stops.
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser, midiToFreq } from '../../web/synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';
import { MockAudioContext } from './mock-audio-context';

function makeSynth(ctx: MockAudioContext): PsySynthBrowser {
  return new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
}

function note(pitch: number, timestamp: number, duration: number, velocity = 100, channel = 0) {
  return { type: 'note' as const, timestamp, duration, channel, data: { pitch, velocity } };
}

function freqSet(ctx: MockAudioContext): Set<number> {
  const set = new Set<number>();
  for (const osc of ctx.oscillators()) set.add(Math.round(osc.frequency.value * 100) / 100);
  return set;
}

describe('PsySynthBrowser scheduling (phase-8 engine)', () => {
  it('schedules voices per note: fundamentals present at correct times', async () => {
    const ctx = new MockAudioContext();
    const synth = makeSynth(ctx);

    await synth.playEvents([note(69, 0, 1), note(76, 1, 1)], 120, 0); // 0.5 sec per beat

    expect(synth.lastNoteCount).toBe(2);
    const freqs = freqSet(ctx);
    expect(freqs.has(Math.round(midiToFreq(69) * 100) / 100)).toBe(true);
    expect(freqs.has(Math.round(midiToFreq(76) * 100) / 100)).toBe(true);
    // multi-osc presets: more oscillators than notes
    expect(ctx.oscillators().length).toBeGreaterThan(2);

    // fundamentals start at t0 = currentTime(1.0) + 0.06, second one +0.5s
    const f69 = Math.round(midiToFreq(69) * 100) / 100;
    const startOf = ctx.oscillators()
      .filter((o) => Math.round(o.frequency.value * 100) / 100 === f69)
      .flatMap((o) => o.starts);
    expect(startOf.some((t) => Math.abs(t - 1.06) < 1e-6)).toBe(true);
  });

  it('master chain: masterGain -> drive shaper -> master filter -> compressor -> destination', () => {
    const ctx = new MockAudioContext();
    const synth = makeSynth(ctx);
    const mg = synth.masterGain as unknown as { outputs: Array<{ kind: string; outputs: unknown[] }> };
    expect(mg.outputs[0]).toBe(synth.driveShaper);
    const shaper = synth.driveShaper as unknown as { outputs: unknown[] };
    expect(shaper.outputs[0]).toBe(synth.masterFilter);
    const mf = synth.masterFilter as unknown as { outputs: unknown[] };
    expect(mf.outputs[0]).toBe(synth.compressor);
    const comp = synth.compressor as unknown as { outputs: unknown[] };
    expect(comp.outputs[0]).toBe(ctx.destination);
  });

  it('global buses are wired: reverb, feedback delay, modulated chorus', () => {
    const ctx = new MockAudioContext();
    const synth = makeSynth(ctx);
    const ri = synth.reverbIn as unknown as { outputs: unknown[] };
    expect(ri.outputs[0]).toBe(synth.convolver);
    const conv = synth.convolver as unknown as { outputs: unknown[] };
    expect(conv.outputs[0]).toBe(synth.reverbReturn);
    const dn = synth.delayNode as unknown as { outputs: unknown[] };
    expect(dn.outputs).toContain(synth.delayFeedback);
    const fb = synth.delayFeedback as unknown as { outputs: unknown[] };
    expect(fb.outputs[0]).toBe(synth.delayNode);
    const lfoGain = synth.chorusLfoGain as unknown as { outputs: unknown[] };
    expect(lfoGain.outputs[0]).toBe(synth.chorusDelay.delayTime);
    expect((synth.convolver as { buffer: unknown }).buffer).toBeDefined();
  });
