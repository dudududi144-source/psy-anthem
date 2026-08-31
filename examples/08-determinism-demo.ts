// PSY ANTHEM - examples/08-determinism-demo.ts
// Run: bun run examples/08-determinism-demo.ts
// Two independent engine instances, same seed -> byte-identical output.
// This is the core guarantee that makes psy-anthem testable and shareable.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';
import { toMidi } from '../src/export';

const config: AnthemConfig = {
  seed: 31337,
  intent: AnthemIntent.DARK_PSY,
  scale: { root: 2, mode: 'phrygian' },
  energyCurve: EnergyCurve.BUILD_DROP,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
  bpm: 145,
};

console.log('=== PSY ANTHEM - determinism demo (seed ' + config.seed + ') ===');

const runA = createAnthemEngine(config).generate()!;
const runB = createAnthemEngine(config).generate()!;

const eventsA = JSON.stringify(runA.events);
const eventsB = JSON.stringify(runB.events);
const midiA = toMidi(runA, { bpm: 145 });
const midiB = toMidi(runB, { bpm: 145 });

console.log('events identical:   ' + (eventsA === eventsB));
console.log('motif identical:    ' + (JSON.stringify(runA.motifDNA) === JSON.stringify(runB.motifDNA)));
console.log('harmony identical:  ' + (JSON.stringify(runA.harmonicAnalysis) === JSON.stringify(runB.harmonicAnalysis)));
console.log('MIDI bytes match:   ' + (midiA.length === midiB.length && Array.from(midiA).every((b, i) => b === midiB[i])));
console.log('MIDI size:          ' + midiA.length + ' bytes');
console.log('');

// And a different seed MUST differ:
const runC = createAnthemEngine({ ...config, seed: 31338 }).generate()!;
console.log('different seed differs: ' + (JSON.stringify(runC.events) !== eventsA));
