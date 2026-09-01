# Artistic Quality Validation (Phase 10)

validateArtisticQuality(output) scores five aesthetic dimensions (each 0-1), weighted into a 0-100 score with issues + suggestions. Pure analysis: no RNG, no audio.

## The five dimensions

### 1. Melodic Interest (25 pts)
Interval variety of the lead (unique interval classes / 8, capped) x 0.6 + duration variety (unique durations / 4) x 0.4.

### 2. Harmonic Richness (25 pts)
extendedRatio x 0.55 + seventhRatio x 0.30 + rootVariety x 0.15. 9/11/13 chords dominate the score; enable with harmonyComplexity: 'complex'.

### 3. Rhythmic Variety (20 pts)
Syncopation (off-beat note ratio x 2, capped) x 0.6 + duration variety x 0.4.

### 4. Textural Depth (15 pts)
maxSimultaneous-notes/8 x 0.5 + distinct-channels/4 x 0.5. Use 3-4 voices for full marks.

### 5. Emotional Arc (15 pts)
Tension-curve range (max - min) x 1.2. ARC / BUILD_DROP curves with real drops score highest; FLAT scores near zero.

## Interpretation

| Score | Quality |
|-------|---------|
| 90-100 | Professional-level composition |
| 75-89 | Solid, minor issues |
| 60-74 | Functional, lacking depth |
| 0-59 | Needs significant improvement |

## Improving your score
1. harmonyComplexity: 'complex' — extended chords lift harmonic richness
2. 3-4 voices — textural depth needs layers
3. ARC / BUILD_DROP energy curves — emotional arc needs real drops
4. Off-beat activity — syncopation lifts rhythmic variety
5. chromaticTension > 0 — adds color (interval variety) to the lead

## Programmatic use

```ts
import { validateArtisticQuality } from 'psy-anthem';
const report = validateArtisticQuality(output);
// report.score, report.issues, report.suggestions, and the five 0-1 dimensions
```

The engine also attaches the report to every generation:
metadata.artisticQuality / artisticBreakdown / artisticIssues / artisticSuggestions.
