// PSY ANTHEM - tests/web/presets.test.ts
import { describe, it, expect } from 'bun:test';
import { PRESETS, PRESET_CATEGORIES, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';

describe('Preset library (phase 8)', () => {
  it('all presets have required fields', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      expect(preset.name).toBeDefined();
      expect(preset.oscillators).toBeInstanceOf(Array);
      expect(preset.oscillators.length).toBeGreaterThan(0);
      expect(preset.filter).toBeDefined();
      expect(preset.envelope).toBeDefined();
      expect(preset.fx).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('has at least 8 presets covering all categories', () => {
    expect(Object.keys(PRESETS).length).toBeGreaterThanOrEqual(8);
    expect(PRESET_CATEGORIES.lead.length).toBeGreaterThanOrEqual(3);
    expect(PRESET_CATEGORIES.harmony.length).toBeGreaterThanOrEqual(1);
    expect(PRESET_CATEGORIES.counter.length).toBeGreaterThanOrEqual(1);
    expect(PRESET_CATEGORIES.bass.length).toBeGreaterThanOrEqual(3);
  });

  it('default voice presets cover all 4 voices and exist', () => {
    for (const v of [0, 1, 2, 3]) {
      expect(DEFAULT_VOICE_PRESETS[v]).toBeDefined();
      expect(PRESETS[DEFAULT_VOICE_PRESETS[v]]).toBeDefined();
    }
  });

  it('psy-lead has detuned unison oscillators', () => {
    const lead = PRESETS['psy-lead'];
    const detunes = lead.oscillators.map((o) => o.detune);
    expect(detunes).toContain(-8);
    expect(detunes).toContain(0);
    expect(detunes).toContain(8);
  });

  it('psy-bass carries a sub-octave oscillator via -1200 cents', () => {
    const bass = PRESETS['psy-bass'];
    const detunes = bass.oscillators.map((o) => o.detune);
    expect(detunes).toContain(-1200);
  });

  it('acid-lead has high resonance + fast filter envelope (303 squelch)', () => {
    const acid = PRESETS['acid-lead'];
    expect(acid.filter.resonance).toBeGreaterThan(15);
    expect(acid.filter.envelope).not.toBeNull();
    expect(acid.filter.envelope.amount).toBeGreaterThanOrEqual(2000);
    expect(acid.filter.envelope.decay).toBeLessThan(0.3);
  });

  it('wobble-bass has an LFO on the filter cutoff', () => {
    const wobble = PRESETS['wobble-bass'];
    expect(wobble.lfo).toBeDefined();
    expect(wobble.lfo.target).toBe('filterCutoff');
    expect(wobble.lfo.rate).toBeGreaterThanOrEqual(4);
    expect(wobble.lfo.rate).toBeLessThanOrEqual(8);
    expect(wobble.lfo.depth).toBeGreaterThan(0);
  });

  it('every category entry references an existing preset', () => {
    for (const cat of Object.values(PRESET_CATEGORIES)) {
      for (const id of cat) expect(PRESETS[id]).toBeDefined();
    }
  });

  it('pad presets use wide reverb sends', () => {
    expect(PRESETS['psy-pad'].fx.reverbSend).toBeGreaterThanOrEqual(0.5);
  });
});
