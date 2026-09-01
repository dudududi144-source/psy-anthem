// PSY ANTHEM - tests/web/synth-presets.test.ts
import { describe, it, expect } from 'bun:test';
import { PsySynthBrowser } from '../../web/synth.js';
import { PRESETS } from '../../web/presets.js';
import { MockAudioContext } from './mock-audio-context';

describe('PsySynthBrowser.setPresets', () => {
  it('accepts valid preset IDs for all voices', () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    expect(() => synth.setPresets({
      0: 'psy-lead',
      1: 'psy-pad',
      2: 'pluck',
      3: 'psy-bass',
    })).not.toThrow();
    expect(synth.presets[0]).toBe('psy-lead');
    expect(synth.presets[3]).toBe('psy-bass');
  });

  it('throws on invalid preset ID', () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    expect(() => synth.setPresets({ 0: 'nonexistent' })).toThrow();
  });

  it('partial updates keep other voices intact', () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
    const before = synth.presets[1];
    synth.setPresets({ 0: 'acid-lead' });
    expect(synth.presets[0]).toBe('acid-lead');
    expect(synth.presets[1]).toBe(before);
  });

  it('macro setters keep values in range', () => {
    const ctx = new MockAudioContext();
    const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
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
      const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
      synth.setPresets({ 0: id });
      await synth.playEvents([
        { type: 'note' as const, timestamp: 0, duration: 1, channel: 0, data: { pitch: 60, velocity: 100 } },
      ], 140, 0);
      expect(ctx.oscillators().length).toBeGreaterThanOrEqual(preset.oscillators.length);
    }
  });
});
