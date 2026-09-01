// PSY ANTHEM - examples/13-call-response.ts
// Run: bun run examples/13-call-response.ts
// callResponse shapes each section into question/answer pairs:
// even bars (relative to the section) state the motif, odd bars answer
// with the same material sequenced up a step.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.PROGRESSIVE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.WAVE,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 138,
  callResponse: true,
};

const out = createAnthemEngine(config).generate()!;

console.log('=== PSY ANTHEM - call and response ===');
console.log('motif occurrences (bar -> transform chain):');
for (const occ of out.motifDNA.occurrences) {
  const chain = occ.transformChain.map((t) => t.type).join('+') || 'raw';
  console.log('  bar ' + String(occ.bar + 1).padStart(2) + ': ' + chain);
}
console.log('');
console.log('listen for: even bars state the idea, odd bars answer a step higher.');
console.log('events: ' + out.events.length + ', quality: ' + out.metadata.quality);
