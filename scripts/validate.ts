// PSY ANTHEM - scripts/validate.ts
// Generation grid validation. Run: bun run validate
import { createAnthemEngine } from '../src/index';
import { AnthemIntent, EnergyCurve } from '../src/types';
import type { AnthemConfig, AnthemOutput } from '../src/types';

const INTENTS = Object.values(AnthemIntent);
const CURVES = [EnergyCurve.ARC, EnergyCurve.BUILD_DROP, EnergyCurve.WAVE, EnergyCurve.FLAT];
const SEEDS = [42, 137, 256, 512, 1024, 2048, 4096, 8192];

interface Row {
  seed: number;
  intent: AnthemIntent;
  curve: EnergyCurve;
  ok: boolean;
  memorability: number;
  quality: string;
  timeMs: number;
  error?: string;
}

function baseConfig(seed: number, intent: AnthemIntent, curve: EnergyCurve): AnthemConfig {
  return {
    seed,
    intent,
    scale: { root: 0, mode: 'minor' },
    energyCurve: curve,
    targetRange: { min: 48, max: 84 },
    voices: 3,
    bars: 32,
    bpm: 140,
  };
}

function check(out: AnthemOutput): string | undefined {
  if (!out.events || out.events.length === 0) return 'no events';
  for (const e of out.events) {
    if (e.type !== 'note') continue;
    const d = e.data as { pitch?: number; velocity?: number };
    if (typeof d.pitch !== 'number' || d.pitch < 0 || d.pitch > 127) return 'bad pitch';
    if (typeof d.velocity !== 'number' || d.velocity < 0 || d.velocity > 127) return 'bad velocity';
  }
  if (out.metadata.generationTimeMs > 100) return 'slow: ' + out.metadata.generationTimeMs + 'ms';
  return undefined;
}

function main(): void {
  const rows: Row[] = [];
  let pass = 0;
  let fail = 0;
  for (const seed of SEEDS) {
    for (const intent of INTENTS) {
      for (const curve of CURVES) {
        const cfg = baseConfig(seed, intent, curve);
        try {
          const start = Date.now();
          const out = createAnthemEngine(cfg).generate();
          const timeMs = Date.now() - start;
          if (!out) {
            rows.push({ seed, intent, curve, ok: false, memorability: 0, quality: 'null', timeMs, error: 'generation returned null' });
            fail++;
            continue;
          }
          const error = check(out);
          if (error) {
            rows.push({ seed, intent, curve, ok: false, memorability: out.metadata.memorabilityScore, quality: out.metadata.quality, timeMs, error });
            fail++;
          } else {
            rows.push({ seed, intent, curve, ok: true, memorability: out.metadata.memorabilityScore, quality: out.metadata.quality, timeMs });
            pass++;
          }
        } catch (err) {
          rows.push({ seed, intent, curve, ok: false, memorability: 0, quality: 'error', timeMs: 0, error: String(err) });
          fail++;
        }
      }
    }
  }

  console.log('PSY ANTHEM - Validation Grid');
  console.log('============================');
  console.log('Total: ' + rows.length + '  Passed: ' + pass + '  Failed: ' + fail);
  const okRows = rows.filter((r) => r.ok);
  if (okRows.length > 0) {
    let tSum = 0;
    let mSum = 0;
    let tMax = 0;
    for (const r of okRows) {
      tSum += r.timeMs;
      mSum += r.memorability;
      if (r.timeMs > tMax) tMax = r.timeMs;
    }
    console.log('Avg time: ' + (tSum / okRows.length).toFixed(1) + 'ms  Max: ' + tMax + 'ms  Avg memorability: ' + (mSum / okRows.length).toFixed(1) + '/100');
  }
  const failures = rows.filter((r) => !r.ok);
  for (const f of failures.slice(0, 10)) {
    console.log('FAIL seed=' + f.seed + ' intent=' + f.intent + ' curve=' + f.curve + ': ' + f.error);
  }
  if (fail > 0) process.exit(1);
}

main();
