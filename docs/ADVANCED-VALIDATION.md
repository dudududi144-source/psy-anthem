# PSY ANTHEM — Advanced Validation

Three analyzers + a unified report. All pure WHAT-layer: they read MusicalEvent[] / ChordSymbol[], never audio.

## Modules

| Module | Analyzes | Key exports |
|--------|----------|-------------|
| src/validation/melodic-analysis.ts | contour, leaps, repetition, range, motif presence | analyzeMelody, classifyContour, analyzeLeaps |
| src/validation/harmonic-analysis.ts | functional motion, cadences, variety, tension match | analyzeHarmony, detectCadences |
| src/validation/advanced-theory.ts | voice-leading quality + unified report | analyzeVoiceLeadingFromEvents, calculateAdvancedQualityScore |

## Melodic analysis

```ts
import { analyzeMelody } from './src/validation';

const m = analyzeMelody(output.events, {
  motifNotes: output.motifDNA.coreNotes,
  targetRange: config.targetRange,
});
// m.contour, m.contourClarity, m.leaps, m.stepwiseRatio,
// m.repetitionScore, m.rangeUtilization, m.motifPresence, m.issues
```

Contour classification: peak position + direction-change counting. A clean arch needs the peak in the middle 50% with >= 60% directional agreement on both sides. Four or more direction flips = wave. >= 90% repeated pitches = plateau.

## Harmonic analysis

```ts
import { analyzeHarmony } from './src/validation';

const h = analyzeHarmony(
  output.harmonicAnalysis.chords,
  output.harmonicAnalysis.tensionCurve,
  output.harmonicAnalysis.key,
  targetCurve, // optional: per-bar intended energy
);
// h.functionalScore, h.cadences, h.varietyScore, h.tensionArcMatch, h.issues
```

Cadence detection runs at phrase boundaries (every 4 bars) and at the final chord:
- authentic: dominant degree -> tonic
- plagal: subdominant degree -> tonic
- deceptive: dominant -> degree at (dominant + 2) semitones
- half: phrase resting on the dominant

## Voice leading quality

Computed from events grouped by channel on a 16th-note onset grid:
- parallel fifths/octaves between voice pairs lower independence by 15 each
- smoothness rewards stepwise voice motion
- balance expects the lead to carry roughly half the notes in multi-voice textures
- contrary motion is measured between the lead and every other voice

## Extending

Add a new check by appending to the relevant analyzer's issues[] and (optionally) folding it into componentScores in calculateAdvancedQualityScore. Keep analyzers pure: input data in, report out, no I/O.
