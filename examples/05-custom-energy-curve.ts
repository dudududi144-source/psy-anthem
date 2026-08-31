// PSY ANTHEM - examples/05-custom-energy-curve.ts
// Run: bun run examples/05-custom-energy-curve.ts
// A user-defined energy envelope: double-drop structure.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig, CustomCurvePoint } from '../src/types';

// Double-drop anthem: early peak, brief breakdown, final peak, outro.
const doubleDrop: CustomCurvePoint[] = [
  { position: 0.0, energy: 0.25 },
  { position: 0.2, energy: 0.9 },   // first drop
  { position: 0.35, energy: 0.95 },
  { position: 0.5, energy: 0.3 },   // breakdown
  { position: 0.65, energy: 0.6 },  // rebuild
  { position: 0.8, energy: 1.0 },   // final drop
  { position: 1.0, energy: 0.2 },   // outro
];

const config: AnthemConfig = {
  seed: 5150,
  intent: AnthemIntent.FULL_ON,
  scale: { root: 9, mode: 'minor' },   // A minor
  energyCurve: EnergyCurve.CUSTOM,
  customCurve: doubleDrop,
  targetRange: { min: 48, max: 84 },
  voices: 4,
  bars: 64,
  bpm: 142,
};

const out = createAnthemEngine(config).generate();
if (!out) {
  console.error('generation failed');
  process.exit(1);
}

const t = out.harmonicAnalysis.tensionCurve;
console.log('=== PSY ANTHEM - custom energy curve (double drop, 64 bars) ===');
console.log('requested envelope:', doubleDrop.map((p) => p.position + ':' + p.energy).join('  '));
console.log('resulting tension:');
// Print in 4-bar groups for readability
for (let b = 0; b < t.length; b += 4) {
  const slice = t.slice(b, b + 4).map((v) => v.toFixed(2)).join(' ');
  console.log('  bars ' + String(b).padStart(2) + '-' + String(Math.min(b + 3, t.length - 1)).padStart(2) + ': ' + slice);
}
console.log('events:', out.events.length, '| quality:', out.metadata.quality, '| mem:', out.metadata.memorabilityScore);
