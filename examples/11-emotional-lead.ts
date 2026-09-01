// PSY ANTHEM - examples/11-emotional-lead.ts
// Run: bun run examples/11-emotional-lead.ts
// The EMOTIONAL_LEAD intent uses a step-friendly interval pool (M2, m3, M3, P4, P5)
// for singable, lyrical melodies. Compare it against euphoric trance.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';
import { analyzeMelody } from '../src/validation';
import { analyzeVoiceLeadingFromEvents } from '../src/validation';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
  bpm: 140,
};

console.log('=== PSY ANTHEM - emotional lead vs euphoric trance ===');
console.log('intent'.padEnd(22), 'stepwise'.padStart(9), 'smoothness'.padStart(11), 'leaps'.padStart(6));

for (const intent of [AnthemIntent.EUPHORIC_TRANCE, AnthemIntent.EMOTIONAL_LEAD]) {
  const out = createAnthemEngine({ ...base, intent }).generate()!;
  const mel = analyzeMelody(out.events, { motifNotes: out.motifDNA.coreNotes, targetRange: base.targetRange });
  const vl = analyzeVoiceLeadingFromEvents(out.events, base.voices);
  console.log(String(intent).padEnd(22), String(Math.round(mel.stepwiseRatio * 100) + '%').padStart(9), String(vl.smoothness).padStart(11), String(mel.leaps.count).padStart(6));
}

console.log('');
console.log('EMOTIONAL_LEAD should show a higher stepwise ratio (more singable lead).');
