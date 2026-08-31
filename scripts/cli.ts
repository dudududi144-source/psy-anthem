// PSY ANTHEM - scripts/cli.ts
// Command-line interface. Run with bun:
//   bun scripts/cli.ts --seed 42 --intent euphoric-trance --bars 32 --output anthem.mid
//   bun scripts/cli.ts --seed 1337 --json
//   bun scripts/cli.ts --help

import { createAnthemEngine } from '../src/index';
import { AnthemIntent, EnergyCurve } from '../src/types';
import type { AnthemConfig, ScaleMode } from '../src/types';
import { writeMidiFile } from '../src/export/midi';

export interface CliOptions {
  seed: number;
  intent: AnthemIntent;
  scaleRoot: number;
  scaleMode: ScaleMode;
  energyCurve: EnergyCurve;
  voices: number;
  bars: number;
  bpm: number;
  output: string | null;
  json: boolean;
}

const INTENTS: AnthemIntent[] = Object.values(AnthemIntent);
const CURVES: EnergyCurve[] = [
  EnergyCurve.FLAT, EnergyCurve.ARC, EnergyCurve.BUILD_DROP, EnergyCurve.WAVE, EnergyCurve.CUSTOM,
];
const MODES: ScaleMode[] = [
  'minor', 'major', 'dorian', 'phrygian', 'lydian',
  'mixolydian', 'harmonicMinor', 'melodicMinor', 'hungarianMinor', 'doubleHarmonicMajor',
];

export const HELP_TEXT = [
  'PSY ANTHEM CLI - deterministic anthem generator',
  '',
  'Usage: bun scripts/cli.ts [options]',
  '',
  'Options:',
  '  --seed <n>              deterministic seed (default 42)',
  '  --intent <name>         ' + INTENTS.join(' | '),
  '  --scale-root <0-11>     pitch class (default 0 = C)',
  '  --scale-mode <mode>     ' + MODES.join(' | ') + ' (default minor)',
  '  --energy-curve <name>   ' + CURVES.join(' | ') + ' (default arc)',
  '  --voices <1-4>          lead, harmony, counter, bass (default 3)',
  '  --bars <8-128>          composition length (default 32)',
  '  --bpm <n>               tempo for MIDI export (default 140)',
  '  --output <file>         write Standard MIDI File to this path',
  '  --json                  print the full AnthemOutput as JSON',
  '  --help                  show this help',
].join('\n');

function nextValue(argv: string[], i: number, flag: string): string {
  const v = argv[i + 1];
  if (v === undefined) throw new Error('Missing value for ' + flag);
  return v;
}

function parseIntArg(value: string, flag: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) throw new Error('Invalid number for ' + flag + ': ' + value);
  return n;
}
