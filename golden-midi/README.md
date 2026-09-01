# Golden MIDI Files

10 canonical MIDI files generated from deterministic seeds by scripts/generate-golden.ts. They serve as:
- Regression tests: byte-identical output across runs (tests/golden-midi/golden-files.test.ts)
- Manual review: open in any DAW to verify musical quality
- Reference implementations: what good output looks like for each intent/curve

## The Collection

| File | Seed | Intent | Energy Curve | Scale | Voices | Bars | BPM |
|------|------|--------|--------------|-------|--------|------|-----|
| seed-42-euphoric-trance.mid | 42 | euphoric-trance | ARC | C minor | 3 | 32 | 140 |
| seed-137-dark-psy.mid | 137 | dark-psy | BUILD_DROP | D phrygian | 3 | 32 | 145 |
| seed-256-progressive.mid | 256 | progressive | WAVE | E dorian | 3 | 32 | 128 |
| seed-512-full-on.mid | 512 | full-on | ARC | F minor | 4 | 32 | 142 |
| seed-1024-emotional.mid | 1024 | emotional-breakdown | ARC | A minor | 2 | 24 | 120 |
| seed-2048-forest.mid | 2048 | forest | WAVE | G harmonic minor | 3 | 32 | 148 |
| seed-4096-arc-curve.mid | 4096 | euphoric-trance | ARC | C major | 3 | 32 | 140 |
| seed-8192-build-drop.mid | 8192 | full-on | BUILD_DROP | C minor | 4 | 64 | 140 |
| seed-16384-wave.mid | 16384 | progressive | WAVE | D dorian | 3 | 32 | 132 |
| seed-32768-custom.mid | 32768 | euphoric-trance | CUSTOM (double-drop) | A minor | 4 | 48 | 140 |

The CUSTOM file uses the double-drop envelope: early peak at 20%, breakdown at 50%, final peak at 80%.

## How to Use

### Manual review (the point of this folder)
1. Open any .mid file in your DAW (Ableton, FL Studio, Logic, Reaper - see docs/DAW-INTEGRATION.md).
2. Verify: tempo matches the BPM column, time signature reads 4/4, one track per voice.
3. Listen for: a repeating motif, functional chord motion, a build/release that matches the curve column.
4. Check: no parallel fifths/octaves, all notes in the stated scale.

### Automated verification
```bash
bun test tests/golden-midi/golden-files.test.ts
```
Each test regenerates the anthem from its seed and compares the SMF bytes to the committed file. Any change to the engine or the SMF encoder that alters output will fail here by design.

### Regenerating
```bash
bun run scripts/generate-golden.ts
```
Or via CI (no local environment needed): Actions -> Golden Regenerate -> Run workflow.

## Rules
- Never hand-edit a .mid in this folder. They are generated artifacts.
- If a golden test fails after an intentional engine change, regenerate deliberately and review the diff by ear before committing.
