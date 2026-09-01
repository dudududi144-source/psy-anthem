// PSY ANTHEM - tests/web/playback.test.ts
// End-to-end playback verification on a mock AudioContext for the
// multi-oscillator psytrance engine: scheduling, routing, sends, stops.
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser, midiToFreq } from '../../web/synth.js';
import { MockAudioContext } from './mock-audio-context';

function note(pitch: number, timestamp: number, duration: number, velocity = 100, channel = 0) {
  return { type: 'note' as const, timestamp, duration, channel, data: { pitch, velocity } };
}

function freqSet(ctx: MockAudioContext): Set<number> {
  const set = new Set<number>();
  for (const osc of ctx.oscillators()) set.add(Math.round(osc.frequency.value * 100) / 100);
  return set;
}

describe('PsySynthBrowser scheduling (multi-osc engine)', () => {
  it('schedules a voice per note: fundamentals present at correct times', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);

    await synth.playEvents([note(69, 0, 1), note(76, 1, 1)], 120, 0); // 0.5 sec per beat

    expect(synth.lastNoteCount).toBe(2);
    const freqs = freqSet(ctx);
    expect(freqs.has(Math.round(midiToFreq(69) * 100) / 100)).toBe(true);
    expect(freqs.has(Math.round(midiToFreq(76) * 100) / 100)).toBe(true);
    // multi-osc: more oscillators than notes
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
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
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
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    // reverb: in -> convolver -> return -> master
    const ri = synth.reverbIn as unknown as { outputs: unknown[] };
    expect(ri.outputs[0]).toBe(synth.convolver);
    const conv = synth.convolver as unknown as { outputs: unknown[] };
    expect(conv.outputs[0]).toBe(synth.reverbReturn);
    // delay: feedback loop present
    const dn = synth.delayNode as unknown as { outputs: unknown[] };
    expect(dn.outputs).toContain(synth.delayFeedback);
    const fb = synth.delayFeedback as unknown as { outputs: unknown[] };
    expect(fb.outputs[0]).toBe(synth.delayNode);
    // chorus: lfo -> gain -> delay.delayTime
    const lfoGain = synth.chorusLfoGain as unknown as { outputs: unknown[] };
    expect(lfoGain.outputs[0]).toBe(synth.chorusDelay.delayTime);
    // convolver got an impulse buffer
    expect((synth.convolver as { buffer: unknown }).buffer).toBeDefined();
  });

  it('skips notes that already ended before fromBeat', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);

    await synth.playEvents([note(60, 0, 1), note(64, 2, 2)], 120, 3);

    expect(synth.lastNoteCount).toBe(1);
    const freqs = freqSet(ctx);
    expect(freqs.has(Math.round(midiToFreq(64) * 100) / 100)).toBe(true);
    expect(freqs.has(Math.round(midiToFreq(60) * 100) / 100)).toBe(false);
  });

  it('resumes a suspended context before scheduling', async () => {
    const ctx = new MockAudioContext();
    ctx.state = 'suspended';
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);

    await synth.playEvents([note(60, 0, 1)], 120, 0);

    expect(ctx.resumeCalls).toBe(1);
    expect(ctx.state).toBe('running');
    expect(synth.lastNoteCount).toBe(1);
  });

  it('stop() adds an explicit stop to every scheduled oscillator', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    await synth.playEvents([note(60, 0, 1), note(64, 1, 1)], 120, 0);

    for (const osc of ctx.oscillators()) {
      expect(osc.stops.length).toBe(1); // natural end-of-note stop
    }
    synth.stop();
    for (const osc of ctx.oscillators()) {
      expect(osc.stops.length).toBe(2); // explicit stop added
    }
  });

  it('playEvents is async (returns a Promise)', () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    const result = synth.playEvents([note(60, 0, 1)], 140);
    expect(result).toBeInstanceOf(Promise);
  });

  it('accent + full velocity produces a strong envelope peak', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    const ev = [{ type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 60, velocity: 127, articulation: 'accent' as const } }];
    await synth.playEvents(ev, 120, 0);

    // some gain node must ramp to ~1.0 (accent boosts velocity to the cap)
    let maxRamp = 0;
    for (const node of ctx.nodes) {
      if (node.kind !== 'gain') continue;
      const g = (node as unknown as { gain: { events: Array<[string, number, number]> } }).gain;
      for (const ev2 of g.events) {
        if (ev2[0] === 'ramp' && ev2[1] > maxRamp) maxRamp = ev2[1];
      }
    }
    expect(maxRamp).toBeGreaterThan(0.9);
  });

  it('sub-oscillator renders one octave below the fundamental', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    await synth.playEvents([note(69, 0, 1)], 120, 0); // default lead preset has a sub
    const f69 = midiToFreq(69);
    const freqs = Array.from(freqSet(ctx));
    const sub = freqs.find((f) => Math.abs(f - f69 / 2) < 0.5);
    expect(sub).toBeDefined();
  });

  it('delay time follows tempo (dotted 8th)', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    await synth.playEvents([note(60, 0, 1)], 120, 0);
    // 120 BPM -> beat 0.5s -> dotted 8th = 0.375s
    expect((synth.delayNode as unknown as { delayTime: { value: number } }).delayTime.value).toBeCloseTo(0.375, 5);
  });

  it('testSound schedules 3 staggered tones (C4 E4 G4)', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    expect(typeof synth.testSound).toBe('function');

    const duration = await synth.testSound();
    expect(duration).toBeCloseTo(1.2, 5);
    expect(synth.lastNoteCount).toBe(3);
    const freqs = freqSet(ctx);
    expect(freqs.has(Math.round(midiToFreq(60) * 100) / 100)).toBe(true);
    expect(freqs.has(Math.round(midiToFreq(64) * 100) / 100)).toBe(true);
    expect(freqs.has(Math.round(midiToFreq(67) * 100) / 100)).toBe(true);
  });

  it('compressor is configured with the psy glue settings', () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    const comp = synth.compressor as unknown as {
      threshold: { value: number }; knee: { value: number }; ratio: { value: number };
      attack: { value: number }; release: { value: number };
    };
    expect(comp.threshold.value).toBe(-24);
    expect(comp.knee.value).toBe(30);
    expect(comp.ratio.value).toBe(12);
    expect(comp.attack.value).toBeCloseTo(0.003, 6);
    expect(comp.release.value).toBeCloseTo(0.25, 6);
    expect((synth.masterGain as unknown as { gain: { value: number } }).gain.value).toBe(0.5);
  });
});
