// PSY ANTHEM - tests/web/synth-presets.test.ts
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser } from '../../web/synth.js';
import { PRESETS, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';
import { MockAudioContext } from './mock-audio-context';

function makeSynth(): PsySynthBrowser {
  const ctx = new MockAudioContext();
  return new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
}

describe('PsySynthBrowser.setPresets (DI library)', () => {
  it('accepts valid preset IDs for all voices', () => {
    const synth = makeSynth();
    expect(() => synth.setPresets({
      0: 'acid-lead',
      1: 'psy-pad',
      2: 'pluck',
      3: 'wobble-bass',
    })).not.toThrow();
    expect(synth.presets[0]).toBe('acid-lead');
    expect(synth.presets[3]).toBe('wobble-bass');
  });

  it('throws on invalid preset ID', () => {
    const synth = makeSynth();
    expect(() => synth.setPresets({ 0: 'nonexistent' })).toThrow();
  });

  it('partial updates keep other voices intact', () => {
    const synth = makeSynth();
    const before = synth.presets[1];
    synth.setPresets({ 0: 'acid-lead' });
    expect(synth.presets[0]).toBe('acid-lead');
    expect(synth.presets[1]).toBe(before);
  });

  it('macro setters keep values in range', () => {
    const synth = makeSynth();
    synth.setMasterCutoff(99999);
    expect((synth.masterFilter as unknown as { frequency: { value: number } }).frequency.value).toBeLessThanOrEqual(16000);
    synth.setReverbSend(5);
    expect(synth.reverbLevel).toBe(1);
    synth.setDelaySend(-3);
    expect(synth.delayLevel).toBe(0);
    synth.setMasterDrive(42);
    expect(synth._drive).toBe(1);
  });

  it('every preset schedules without throwing', async () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      const ctx = new MockAudioContext();
      const synth = new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
      synth.setPresets({ 0: id });
      await synth.playEvents([
        { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 60, velocity: 100 } },
      ], 140, 0);
      expect(ctx.oscillators().length).toBeGreaterThanOrEqual(preset.oscillators.length);
    }
  });

  it('wobble-bass creates a filter-targeted LFO per note', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
    synth.setPresets({ 0: 'wobble-bass' });
    await synth.playEvents([
      { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 48, velocity: 100 } },
    ], 140, 0);
    // oscillators: 1 voice osc + 1 LFO
    const oscs = ctx.oscillators();
    expect(oscs.length).toBe(2);
    const lfo = oscs.find((o) => o.frequency.value === 6);
    expect(lfo).toBeDefined();
    // LFO gain connects to the voice filter frequency param
    const lfoGains = ctx.nodes.filter((n) => n.kind === 'gain');
    const connectedToParam = lfoGains.some((g) => {
      const outs = (g as unknown as { outputs: unknown[] }).outputs;
      return outs.some((o) => o && (o as { value?: number }).value !== undefined && !(o as { kind?: string }).kind);
    });
    expect(connectedToParam).toBe(true);
  });

  it('filter envelope uses setTargetAtTime when configured', async () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext, { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
    synth.setPresets({ 0: 'acid-lead' });
    await synth.playEvents([
      { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 60, velocity: 100 } },
    ], 140, 0);
    const filters = ctx.nodes.filter((n) => n.kind === 'filter');
    expect(filters.length).toBe(1);
    const freq = (filters[0] as unknown as { frequency: { events: Array<[string, number, number]> } }).frequency;
    expect(freq.events.some((e) => e[0] === 'set' && e[1] > 1200)).toBe(true);  // opened peak
    expect(freq.events.some((e) => e[0] === 'target' && e[1] === 1200)).toBe(true); // settles to base
  });
});
