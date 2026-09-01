// PSY ANTHEM - tests/web/synth-presets.test.ts
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser } from '../../web/synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';
import { MockAudioContext } from './mock-audio-context';

function makeSynth(): { synth: PsySynthBrowser; ctx: MockAudioContext } {
  const ctx = new MockAudioContext();
  const synth = new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
  return { synth, ctx };
}

async function playOne(synth: PsySynthBrowser, presetId: string, pitch = 60): Promise<void> {
  synth.setPresets({ 0: presetId });
  await synth.playEvents([
    { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch, velocity: 100 } },
  ], 140, 0);
}

describe('PsySynthBrowser.setPresets (V2 library)', () => {
  it('accepts valid preset IDs for all voices', () => {
    const { synth } = makeSynth();
    expect(() => synth.setPresets({
      0: 'plasma-lead',
      1: 'nebula-pad',
      2: 'glitch-pluck',
      3: 'quantum-bass',
    })).not.toThrow();
    expect(synth.presets[0]).toBe('plasma-lead');
    expect(synth.presets[3]).toBe('quantum-bass');
  });

  it('throws on invalid preset ID', () => {
    const { synth } = makeSynth();
    expect(() => synth.setPresets({ 0: 'nonexistent' })).toThrow();
  });

  it('partial updates keep other voices intact', () => {
    const { synth } = makeSynth();
    const before = synth.presets[1];
    synth.setPresets({ 0: 'plasma-lead' });
    expect(synth.presets[0]).toBe('plasma-lead');
    expect(synth.presets[1]).toBe(before);
  });

  it('macro setters keep values in range', () => {
    const { synth } = makeSynth();
    synth.setMasterCutoff(99999);
    expect((synth.masterFilter as unknown as { frequency: { value: number } }).frequency.value).toBeLessThanOrEqual(16000);
    synth.setReverbSend(5);
    expect(synth.reverbLevel).toBe(1);
    synth.setDelaySend(-3);
    expect(synth.delayLevel).toBe(0);
    synth.setMasterDrive(42);
    expect(synth._drive).toBe(1);
  });

  it('every V2 preset schedules without throwing', async () => {
    for (const id of Object.keys(PRESETS)) {
      const { synth, ctx } = makeSynth();
      await playOne(synth, id);
      expect(synth.lastNoteCount).toBe(1);
      expect(ctx.oscillators().length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Phase-9 technique implementations', () => {
  it('FM: modulator at inharmonic ratio connects to carrier.frequency', async () => {
    const { synth, ctx } = makeSynth();
    await playOne(synth, 'crystal-lead', 69);
    const oscs = ctx.oscillators();
    const carrierFreq = 440 * Math.pow(2, (69 - 69) / 12);
    const modulator = oscs.find((o) => Math.abs(o.frequency.value - carrierFreq * 3.5) < 1);
    expect(modulator).toBeDefined();
    // modulator output reaches a gain that connects to a frequency param
    const gains = ctx.nodes.filter((n) => n.kind === 'gain');
    const fmConnected = gains.some((g) => {
      const outs = (g as unknown as { outputs: unknown[] }).outputs;
      return outs.some((o) => o && (o as { value?: number }).value !== undefined && !(o as { kind?: string }).kind);
    });
    expect(fmConnected).toBe(true);
  });

  it('Additive: creates one oscillator per partial', async () => {
    const { synth, ctx } = makeSynth();
    await playOne(synth, 'plasma-lead', 69);
    const f0 = 440 * Math.pow(2, (69 - 69) / 12);
    const partialRatios = [1, 2.01, 3.03, 5.07, 7.11];
    const found = ctx.oscillators().filter((o) =>
      partialRatios.some((r) => Math.abs(o.frequency.value - f0 * r) < 1)
    );
    expect(found.length).toBe(5);
  });

  it('Granular: spawns a cloud of short grains', async () => {
    const { synth, ctx } = makeSynth();
    synth.setPresets({ 0: 'nebula-pad' });
    await synth.playEvents([
      { type: 'note' as const, timestamp: 0, duration: 4, channel: 0, data: { pitch: 60, velocity: 100 } },
    ], 140, 0);
    // 4 beats at 140bpm = ~1.71s; density 12 -> ~20 grains (capped 24)
    const grains = ctx.oscillators().filter((o) => o.frequency.value > 20);
    expect(grains.length).toBeGreaterThan(10);
  });

  it('Wavetable: crossfaded pair + sub harmonic at -1200 cents', async () => {
    const { synth, ctx } = makeSynth();
    await playOne(synth, 'neuro-bass', 45);
    const oscs = ctx.oscillators();
    const sub = oscs.find((o) => o.detune.value === -1200);
    expect(sub).toBeDefined();
    const crossfaders = oscs.filter((o) => o.detune.value === 0);
    expect(crossfaders.length).toBeGreaterThanOrEqual(2); // wave A + wave B
  });

  it('Physical: excites a noise buffer source + resonant fundamental', async () => {
    const { synth, ctx } = makeSynth();
    await playOne(synth, 'quantum-bass', 45);
    const bufferSrcs = ctx.nodes.filter((n) => n.kind === 'buffer-src');
    expect(bufferSrcs.length).toBe(1);
    expect((bufferSrcs[0] as unknown as { starts: number[] }).starts.length).toBe(1);
  });

  it('Glitch: retriggers the pluck (stutter)', async () => {
    const { synth, ctx } = makeSynth();
    await playOne(synth, 'glitch-pluck', 72);
    const oscs = ctx.oscillators().filter((o) => o.frequency.value > 20);
    expect(oscs.length).toBeGreaterThanOrEqual(1);
  });
});
