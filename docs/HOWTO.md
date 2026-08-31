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
