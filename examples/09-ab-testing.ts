// PSY ANTHEM - examples/09-ab-testing.ts
// Run: bun run examples/09-ab-testing.ts
// A/B test: standard engine vs strict leap-recovery engine,
// plus a parameter sensitivity sweep over voice count.
import { AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';
import {
  standardAlgorithm,
  strictLeapRecoveryAlgorithm,
  compareAlgorithms,
  analyzeParameterSensitivity,
} from '../src/testing';

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
  bpm: 140,
};

console.log('=== PSY ANTHEM - A/B testing ===');
console.log('config: seed ' + config.seed + ', ' + config.intent + ', ' + config.bars + ' bars');
console.log('');

// 1. Algorithm comparison
const report = compareAlgorithms(
  config,
  standardAlgorithm,
  strictLeapRecoveryAlgorithm,
  'standard-engine',
  'strict-leap-recovery',
);

if (!report) {
  console.error('comparison failed: one of the algorithms returned null');
  process.exit(1);
}

console.log('--- comparison report ---');
for (const line of report.narrative) {
  console.log('  ' + line);
}
console.log('');

console.log('--- component scores ---');
const comps = Object.keys(report.reportA.componentScores);
console.log('metric'.padEnd(16), 'A'.padStart(5), 'B'.padStart(5), 'delta'.padStart(7));
for (const c of comps) {
  const key = c as keyof typeof report.reportA.componentScores;
  const a = report.reportA.componentScores[key];
  const b = report.reportB.componentScores[key];
  const d = b - a;
  const ds = (d > 0 ? '+' : '') + d;
  console.log(c.padEnd(16), String(a).padStart(5), String(b).padStart(5), ds.padStart(7));
}
console.log('overall'.padEnd(16), String(report.reportA.overall).padStart(5), String(report.reportB.overall).padStart(5), ((report.deltas['overall']! > 0 ? '+' : '') + report.deltas['overall']).padStart(7));
console.log('');

// 2. Parameter sensitivity: voices 1..4
console.log('--- sensitivity: voices 1..4 ---');
const sens = analyzeParameterSensitivity(config, 'voices', [1, 2, 3, 4]);
console.log('voices'.padEnd(8), 'overall'.padStart(8), 'singability'.padStart(12), 'variety'.padStart(8), 'arc'.padStart(6));
for (const row of sens.rows) {
  console.log(
    String(row.value).padEnd(8),
    String(row.overall).padStart(8),
    String(row.singability).padStart(12),
    String(row.variety).padStart(8),
    String(row.emotionalArc).padStart(6),
  );
}
console.log('most sensitive metric: ' + sens.mostSensitiveMetric);
