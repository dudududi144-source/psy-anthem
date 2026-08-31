# PSY ANTHEM — Examples Guide

All examples live in examples/ and run with bun from the repo root.

## 01 — Basic generation

```bash
bun run examples/01-basic-generation.ts
```
Generates a 32-bar euphoric trance anthem (C minor, ARC curve, 3 voices) and prints events, chord count, tension curve, motif DNA, memorability and quality.

## 02 — All intents

```bash
bun run examples/02-all-intents.ts
```
Same seed through all six intents (euphoric-trance, dark-psy, progressive, full-on, emotional-breakdown, forest). Shows how intent alone changes interval pools and rhythm character.

## 03 — All energy curves

```bash
bun run examples/03-all-energy-curves.ts
```
FLAT / ARC / BUILD_DROP / WAVE with the same seed. Prints where the tension peak lands for each curve.

## 04 — Scale exploration

```bash
bun run examples/04-scale-exploration.ts
```
Seven modes on two roots. Shows the resulting motif pitches per scale — proof the generator respects any ScaleDefinition.

## 05 — Custom energy curve

```bash
bun run examples/05-custom-energy-curve.ts
```
A user-defined double-drop envelope (EnergyCurve.CUSTOM + customCurve points). Prints the requested envelope vs the resulting per-bar tension.

## 06 — MIDI export

```bash
bun run examples/06-export-midi.ts
```
Encodes SMF format 1 and writes examples/out/psy-anthem-demo.mid. Prints header facts (format, track count, division).

## 07 — HOW-layer integration (mock psysynth)

```bash
bun run examples/07-how-layer-integration.ts
```
Simulates a psysynth-style device consuming AnthemOutput: per-channel dispatch, patch selection, articulation counts, and a zero-dropped-events contract check.

## 08 — Determinism demo

```bash
bun run examples/08-determinism-demo.ts
```
Two independent engine runs with the same seed: events, motif, harmony and even the MIDI byte stream must be identical. A different seed must differ.
