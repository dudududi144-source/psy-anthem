# Real-time Generative Evolution (Phase 13)

psy-anthem invents music while playing: the motif mutates and the harmony
substitutes on a transport-driven schedule. Fully deterministic per seed.

## Motif evolution (MotifEvolver)

Mutation types: **pitch** / **rhythm** / **interval** / **contour**.
Depths: shallow (1 mutation) / medium (2) / deep (3) per regeneration.

Constraints honored:
- preserveRhythm excludes rhythm mutations
- preserveContour excludes contour mutations
- maxIntervalChange clamps every pitch/interval mutation against the ORIGINAL note
- Contour reversals apply only if they stay inside maxIntervalChange
- A guaranteed pitch mutation makes every successful evolve() audible

## Harmonic evolution (HarmonicEvolver)

Substitutions (allowlist + per-chord probability):
- **tritone** — dominant7/13 root moved by a tritone
- **relative** — minor<->relative major (root +/-3)
- **parallel** — same root, major<->minor
- **chromatic** — approach the next chord from a half-step below (dominant7)

## How evolution becomes audible
On each regeneration the adapter remaps lead pitch classes through the evolved
motif, and transposes non-lead voices by substituted chord-root deltas inside
each chord window. The stored composition is never mutated.

## Bus messages

```ts
// host -> device
{ kind: 'realtime.enable', config: { enabled, motifEvolution, harmonicEvolution, regenerationIntervalBars } }
{ kind: 'realtime.evolve', force?: boolean }
{ kind: 'realtime.disable' }
// device -> host
{ kind: 'realtime.enabled' } / { kind: 'realtime.disabled' }
{ kind: 'realtime.evolved', bar, motifMutations, harmonicSubstitutions }
```

## Enabling over the flat message API

```ts
adapter.handleMessage({
  type: 'realtime.enable',
  deviceId: 'anthem-001',
  payload: {
    config: {
      enabled: true,
      motifEvolution: { mutationRate: 0.6, evolutionDepth: 'medium',
        constraints: { preserveRhythm: false, preserveContour: false, maxIntervalChange: 5 } },
      harmonicEvolution: { substitutionRate: 0.3, allowedSubstitutions: ['tritone', 'relative'] },
      regenerationIntervalBars: 4,
    },
  },
});
```

## With psyboss
PsyBossAnthemAdapter exposes enableRealtimeGeneration / disableRealtimeGeneration /
forceEvolution forwarding the envelopes to the hosted engine.

## Examples & tests
- examples/19-realtime-evolution.ts — automatic evolution every 4 bars
- examples/20-interactive-evolution.ts — conservative start + forced evolution
- tests/evolution/motif-evolver.test.ts — 8 tests
- tests/evolution/harmonic-evolver.test.ts — 9 tests
- tests/integration/psybus-realtime.test.ts — 7 adapter tests
