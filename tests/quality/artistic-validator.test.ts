// PSY ANTHEM - tests/quality/artistic-validator.test.ts
import { describe, it, expect } from 'bun:test';
import { createAnthemEngine, AnthemIntent, EnergyCurve, validateArtisticQuality } from '../../src/index';
import type { AnthemConfig, AnthemOutput, ChordSymbol, MusicalEvent } from '../../src/types';

function chord(root: number, quality: ChordSymbol['quality'], startBar = 0): ChordSymbol {
  return { root, quality, extensions: [], startBar, durationBars: 1 };
}

function note(pitch: number, timestamp: number, duration = 0.5, channel = 0, velocity = 90): MusicalEvent {
  return { type: 'note', timestamp, duration, channel, data: { pitch, velocity } };
}

function makeOutput(chords: ChordSymbol[], events: MusicalEvent[], tensionCurve: number[] = []): AnthemOutput {
  return {
    events,
    harmonicAnalysis: { chords, key: { root: 0, mode: 'major' }, cadences: [], tensionCurve },
    motifDNA: { coreNotes: [60, 62, 64], coreRhythm: [1, 1, 1], transformations: [], occurrences: [] },
    metadata: {
      seed: 1,
      intent: AnthemIntent.PROGRESSIVE,
      generationTimeMs: 0,
      memorabilityScore: 50,
      constraintsViolated: 0,
      solverIterations: 0,
      quality: 'good',
      bars: 4,
      voices: 1,
    },
  };
}

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

describe('Artistic Validator', () => {
  it('scores extended chords higher than simple chords', () => {
    const simple = makeOutput(
      [chord(0, 'major'), chord(5, 'major'), chord(7, 'major'), chord(0, 'major')],
      [note(60, 0), note(64, 1), note(67, 2), note(60, 3)],
    );
    const extended = makeOutput(
      [chord(0, 'major9'), chord(5, 'major9'), chord(7, 'dominant13'), chord(0, 'major7')],
      [note(60, 0), note(64, 1), note(67, 2), note(60, 3)],
    );
    const simpleScore = validateArtisticQuality(simple).harmonicRichness;
    const extendedScore = validateArtisticQuality(extended).harmonicRichness;
    expect(extendedScore).toBeGreaterThan(simpleScore);
  });

  it('scores varied melodies higher than monotonous ones', () => {
    const monotonous = makeOutput(
      [chord(0, 'major')],
      [note(60, 0), note(62, 1), note(64, 2), note(62, 3), note(60, 4), note(62, 5)],
    );
    const varied = makeOutput(
      [chord(0, 'major')],
      [note(60, 0), note(67, 1), note(64, 2), note(72, 3), note(65, 4), note(74, 5)],
    );
    const monotonousScore = validateArtisticQuality(monotonous).melodicInterest;
    const variedScore = validateArtisticQuality(varied).melodicInterest;
    expect(variedScore).toBeGreaterThan(monotonousScore);
  });

  it('scores strong tension range as a better emotional arc', () => {
    const flat = makeOutput([chord(0, 'major')], [note(60, 0)], [0.5, 0.5, 0.5, 0.5]);
    const arc = makeOutput([chord(0, 'major')], [note(60, 0)], [0.1, 0.4, 0.9, 0.2]);
    expect(validateArtisticQuality(arc).emotionalArc).toBeGreaterThan(validateArtisticQuality(flat).emotionalArc);
  });

  it('scores thicker textures higher', () => {
    const thin = makeOutput([chord(0, 'major')], [note(60, 0, 2, 0)], [0.5, 0.5]);
    const thickEvents: MusicalEvent[] = [];
    for (let ch = 0; ch < 4; ch++) {
      for (let i = 0; i < 8; i++) thickEvents.push(note(48 + ch * 12 + (i % 4), i * 0.5, 0.5, ch));
    }
    const thick = makeOutput([chord(0, 'major')], thickEvents, [0.5, 0.5]);
    expect(validateArtisticQuality(thick).texturalDepth).toBeGreaterThan(validateArtisticQuality(thin).texturalDepth);
  });

  it('produces issues and suggestions for weak material', () => {
    const weak = makeOutput(
      [chord(0, 'major'), chord(0, 'major')],
      [note(60, 0), note(60, 1), note(60, 2), note(60, 3)],
      [0.5, 0.5],
    );
    const report = validateArtisticQuality(weak);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(60);
  });

  it('score is bounded 0-100 and deterministic on real output', () => {
    const out = createAnthemEngine(base).generate()!;
    const r1 = validateArtisticQuality(out);
    const r2 = validateArtisticQuality(createAnthemEngine(base).generate()!);
    expect(r1.score).toBeGreaterThanOrEqual(0);
    expect(r1.score).toBeLessThanOrEqual(100);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    for (const k of ['melodicInterest', 'harmonicRichness', 'rhythmicVariety', 'texturalDepth', 'emotionalArc'] as const) {
      expect(r1[k]).toBeGreaterThanOrEqual(0);
      expect(r1[k]).toBeLessThanOrEqual(1);
    }
  });
});
