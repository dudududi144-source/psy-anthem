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

## Quality Bar
- All tests green, theory linter passes, memorability ≥ threshold.
- Determinism: same seed → identical output across 100 runs.
- Zero `console.log` / `Math.random` / `AudioContext` in `src/`.
