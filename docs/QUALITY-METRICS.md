# PSY ANTHEM — Quality Metrics

Every anthem gets an AdvancedQualityReport: six component scores (0-100), a weighted overall score, and a grade.

```ts
import { calculateAdvancedQualityScore } from './src/validation';

const report = calculateAdvancedQualityScore(output, config);
console.log(report.overall, report.grade);
console.log(report.summary); // human-readable findings
```

## Overall weighting

| Component | Weight | Source |
|-----------|--------|--------|
| Singability | 20% | src/metrics/singability.ts |
| Emotional arc | 20% | src/metrics/emotional-arc.ts |
| Variety | 15% | src/metrics/variety.ts |
| Voice leading | 15% | src/validation/advanced-theory.ts |
| Harmony | 15% | src/validation/harmonic-analysis.ts |
| Melodic structure | 15% | src/validation/melodic-analysis.ts |

## Grades

| Overall | Grade | Interpretation |
|---------|-------|----------------|
| 90-100 | masterpiece | Release-ready arrangement skeleton |
| 80-89 | excellent | Strong material, minor polish |
| 65-79 | good | Solid, usable, room to improve |
| 50-64 | acceptable | Sketch quality |
| <50 | needs-work | Structural problems present |

## Component details

### Singability (lead voice)
- stepwiseRatio (35%): fraction of melodic intervals <= M2. High = vocal-friendly.
- rangeAppropriateness (25%): span of 7-19 semitones scores full; narrower or extremely wide decays.
- breathability (20%): gaps >= 0.5 beats; need ~1 breath per 4 bars.
- hookClarity (20%): most repeated 3-note pitch-class cell; 4+ occurrences = full hook.
Interpretation: <40 means the lead is hard to follow; >75 means it sings.

### Variety
- rhythmicVariety (25%): distinct durations (4+ kinds = full), penalizes monotone runs > 8.
- intervalVariety (25%): distinct melodic interval classes across voices (6+ = full).
- dynamicVariety (25%): velocity std-dev, normalized by 15.
- articulationVariety (25%): distinct articulations used (4 = full).
Interpretation: <30 = monotonous; >70 = rich texture.

### Emotional arc
- arcShapeMatch (50%): Pearson correlation between generated tension curve and the intended energy curve.
- buildRelease (30%): middle quarter must rise above the first (build) and above the last (release).
- peakPlacement (20%): peak bar within 10% of the intended position (ARC=0.5, BUILD_DROP=0.75; FLAT/WAVE not applicable).
Interpretation: this is the journey score. <50 means the piece goes nowhere.

### Voice leading
- smoothness: average consecutive interval per voice (<= 2 semitones = full, >= 7 = zero).
- independence: 100 minus 15 per detected parallel fifth/octave between voices.
- balance: lead should carry ~half the notes in multi-voice textures.
- contraryMotion: fraction of opposite-direction motion between lead and the other voices on shared onsets.

### Harmony
- functionalScore: root-motion quality (circle-of-fifths motion = 1.0, step = 0.8, thirds = 0.7, tritone = 0.4).
- varietyScore: distinct-chord ratio with an ideal band of 0.25-0.7.
- cadences: authentic (V->I), plagal (IV->I), half (phrase on V), deceptive (V->vi).
- tensionArcMatch: correlation vs target curve when provided.

### Melodic structure
- contour: arch / ascent / descent / wave / plateau / irregular, with clarity.
- leaps: count of leaps > P4 and how many are recovered (step in opposite direction).
- repetitionScore: recurring 3-cells rewarded, monotone runs penalized.
- rangeUtilization: used span vs target span; ideal 40%-90%.
- motifPresence: fraction of lead pitch classes that belong to the motif DNA.

## Reading a report

```text
overall 78/100 -> good
strongest: emotionalArc (95)
weakest: variety (52)
melodic: 3 unrecovered leaps > P4
harmonic: no cadences detected at phrase boundaries
```
The summary always names the strongest and weakest component plus every issue the validators found.
