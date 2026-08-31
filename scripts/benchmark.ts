// PSY ANTHEM - scripts/benchmark.ts
// Performance benchmark. Run: bun run bench
import { createAnthemEngine } from '../src/index';
import { AnthemIntent, EnergyCurve } from '../src/types';

const CONFIGS = [
  { bars: 16, voices: 2, label: 'Small (16x2)' },
  { bars: 32, voices: 3, label: 'Medium (32x3)' },
  { bars: 64, voices: 4, label: 'Large (64x4)' },
  { bars: 128, voices: 4, label: 'Max (128x4)' },
];
const RUNS = 30;
const TARGET_AVG = 50;
const TARGET_MAX = 100;

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

function main(): void {
  console.log('PSY ANTHEM - Performance Benchmark');
  console.log('==================================');
  console.log('Target: avg <' + TARGET_AVG + 'ms, max <' + TARGET_MAX + 'ms');
  let allPass = true;
  for (const cfg of CONFIGS) {
    const times: number[] = [];
    let nulls = 0;
    for (let i = 0; i < RUNS; i++) {
      const engine = createAnthemEngine({
        seed: 1000 + i,
        intent: AnthemIntent.EUPHORIC_TRANCE,
        scale: { root: 0, mode: 'minor' },
        energyCurve: EnergyCurve.ARC,
        targetRange: { min: 48, max: 84 },
        voices: cfg.voices,
        bars: cfg.bars,
        bpm: 140,
      });
      const start = Date.now();
      const out = engine.generate();
      times.push(Date.now() - start);
      if (!out) nulls++;
    }
    let sum = 0;
    for (const t of times) sum += t;
    const avg = sum / times.length;
    const p95 = percentile(times, 95);
    const p99 = percentile(times, 99);
    const max = Math.max(...times);
    const min = Math.min(...times);
    const ok = max <= TARGET_MAX && avg <= TARGET_AVG;
    if (!ok) allPass = false;
    console.log(cfg.label + ':');
    console.log('  avg=' + avg.toFixed(1) + 'ms  p95=' + p95.toFixed(1) + 'ms  p99=' + p99.toFixed(1) + 'ms  min=' + min + 'ms  max=' + max + 'ms  nulls=' + nulls + '  ' + (ok ? 'PASS' : 'FAIL'));
  }
  if (!allPass) process.exit(1);
}

main();
