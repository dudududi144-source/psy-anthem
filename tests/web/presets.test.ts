// PSY ANTHEM - tests/web/presets.test.ts
import { describe, it, expect } from 'bun:test';
import { PRESETS, PRESETS_V2, PRESET_CATEGORIES, DEFAULT_VOICE_PRESETS } from '../../web/presets.js';

const KNOWN_ENGINES = ['Subtractive', 'FM', 'Additive', 'Granular', 'Wavetable', 'Physical', 'Glitch'];

describe('Preset library (phase 10 - 16 presets)', () => {
  it('has exactly 16 presets with name/technique/envelope', () => {
    expect(Object.keys(PRESETS).length).toBe(16);
    for (const [id, preset] of Object.entries(PRESETS)) {
      expect(preset.name).toBeDefined();
      expect(preset.technique).toBeDefined();
      expect(preset.envelope).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('PRESETS_V2 aliases PRESETS', () => {
    expect(PRESETS_V2).toBe(PRESETS);
  });

  it('every technique resolves to known engines (layered or single)', () => {
    for (const preset of Object.values(PRESETS)) {
      const parts = String(preset.technique).split('+').map((s: string) => s.trim());
      const engines = parts.filter((p: string) => KNOWN_ENGINES.includes(p));
      expect(engines.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('default voice presets cover all 4 voices and exist', () => {
    for (const v of [0, 1, 2, 3]) {
      expect(DEFAULT_VOICE_PRESETS[v]).toBeDefined();
      expect(PRESETS[DEFAULT_VOICE_PRESETS[v]]).toBeDefined();
    }
  });

  it('categories cover all 16 presets exactly once', () => {
    const listed = Object.values(PRESET_CATEGORIES).flat();
    expect(listed.length).toBe(16);
    expect(new Set(listed).size).toBe(16);
    for (const id of listed) expect(PRESETS[id]).toBeDefined();
  });

  it('category counts: 6 leads, 3 pads, 3 counters, 4 basses', () => {
    expect(PRESET_CATEGORIES.lead.length).toBe(6);
    expect(PRESET_CATEGORIES.harmony.length).toBe(3);
    expect(PRESET_CATEGORIES.counter.length).toBe(3);
    expect(PRESET_CATEGORIES.bass.length).toBe(4);
  });

  it('layered presets exist (Granular+FM, Wavetable+Distortion, Granular+Sub, Physical+Filter)', () => {
    expect(PRESETS['vapor-lead'].technique).toBe('Granular+FM');
    expect(PRESETS['neon-lead'].technique).toBe('Wavetable+Distortion');
    expect(PRESETS['plasma-bass'].technique).toBe('Granular+Sub');
    expect(PRESETS['gravity-bass'].technique).toBe('Physical+Filter');
  });

  it('crystal-lead is FM with an inharmonic modulator ratio', () => {
    const p = PRESETS['crystal-lead'];
    expect(p.technique).toBe('FM');
    expect(p.fm.modulator.ratio).not.toBe(Math.round(p.fm.modulator.ratio));
  });

  it('metallic-bell has inharmonic additive partials', () => {
    const partials = PRESETS['metallic-bell'].additive.partials;
    const inharmonic = partials.filter((p) => p.ratio !== Math.round(p.ratio));
    expect(inharmonic.length).toBeGreaterThanOrEqual(3);
  });

  it('plasma-bass carries a -2 octave sub', () => {
    expect(PRESETS['plasma-bass'].sub.octaves).toBe(-2);
  });

  it('psy-supersaw default lead has unison oscillators + sub-oscillator', () => {
    const p = PRESETS['psy-supersaw'];
    expect(DEFAULT_VOICE_PRESETS[0]).toBe('psy-supersaw');
    expect(p.technique).toBe('Subtractive');
    expect(p.oscillators.length).toBeGreaterThanOrEqual(3);
    expect(p.sub).toBeDefined();
    expect(p.sub.octaves).toBe(-1);
    const detunes = p.oscillators.map((o) => o.detune);
    expect(detunes).toContain(-18);
    expect(detunes).toContain(18);
    expect(detunes).toContain(0);
  });
});
