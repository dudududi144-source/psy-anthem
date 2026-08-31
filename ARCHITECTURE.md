# PSY ANTHEM — Architecture
Version 0.1.0 · Design complete, implementation Phase 0 green.

## Position
WHAT layer between hosts (above) and psy-foundation (below, via pinned shim). HOW devices render the output.

```
HOSTS (PSY6-ULTIMATE, psystar, demo pages)
          |  request: generate an anthem
          v
PSY ANTHEM (this repo) — pure WHAT layer
          |  MusicalEvent[] + analysis
          v
psy-foundation (pinned shim: protocol, transport, music)
          v
HOW devices (psysynth, PsySynthPro, psydrum, psy-sampler)
```

## Module Map
```
src/
├── index.ts          # createAnthemEngine(config) → AnthemEngine
├── types.ts          # all input/output/internal types
├── constants.ts      # intervals, scales, intent pools, budgets
├── engine.ts         # pipeline orchestrator
├── rng.ts            # mulberry32 + deriveSeeds
├── motif/            # generator · transformer · scorer
├── harmony/          # voice-leading · progressions · tension · intervals
├── structure/        # energy-curve · macro-form · section-planner
├── expression/       # humanize · articulation · dynamics
├── solver/           # constraint-solver · objective · validator
└── foundation-shim/  # protocol · transport (verbatim, pinned)
```

## Determinism Model
- Single mulberry32(seed) source; no Math.random.
- No global mutable state; no Date.now() in the generation path.
- Fully synchronous pipeline.
- performance.now() used ONLY for metadata.generationTimeMs (excluded from determinism comparisons).

## CSP Model
- Variables = note positions; Domains = valid scale pitches/durations.
- Hard: scale membership, range, parallel 5/8 ban, leading-tone resolution, voice crossing, chord tone on downbeat.
- Soft: stepwise preference, leap recovery, consonance, motif alignment, contour, rhythmic variety.
- Solver: variable ordering by domain size, heuristic value ordering, backtracking, 50ms budget.

## Performance Budget
| Op | Target | Hard limit |
|----|--------|------|
| Motif generation | <1ms | 5ms |
| Voice leading (32 bars × 3 voices) | <20ms | 50ms |
| Full anthem (32 bars × 3 voices) | <50ms | 100ms |

## Foundation Shim
Contracts arrive verbatim in src/foundation-shim/, pinned by commit hash in FOUNDATION_API.md. Never import psy-foundation directly.
