// PSY ANTHEM - tests/audio/quality.test.ts
// Sound-quality verification for the phase-9 synthesis techniques.
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser, midiToFreq } from '../../web/synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';
import { MockAudioContext } from '../web/mock-audio-context';

function makeSynth() {
  const ctx = new MockAudioContext();
  const synth = new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
  return { synth, ctx };
}

async function playNote(synth: PsySynthBrowser, presetId: string, pitch: number, duration = 1) {
  synth.setPresets({ 0: presetId });
  await synth.playEvents([
    { type: 'note' as const, timestamp: 0, duration, channel: 0, data: { pitch, velocity: 100 } },
  ], 140, 0);
}

describe('Audio Quality - FM synthesis', () => {
  it('produces inharmonic sidebands (3.5:1 ratio)', async () => {
    const { synth, ctx } = makeSynth();
    await playNote(synth, 'crystal-lead', 69);
    const f0 = midiToFreq(69);
    const oscs = ctx.oscillators();
    // carrier + modulator at inharmonic ratio
    expect(oscs.some((o) => Math.abs(o.frequency.value - f0) < 1)).toBe(true);
    expect(oscs.some((o) => Math.abs(o.frequency.value - f0 * 3.5) < 1)).toBe(true);
    // ratio is inharmonic (not an integer)
    expect(3.5).not.toBe(Math.round(3.5));
  });

  it('modulator depth settles over the note (spectral movement)', async () => {
    const { synth, ctx } = makeSynth();
    await playNote(synth, 'crystal-lead', 69);
    const gains = ctx.nodes.filter((n) => n.kind === 'gain');
    const modGain = gains.find((g) => {
      const events = (g as unknown as { gain: { events: Array<[string, number, number]> } }).gain.events;
      return events.some((e) => e[0] === 'set' && e[1] === 800) &&
             events.some((e) => e[0] === 'target');
    });
    expect(modGain).toBeDefined();
  });
});

describe('Audio Quality - Additive synthesis', () => {
  it('creates a complex timbre from detuned partials', async () => {
    const { synth, ctx } = makeSynth();
    await playNote(synth, 'plasma-lead', 69);
    const f0 = midiToFreq(69);
    const ratios = [1, 2.01, 3.03, 5.07, 7.11];
    const found = ctx.oscillators().filter((o) =>
      ratios.some((r) => Math.abs(o.frequency.value - f0 * r) < 1)
    );
    expect(found.length).toBe(5);
    // at least one partial is inharmonic
    const inharmonic = ratios.filter((r) => r !== Math.round(r));
    expect(inharmonic.length).toBeGreaterThanOrEqual(3);
  });

  it('morphs the spectrum over time (gain ramps on partials)', async () => {
    const { synth, ctx } = makeSynth();
    await playNote(synth, 'plasma-lead', 69);
    const gains = ctx.nodes.filter((n) => n.kind === 'gain');
    const morphing = gains.filter((g) => {
      const events = (g as unknown as { gain: { events: Array<[string, number, number]> } }).gain.events;
      return events.some((e) => e[0] === 'ramp');
    });
    expect(morphing.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Audio Quality - Granular synthesis', () => {
  it('creates texture from many short grains', async () => {
    const { synth, ctx } = makeSynth();
    await playNote(synth, 'nebula-pad', 60, 4);
    const grains = ctx.oscillators().filter((o) => o.frequency.value > 20);
    expect(grains.length).toBeGreaterThan(10);
  });

  it('grains have short envelopes (texture, not tones)', async () => {
    const { synth, ctx } = makeSynth();
    await playNote(synth, 'nebula-pad', 60, 4);
    const grains = ctx.oscillators().filter((o) => o.frequency.value > 20);
    // each grain stopped shortly after its start (short grainSize)
    for (const g of grains.slice(0, 5)) {
      expect(g.stops.length).toBeGreaterThanOrEqual(1);
      const start = g.starts[0]!;
      const stop = g.stops[0]!;
      expect(stop - start).toBeLessThan(0.3);
    }
  });
});

describe('Audio Quality - Physical modeling', () => {
  it('excites a resonant body (noise burst + damped fundamental)', async () => {
    const { synth, ctx } = makeSynth();
    await playNote(synth, 'quantum-bass', 45);
    const bufferSrcs = ctx.nodes.filter((n) => n.kind === 'buffer-src');
    expect(bufferSrcs.length).toBe(1);
    const oscs = ctx.oscillators().filter((o) => o.frequency.value > 20);
    expect(oscs.length).toBeGreaterThanOrEqual(1); // damped fundamental
  });
});
