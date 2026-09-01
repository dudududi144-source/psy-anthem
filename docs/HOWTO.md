# PSY ANTHEM — HOWTO

Practical recipes for using the composition engine.

## Install

```bash
git clone https://github.com/dudududi144-source/psy-anthem.git
cd psy-anthem
bun install
```

## 1. Generate an anthem in code

```ts
import { createAnthemEngine, AnthemIntent, EnergyCurve } from './src/index';

const out = createAnthemEngine({
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
  bpm: 140,
}).generate();

console.log(out.events.length); // MusicalEvent[]
```

## 2. Export to MIDI (for any DAW)

```ts
import { writeMidiFile } from './src/export';

writeMidiFile(out, 'my-anthem.mid', { bpm: 140 });
```

## 3. Use the CLI

```bash
bun scripts/cli.ts --seed 42 --intent euphoric-trance --bars 32 --output anthem.mid
bun scripts/cli.ts --seed 1337 --json > anthem.json
bun scripts/cli.ts --help
```

## 4. Run every example

```bash
for f in examples/0*.ts; do bun run "$f"; done
```

## 5. Tests and quality gates

```bash
bun test            # unit + integration (incl. SMF byte validation)
bun run typecheck   # strict TypeScript over src/
bun run validate    # generation grid: 8 seeds x 6 intents x 4 curves
bun run bench       # performance budget
```

## 6. Browser demo

The GitHub Pages demo visualizes generation in real time:
https://dudududi144-source.github.io/psy-anthem/

It is rebuilt from source on every push by .github/workflows/pages.yml.

## 7. Listen in the browser (no DAW needed)

The GitHub Pages demo now plays the anthem directly:

1. Open https://dudududi144-source.github.io/psy-anthem/
2. Set seed / intent / curve / controls, or leave defaults.
3. Press GENERATE ANTHEM (or just change any control - it regenerates).
4. Press PLAY. Choose a starting bar with the "from" dropdown to scrub.
5. Click any note in the piano roll to audition it.

Playback is a presentation layer (web/synth.js): a small Web Audio synth with
per-voice timbres (saw lead, square harmony, triangle counter, sine bass),
ADSR envelopes and articulation support. The engine itself stays WHAT-layer.

## 8. Download the results

- DOWNLOAD MIDI - a Standard MIDI File (format 1, one track per voice, tempo +
  program changes embedded), produced by a browser port of src/export/midi.ts.
- DOWNLOAD JSON - the full AnthemOutput (events, harmonic analysis, motif DNA,
  metadata) for offline processing.
- COPY CONFIG - the current AnthemConfig as JSON (for sharing seeds or filing bugs).

## 9. Advanced composition controls

| Control | Values | Effect |
|---------|--------|--------|
| density | sparse / medium / dense | Note activity per bar (sparse halves the lead, dense packs it x~1.6) |
| harmonyComplexity | simple / standard / complex | simple = I-IV-V language; complex adds secondary dominants |
| loopMode | on/off | Final chord resolves to the opening chord; last lead bar restates bar 1 |
| callResponse | on/off | Even bars state the motif, odd bars answer sequenced up a step |
| intent EMOTIONAL_LEAD | - | Step-friendly interval pool (M2, m3, M3, P4, P5) for lyrical, singable leads |

In code:

```ts
const out = createAnthemEngine({
  seed: 42,
  intent: AnthemIntent.EMOTIONAL_LEAD,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
  bpm: 140,
  density: 'medium',
  harmonyComplexity: 'complex',
  loopMode: true,
  callResponse: true,
}).generate();
```

Note: changing engine output intentionally invalidates golden MIDI files;
regenerate them with Actions -> Golden Regenerate (or bun run scripts/generate-golden.ts).
