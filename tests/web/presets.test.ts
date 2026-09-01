// PSY ANTHEM - tests/web/presets.test.ts
import { describe, it, expect } from 'bun:test';
import { PRESETS, PRESETS_V2, PRESET_CATEGORIES, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';

const TECHNIQUES = ['FM', 'Additive', 'Granular', 'Wavetable', 'Physical', 'Glitch'];

describe('Preset library (phase 9 / V2)', () => {
  it('has 6 modern presets, each declaring a synthesis technique', () => {
    expect(Object.keys(PRESETS).length).toBe(6);
    for (const [id, preset] of Object.entries(PRESETS)) {
      expect(TECHNIQUES).toContain(preset.technique);
      expect(preset.name).toBeDefined();
      expect(preset.envelope).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('PRESETS_V2 aliases PRESETS', () => {
    expect(PRESETS_V2).toBe(PRESETS);
  });

  it('covers all six techniques exactly once', () => {
    const used = Object.values(PRESETS).map((p) => p.technique);
    for (const t of TECHNIQUES) expect(used).toContain(t);
  });

  it('default voice presets cover all 4 voices and exist', () => {
    for (const v of [0, 1, 2, 3]) {
      expect(DEFAULT_VOICE_PRESETS[v]).toBeDefined();
      expect(PRESETS[DEFAULT_VOICE_PRESETS[v]]).toBeDefined();
    }
  });

  it('crystal-lead is FM with an inharmonic modulator ratio', () => {
    const p = PRESETS['crystal-lead'];
    expect(p.technique).toBe('FM');
    expect(p.fm.modulator.ratio).toBeGreaterThan(1);
    expect(p.fm.modulator.ratio).not.toBe(Math.round(p.fm.modulator.ratio)); // inharmonic
  });

  it('plasma-lead is additive with inharmonic partials + morph', () => {
    const p = PRESETS['plasma-lead'];
    expect(p.technique).toBe('Additive');
    expect(p.additive.partials.length).toBeGreaterThanOrEqual(4);
    expect(p.additive.morph.start.length).toBe(p.additive.partials.length);
    expect(p.additive.morph.end.length).toBe(p.additive.partials.length);
    const hasInharmonic = p.additive.partials.some((x) => x.ratio !== Math.round(x.ratio));
    expect(hasInharmonic).toBe(true);
  });

  it('nebula-pad is granular with texture params', () => {
    const p = PRESETS['nebula-pad'];
    expect(p.technique).toBe('Granular');
    expect(p.granular.density).toBeGreaterThan(0);
    expect(p.granular.grainSize).toBeGreaterThan(0);
  });

  it('neuro-bass is wavetable with a sub harmonic one octave down', () => {
    const p = PRESETS['neuro-bass'];
    expect(p.technique).toBe('Wavetable');
    expect(p.wavetable.subHarmonic.enabled).toBe(true);
    expect(p.wavetable.subHarmonic.octaves).toBe(-1);
    expect(p.wavetable.types.length).toBeGreaterThanOrEqual(2);
  });

  it('quantum-bass is physical modeling', () => {
    const p = PRESETS['quantum-bass'];
    expect(p.technique).toBe('Physical');
    expect(p.physical.damping).toBeGreaterThanOrEqual(0);
  });

  it('glitch-pluck is stochastic glitch', () => {
    const p = PRESETS['glitch-pluck'];
    expect(p.technique).toBe('Glitch');
    expect(p.glitch.rate).toBeGreaterThan(0);
  });

  it('every category entry references an existing preset', () => {
    for (const cat of Object.values(PRESET_CATEGORIES)) {
      for (const id of cat) expect(PRESETS[id]).toBeDefined();
    }
  });
});
