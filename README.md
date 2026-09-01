# PSY ANTHEM — Composition Engine

> **Status: ARCHITECTURE PHASE — Phase 0 complete, Phase 1 (Motif Engine) building.**

PSY ANTHEM is the melodic composition engine of the PSY family. A pure **WHAT-layer** generator that produces anthem-grade melodic content — motifs, harmonic journeys, tension arcs, and multi-voice counterpoint — delivered as canonical `MusicalEvent[]` for any HOW-layer device (`psysynth`, `PsySynthPro`, `psy-sampler`).

## The Problem
Markov chains / random walks produce **sequences of notes**, not **stories**. An anthem requires:
- **Motif DNA** — one idea, developed through transformation
- **Voice Leading** — mathematically correct counterpoint
- **Tension Architecture** — macro energy curves spanning minutes
- **Expression** — humanized timing/dynamics from harmonic context

## What This Is / Is NOT
✅ Pure WHAT-layer, deterministic (seed → byte-identical), constraint-based (CSP), testable, foundation-conformant.
❌ Not an audio device, not a sequencer, not a UI, not random.

## Architecture (pipeline)
```
Seed + Intent + Scale + EnergyCurve
  -> SectionPlanner -> MotifGenerator -> MotifTransformer
  -> ChordProgression -> VoiceLeadingSolver(CSP)
  -> TensionMapper -> ExpressionEngine -> Validator
  -> MusicalEvent[] + HarmonicAnalysis + MotifDNA
```

## Family Position
| Repo | Layer | Role |
|------|-------|------|
| psy-foundation | Infrastructure | Shared types/protocol |
| **psy-anthem** | **WHAT** | **Melodic/harmonic generation** |
| psysynth / PsySynthPro / psydrum / psy-sampler | HOW | Audio realization |
| PSY6-ULTIMATE / psystar | Host | Consume WHAT + HOW |

## Hard Rules
1. No audio (never import `AudioContext`).
2. No randomness without seed (`mulberry32` only).
3. No foundation import at runtime (pinned shim only).
4. Every musical rule is a test.
5. Output is canonical `MusicalEvent[]`.
6. No side effects — pure functions.

## Getting Started
```bash
bun install
bun test           # all tests
bun run typecheck  # strict TS
bun run validate   # theory lint over the generation grid
bun run bench      # performance benchmark
bun run pianoroll  # ASCII piano-roll preview
```


## Quick Start (CLI)

```bash
# Generate a 32-bar anthem and write a Standard MIDI File
bun scripts/cli.ts --seed 42 --intent euphoric-trance --bars 32 --output anthem.mid

# Or get the full AnthemOutput as JSON
bun scripts/cli.ts --seed 1337 --json

# All options
bun scripts/cli.ts --help
```

## MIDI Export (for any DAW)

Every AnthemOutput can become a Standard MIDI File (format 1, one track per voice,
tempo + 4/4 meta events, 480 ticks/quarter):

```ts
import { writeMidiFile } from './src/export';

writeMidiFile(out, 'anthem.mid', { bpm: 140 });
```

Import into Ableton / FL Studio / Logic / Reaper, or feed a hardware synth.
See docs/MIDI-INTEGRATION.md for channel mapping and DAW steps.

## Examples

Eight runnable programs in examples/ covering the whole API:

| File | Shows |
|------|-------|
| 01-basic-generation.ts | Minimal config -> full AnthemOutput |
| 02-all-intents.ts | All 6 genre intents, same seed |
| 03-all-energy-curves.ts | FLAT / ARC / BUILD_DROP / WAVE |
| 04-scale-exploration.ts | 7 modes x 2 roots |
| 05-custom-energy-curve.ts | User-defined double-drop envelope |
| 06-export-midi.ts | SMF format-1 export to disk |
| 07-how-layer-integration.ts | WHAT -> HOW contract (mock psysynth) |
| 08-determinism-demo.ts | Same seed -> byte-identical output |

```bash
bun run examples/01-basic-generation.ts
```

## Documentation

- docs/HOWTO.md - practical recipes
- docs/EXAMPLES.md - example-by-example guide
- docs/MIDI-INTEGRATION.md - SMF details + DAW import
- Live demo: https://dudududi144-source.github.io/psy-anthem/

## Listen in Browser

The live demo plays the generated anthem directly - no DAW required:

1. GENERATE ANTHEM (or change any control)
2. Press PLAY (optionally from a specific bar)
3. Click piano-roll notes to audition them
4. DOWNLOAD MIDI / DOWNLOAD JSON / COPY CONFIG for use elsewhere

Playback runs in web/synth.js (Web Audio, per-voice timbres, ADSR,
articulation-aware). The engine stays WHAT-layer; playback is presentation.

## Advanced Controls

| Control | Values | Effect |
|---------|--------|--------|
| intent EMOTIONAL_LEAD | enum | Step-friendly lyrical leads (M2, m3, M3, P4, P5 pool) |
| density | sparse / medium / dense | Note activity per bar |
| harmonyComplexity | simple / standard / complex | Progression language (adds secondary dominants at complex) |
| loopMode | on/off | Harmonic + melodic closure back to bar 1 |
| callResponse | on/off | Question/answer bar pairs (answer = motif sequenced up a step) |

The engine also applies arpeggio smoothing to the lead (leaps > P4 become
scale steps in the same direction), keeping melodies singable without losing
direction or register.

## Quality Bar
- All tests green, theory linter passes, memorability ≥ threshold.
- Determinism: same seed → identical output across 100 runs.
- Zero `console.log` / `Math.random` / `AudioContext` in `src/`.
