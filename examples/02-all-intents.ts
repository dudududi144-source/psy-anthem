// PSY ANTHEM - examples/02-all-intents.ts
// Run: bun run examples/02-all-intents.ts
// Generates one anthem per intent with the SAME seed, so you can compare
// how intent alone changes motif pools, rhythm character, and scoring.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';

const base: AnthemConfig = {
  seed: 777,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 24,
  bpm: 140,
};

console.log('=== PSY ANTHEM - all 6 intents (same seed ' + base.seed + ') ===');
console.log('intent'.padEnd(24), 'events'.padStart(7), 'chords'.padStart(7), 'memorability'.padStart(13), 'quality');

for (const intent of Object.values(AnthemIntent)) {
  const out = createAnthemEngine({ ...base, intent }).generate();
  if (!out) {
    console.log(String(intent).padEnd(24), 'FAILED');
    continue;
  }
  console.log(
    String(intent).padEnd(24),
    String(out.events.length).padStart(7),
    String(out.harmonicAnalysis.chords.length).padStart(7),
    String(out.metadata.memorabilityScore + '/100').padStart(13),
    out.metadata.quality,
  );
}
