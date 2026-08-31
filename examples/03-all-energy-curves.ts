// PSY ANTHEM - examples/03-all-energy-curves.ts
// Run: bun run examples/03-all-energy-curves.ts
// Shows how the macro energy curve shapes the tension profile.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';

const base: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.PROGRESSIVE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
  bpm: 138,
};

const curves = [EnergyCurve.FLAT, EnergyCurve.ARC, EnergyCurve.BUILD_DROP, EnergyCurve.WAVE];

console.log('=== PSY ANTHEM - energy curves (seed ' + base.seed + ', 32 bars) ===');

for (const curve of curves) {
  const out = createAnthemEngine({ ...base, energyCurve: curve }).generate();
  if (!out) {
    console.log(String(curve).padEnd(12), 'FAILED');
    continue;
  }
  const t = out.harmonicAnalysis.tensionCurve;
  const peak = Math.max(...t);
  const peakBar = t.indexOf(peak);
  console.log(String(curve).padEnd(12),
    'peak=' + peak.toFixed(2) + '@bar' + peakBar,
    'curve:', t.map((v) => v.toFixed(1)).join(' '));
}
