# PSY ANTHEM — Public Contract (v0.3.0)

Any change to this surface requires a version bump.

## Guarantees
- **Determinism:** identical config → identical events / harmonicAnalysis / motifDNA (timing excluded) — verified by double-generate byte-equality across bars 8–128 in the e2e experiment.
- **Validity:** all notes in range + scale, valid durations/velocities, no parallel 5ths/8ves.
- **Performance:** <50ms for 32 bars × 3 voices (hard limit 100ms) — measured 0.1–0.8 ms/bar.
- **Failure mode:** generate() returns null only when the solver cannot satisfy hard constraints.
- **Wire conformance (new in 0.3.0):** `anthemToWire()` emits PSYBUS v2 note envelopes that pass foundation's own validator; a rejection throws (the wire never lies).

## Input: AnthemConfig
| Field | Type | Constraint |
|-------|------|------------|
| seed | number | any int32, deterministic |
| intent | AnthemIntent | 11 genre targets |
| scale | ScaleDefinition | root 0-11 + mode |
| energyCurve | EnergyCurve | FLAT/ARC/BUILD_DROP/WAVE/CUSTOM + emotional-swell/double-drop/progressive-climb/sunrise/plateau-break |
| targetRange | NoteRange | MIDI min<max, within 0-127 |
| voices | number | 1-4 (lead, harmony, counter, bass) |
| bars | number | 8-128 |
| bpm | number? | default 140 |
| customCurve | points? | required iff CUSTOM |

## Output: AnthemOutput
| Field | Content |
|-------|---------|
| events | composition-internal MusicalEvent[] (src/internal-events.ts) — NOT the wire |
| harmonicAnalysis | chords, key, cadences, tensionCurve |
| motifDNA | coreNotes, coreRhythm, transformations, occurrences |
| metadata | seed, timing, memorabilityScore, quality |

## The wire (v0.3.0 — the honest serving story)
`events` are the engine's internal format. The FAMILY WIRE is PSYBUS v2:
`anthemToWire(output, {bpm})` (src/integration/wire.ts) → validated
`BusEnvelope<NotePayload>[]` → `POST /api/render-notes` on any psy-foundation
instance ≥ `0b1e77c` → deterministic mastered WAV through foundation's sound
chain. Voice map: lead→lead, harmony→pad, counter→counter, bass→bass.
Task-17 proof: docs/SERVING_AUDIT_2026-09-05.md + docs/E2E_PIPELINE_REPORT.md
(53 claims, end-to-end, byte-deterministic across the HTTP boundary).

## Errors
| Input | Behavior |
|-------|----------|
| bars <8 or >128 | RangeError |
| voices <1 or >4 | RangeError |
| CUSTOM without customCurve | TypeError |
| targetRange invalid | RangeError |
| solver failure | generate() → null (host decides fallback) |
| wire envelope rejected | anthemToWire throws (mapping bug, never silent) |
