# PSY ANTHEM — Public Contract (v0.1.0)

Any change to this surface requires a version bump.

## Guarantees
- **Determinism:** identical config → identical events / harmonicAnalysis / motifDNA (timing excluded).
- **Validity:** all notes in range + scale, valid durations/velocities, no parallel 5ths/8ves.
- **Performance:** <50ms for 32 bars × 3 voices (hard limit 100ms).
- **Failure mode:** generate() returns null only when the solver cannot satisfy hard constraints.

## Input: AnthemConfig
| Field | Type | Constraint |
|-------|------|------------|
| seed | number | any int32, deterministic |
| intent | AnthemIntent | 6 genre targets |
| scale | ScaleDefinition | root 0-11 + mode |
| energyCurve | EnergyCurve | FLAT/ARC/BUILD_DROP/WAVE/CUSTOM |
| targetRange | NoteRange | MIDI min<max, within 0-127 |
| voices | number | 1-4 (lead, harmony, counter, bass) |
| bars | number | 8-128 |
| bpm | number? | default 140 |
| customCurve | points? | required iff CUSTOM |

## Output: AnthemOutput
| Field | Content |
|-------|---------|
| events | canonical MusicalEvent[] (psy-foundation protocol v1) |
| harmonicAnalysis | chords, key, cadences, tensionCurve |
| motifDNA | coreNotes, coreRhythm, transformations, occurrences |
| metadata | seed, timing, memorabilityScore, quality |

## Errors
| Input | Behavior |
|-------|----------|
| bars <8 or >128 | RangeError |
| voices <1 or >4 | RangeError |
| CUSTOM without customCurve | TypeError |
| targetRange invalid | RangeError |
| solver failure | generate() → null (host decides fallback) |
