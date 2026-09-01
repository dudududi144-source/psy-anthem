// PSY ANTHEM - scripts/generate-golden.ts
// Regenerates the 10 golden MIDI files in golden-midi/.
// Run: bun run scripts/generate-golden.ts
// The golden files are byte-stability guards: tests/golden-midi/golden-files.test.ts
// re-generates each and compares byte-for-byte.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig, CustomCurvePoint } from '../src/types';
import { writeMidiFile } from '../src/export';

export interface GoldenSpec {
  file: string;
  description: string;
  config: AnthemConfig;
}

const doubleDrop: CustomCurvePoint[] = [
  { position: 0.0, energy: 0.25 },
  { position: 0.2, energy: 0.9 },
  { position: 0.35, energy: 0.95 },
  { position: 0.5, energy: 0.3 },
  { position: 0.65, energy: 0.6 },
  { position: 0.8, energy: 1.0 },
  { position: 1.0, energy: 0.2 },
];

export const GOLDEN_SPECS: GoldenSpec[] = [
  {
    file: 'seed-42-euphoric-trance.mid',
    description: 'Baseline anthem: euphoric trance, C minor, ARC, 3 voices',
    config: { seed: 42, intent: AnthemIntent.EUPHORIC_TRANCE, scale: { root: 0, mode: 'minor' }, energyCurve: EnergyCurve.ARC, targetRange: { min: 48, max: 84 }, voices: 3, bars: 32, bpm: 140 },
  },
  {
    file: 'seed-137-dark-psy.mid',
    description: 'Dark psy on D phrygian, BUILD_DROP, driving 145 BPM',
    config: { seed: 137, intent: AnthemIntent.DARK_PSY, scale: { root: 2, mode: 'phrygian' }, energyCurve: EnergyCurve.BUILD_DROP, targetRange: { min: 48, max: 84 }, voices: 3, bars: 32, bpm: 145 },
  },
  {
    file: 'seed-256-progressive.mid',
    description: 'Progressive on E dorian, WAVE curve, 128 BPM',
    config: { seed: 256, intent: AnthemIntent.PROGRESSIVE, scale: { root: 4, mode: 'dorian' }, energyCurve: EnergyCurve.WAVE, targetRange: { min: 48, max: 84 }, voices: 3, bars: 32, bpm: 128 },
  },
  {
    file: 'seed-512-full-on.mid',
    description: 'Full-on, F minor, ARC, 4 voices (adds bass)',
    config: { seed: 512, intent: AnthemIntent.FULL_ON, scale: { root: 5, mode: 'minor' }, energyCurve: EnergyCurve.ARC, targetRange: { min: 48, max: 84 }, voices: 4, bars: 32, bpm: 142 },
  },
  {
    file: 'seed-1024-emotional.mid',
    description: 'Emotional breakdown, A minor, 2 voices, 120 BPM',
    config: { seed: 1024, intent: AnthemIntent.EMOTIONAL_BREAKDOWN, scale: { root: 9, mode: 'minor' }, energyCurve: EnergyCurve.ARC, targetRange: { min: 48, max: 84 }, voices: 2, bars: 24, bpm: 120 },
  },
  {
    file: 'seed-2048-forest.mid',
    description: 'Forest psy on G harmonic minor, WAVE, 148 BPM',
    config: { seed: 2048, intent: AnthemIntent.FOREST, scale: { root: 7, mode: 'harmonicMinor' }, energyCurve: EnergyCurve.WAVE, targetRange: { min: 48, max: 84 }, voices: 3, bars: 32, bpm: 148 },
  },
  {
    file: 'seed-4096-arc-curve.mid',
    description: 'Major-mode euphoria: C major, ARC, 3 voices',
    config: { seed: 4096, intent: AnthemIntent.EUPHORIC_TRANCE, scale: { root: 0, mode: 'major' }, energyCurve: EnergyCurve.ARC, targetRange: { min: 48, max: 84 }, voices: 3, bars: 32, bpm: 140 },
  },
  {
    file: 'seed-8192-build-drop.mid',
    description: 'Long-form full-on: 64 bars, BUILD_DROP, 4 voices',
    config: { seed: 8192, intent: AnthemIntent.FULL_ON, scale: { root: 0, mode: 'minor' }, energyCurve: EnergyCurve.BUILD_DROP, targetRange: { min: 48, max: 84 }, voices: 4, bars: 64, bpm: 140 },
  },
  {
    file: 'seed-16384-wave.mid',
    description: 'Progressive D dorian, WAVE, 3 voices',
    config: { seed: 16384, intent: AnthemIntent.PROGRESSIVE, scale: { root: 2, mode: 'dorian' }, energyCurve: EnergyCurve.WAVE, targetRange: { min: 48, max: 84 }, voices: 3, bars: 32, bpm: 132 },
  },
  {
    file: 'seed-32768-custom.mid',
    description: 'CUSTOM double-drop envelope, A minor, 48 bars, 4 voices',
    config: { seed: 32768, intent: AnthemIntent.EUPHORIC_TRANCE, scale: { root: 9, mode: 'minor' }, energyCurve: EnergyCurve.CUSTOM, customCurve: doubleDrop, targetRange: { min: 48, max: 84 }, voices: 4, bars: 48, bpm: 140 },
  },
];

export function generateAllGolden(outDir: string): number {
  let total = 0;
  for (const spec of GOLDEN_SPECS) {
    const out = createAnthemEngine(spec.config).generate();
    if (!out) {
      throw new Error('golden generation failed for ' + spec.file);
    }
    const path = outDir + '/' + spec.file;
    const bytes = writeMidiFile(out, path, { bpm: spec.config.bpm ?? 140 });
    total += bytes;
    console.log(spec.file.padEnd(32), String(bytes).padStart(6) + ' bytes', 'mem=' + out.metadata.memorabilityScore, 'events=' + out.events.length);
  }
  return total;
}

if (import.meta.main) {
  console.log('=== PSY ANTHEM - generating golden MIDI files ===');
  const total = generateAllGolden('golden-midi');
  console.log('done: 10 files, ' + total + ' bytes total');
}
