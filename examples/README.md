# PSY ANTHEM — Examples

Eight runnable programs covering the full public API. All examples run with bun from the repo root:

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

## Notes

- Everything is WHAT-layer: no audio is produced. To hear the results, import the MIDI into a DAW or feed the events to a HOW device (psysynth / PsySynthPro).
- Every example is deterministic — running it twice prints identical results.
- Example 06 writes to examples/out/ (created automatically).
