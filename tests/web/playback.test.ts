// PSY ANTHEM - tests/web/playback.test.ts
// End-to-end playback verification on a mock AudioContext:
// engine events -> PsySynthBrowser -> started oscillators with correct
// frequencies, timings, routing and stop behaviour. No real audio hardware.
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser, midiToFreq } from '../../web/synth.js';
import { MockAudioContext } from './mock-audio-context';

function note(pitch: number, timestamp: number, duration: number, velocity = 100) {
  return { type: 'note' as const, timestamp, duration, channel: 0, data: { pitch, velocity } };
}

describe('PsySynthBrowser playback (mock context)', () => {
  it('schedules one oscillator per note with correct frequency and start time', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    const events = [note(69, 0, 1), note(76, 1, 1)];

    await synth.playEvents(events, 120, 0); // 0.5 sec per beat

    const oscs = ctx.oscillators();
    expect(oscs.length).toBe(2);
    expect(oscs[0]!.frequency.value).toBeCloseTo(midiToFreq(69), 3);
    expect(oscs[1]!.frequency.value).toBeCloseTo(midiToFreq(76), 3);
    // t0 = currentTime(1.0) + 0.06; second note one beat later (+0.5s)
    expect(oscs[0]!.starts[0]).toBeCloseTo(1.06, 5);
    expect(oscs[1]!.starts[0]).toBeCloseTo(1.56, 5);
  });

  it('routes osc -> filter -> gain -> master -> compressor -> destination', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    await synth.playEvents([note(60, 0, 1)], 120, 0);

    const osc = ctx.oscillators()[0]!;
    expect(osc.outputs.length).toBe(1);
    expect(osc.outputs[0]!.kind).toBe('filter');
    const filter = osc.outputs[0]!;
    expect(filter.outputs[0]!.kind).toBe('gain');
    const voiceGain = filter.outputs[0]!;
    expect(voiceGain.outputs[0]).toBe(synth.masterGain);
    expect((synth.masterGain as unknown as { outputs: unknown[] }).outputs[0]).toBe(synth.compressor);
    expect((synth.compressor as unknown as { outputs: unknown[] }).outputs[0]).toBe(ctx.destination);
  });

  it('skips notes that already ended before fromBeat', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    const events = [note(60, 0, 1), note(64, 2, 2)];

    await synth.playEvents(events, 120, 3); // beat 3: first note already over

    expect(ctx.oscillators().length).toBe(1);
    expect(ctx.oscillators()[0]!.frequency.value).toBeCloseTo(midiToFreq(64), 3);
  });

  it('resumes a suspended context before scheduling', async () => {
    const ctx = new MockAudioContext();
    ctx.state = 'suspended';
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);

    await synth.playEvents([note(60, 0, 1)], 120, 0);

    expect(ctx.resumeCalls).toBe(1);
    expect(ctx.state).toBe('running');
    expect(ctx.oscillators().length).toBe(1);
  });

  it('stop() halts every scheduled oscillator', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    await synth.playEvents([note(60, 0, 1), note(64, 1, 1), note(67, 2, 1)], 120, 0);

    // Each oscillator already carries its scheduled natural stop (end of note).
    for (const osc of ctx.oscillators()) {
      expect(osc.stops.length).toBe(1);
    }
    // An explicit stop adds one more stop call per oscillator.
    synth.stop();
    for (const osc of ctx.oscillators()) {
      expect(osc.stops.length).toBe(2);
    }
  });

  it('playNote auditions a single note', () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    synth.playNote(69, 110);
    const oscs = ctx.oscillators();
    expect(oscs.length).toBe(1);
    expect(oscs[0]!.frequency.value).toBeCloseTo(440, 3);
  });

  it('velocity and articulation reach the envelope', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    const ev = [{ type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 60, velocity: 127, articulation: 'accent' as const } }];
    await synth.playEvents(ev, 120, 0);
    const gains = ctx.nodes.filter((n) => n.kind === 'gain');
    // voice gain is the last created gain (master + compressor exist separately)
    const voiceGain = gains[gains.length - 1]! as unknown as { gain: { events: Array<[string, number, number]> } };
    const ramps = voiceGain.gain.events.filter((e) => e[0] === 'ramp');
    expect(ramps.length).toBeGreaterThanOrEqual(2);
    const peak = ramps[0]![1];
    expect(peak).toBeGreaterThan(0.6); // accent boosts the peak
  });
});
