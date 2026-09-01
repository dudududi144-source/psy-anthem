// PSY ANTHEM - tests/web/presets.test.ts
import { describe, it, expect } from 'bun:test';
import { PRESETS, PRESET_CATEGORIES, DEFAULT_PRESETS } from '../../web/presets.js';

describe('Preset library', () => {
  it('all presets have required fields', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      expect(preset.name).toBeDefined();
      expect(preset.oscillators).toBeInstanceOf(Array);
      expect(preset.oscillators.length).toBeGreaterThan(0);
      expect(preset.filter).toBeDefined();
      expect(preset.envelope).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('has at least 10 presets covering all categories', () => {
    expect(Object.keys(PRESETS).length).toBeGreaterThanOrEqual(10);
    expect(PRESET_CATEGORIES.lead.length).toBeGreaterThanOrEqual(3);
    expect(PRESET_CATEGORIES.harmony.length).toBeGreaterThanOrEqual(2);
    expect(PRESET_CATEGORIES.counter.length).toBeGreaterThanOrEqual(2);
    expect(PRESET_CATEGORIES.bass.length).toBeGreaterThanOrEqual(3);
  });

  it('default presets cover all 4 voices and exist', () => {
    for (const v of [0, 1, 2, 3]) {
      expect(DEFAULT_PRESETS[v]).toBeDefined();
      expect(PRESETS[DEFAULT_PRESETS[v]]).toBeDefined();
    }
  });

  it('psy-lead has detuned unison oscillators', () => {
    const lead = PRESETS['psy-lead'];
    const detunes = lead.oscillators.map((o) => o.detune);
    expect(detunes).toContain(-7);
    expect(detunes).toContain(0);
    expect(detunes).toContain(7);
  });

  it('psy-lead and psy-bass have sub oscillators', () => {
    expect(PRESETS['psy-lead'].sub).toBeDefined();
    expect(PRESETS['psy-bass'].sub).toBeDefined();
    expect(PRESETS['psy-bass'].sub.octaves).toBe(-1);
  });

  it('acid-lead has high resonance (303 style)', () => {
    expect(PRESETS['acid-lead'].filter.resonance).toBeGreaterThan(15);
  });

  it('filter envelopes exist for sweeping presets', () => {
    expect(PRESETS['psy-lead'].filter.envelope).toBeGreaterThan(0.5);
    expect(PRESETS['pluck'].filter.envelope).toBeGreaterThan(0.9);
  });

  it('wobble-bass has an LFO on the filter', () => {
    expect(PRESETS['wobble-bass'].lfo).toBeDefined();
    expect(PRESETS['wobble-bass'].lfo.rate).toBeGreaterThan(0);
    expect(PRESETS['wobble-bass'].lfo.target).toBe('filter');
  });

  it('every category entry references an existing preset', () => {
    for (const cat of Object.values(PRESET_CATEGORIES)) {
      for (const id of cat) expect(PRESETS[id]).toBeDefined();
    }
  });
});
