# PSY ANTHEM — Examples

Thirteen runnable programs covering the full public API. All examples run with bun from the repo root:

```bash
bun install
bun run examples/01-basic-generation.ts
```

## The list

| File | Shows | Output |
|------|-------|--------|
| 01-basic-generation.ts | Minimal config → full AnthemOutput | summary print |
| 02-all-intents.ts | All 6 genre intents, same seed | comparison table |
| 03-all-energy-curves.ts | FLAT / ARC / BUILD_DROP / WAVE | tension curves |
| 04-scale-exploration.ts | 7 modes × 2 roots | motif per scale |
| 05-custom-energy-curve.ts | User-defined double-drop envelope | tension grid |
| 06-export-midi.ts | SMF format-1 export | examples/out/psy-anthem-demo.mid |
| 07-how-layer-integration.ts | WHAT → HOW contract (mock psysynth) | dispatch report |
| 08-determinism-demo.ts | Same seed → byte-identical output (incl. MIDI bytes) | pass/fail |
| 09-ab-testing.ts | Algorithm A/B comparison + parameter sensitivity | comparison report |
| 11-emotional-lead.ts | Step-friendly EMOTIONAL_LEAD intent vs euphoric | stepwise comparison |
| 12-loop-mode.ts | loopMode harmonic + melodic closure | closure check |
| 13-call-response.ts | Question/answer bar structure | occurrence map |

## Notes

- Everything is WHAT-layer: no audio is produced. To hear the results, import the MIDI into a DAW or feed the events to a HOW device (psysynth / PsySynthPro).
- Every example is deterministic — running it twice prints identical results.
- Example 06 writes to examples/out/ (created automatically).
- Example 09 compares the standard engine against the strict leap-recovery variant and sweeps the voices parameter, printing a full quality-score delta report.
