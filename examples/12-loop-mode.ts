// PSY ANTHEM - examples/12-loop-mode.ts
// Run: bun run examples/12-loop-mode.ts
// loopMode makes the last bar connect back to the first:
// - the final chord becomes the opening chord (harmonic closure)
// - the last lead bar restates the opening material
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};

const off = createAnthemEngine(base).generate()!;
const on = createAnthemEngine({ ...base, loopMode: true }).generate()!;

const chordsOff = off.harmonicAnalysis.chords;
const chordsOn = on.harmonicAnalysis.chords;

console.log('=== PSY ANTHEM - loop mode ===');
console.log('without loop: first chord root=' + chordsOff[0]!.root + ', last chord root=' + chordsOff[chordsOff.length - 1]!.root);
console.log('with loop:    first chord root=' + chordsOn[0]!.root + ', last chord root=' + chordsOn[chordsOn.length - 1]!.root);
console.log('harmonic closure: ' + (chordsOn[0]!.root === chordsOn[chordsOn.length - 1]!.root ? 'PASS' : 'FAIL'));

const leadOff = off.events.filter((e) => e.type === 'note' && e.channel === 0);
const leadOn = on.events.filter((e) => e.type === 'note' && e.channel === 0);
console.log('lead notes: off=' + leadOff.length + ', loop=' + leadOn.length);
console.log('tip: export both with scripts/cli.ts --loop flag equivalents and listen to the seam.');
