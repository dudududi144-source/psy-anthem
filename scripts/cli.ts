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

export function parseArgs(argv: string[]): CliOptions | 'help' {
  const opts: CliOptions = {
    seed: 42,
    intent: AnthemIntent.EUPHORIC_TRANCE,
    scaleRoot: 0,
    scaleMode: 'minor',
    energyCurve: EnergyCurve.ARC,
    voices: 3,
    bars: 32,
    bpm: 140,
    output: null,
    json: false,
  };

  let i = 0;
  while (i < argv.length) {
    const flag = argv[i]!;
    if (flag === '--help' || flag === '-h') return 'help';
    if (flag === '--json') { opts.json = true; i++; continue; }
    if (flag === '--seed') { opts.seed = parseIntArg(nextValue(argv, i, flag), flag); i += 2; continue; }
    if (flag === '--scale-root') { opts.scaleRoot = parseIntArg(nextValue(argv, i, flag), flag); i += 2; continue; }
    if (flag === '--voices') { opts.voices = parseIntArg(nextValue(argv, i, flag), flag); i += 2; continue; }
    if (flag === '--bars') { opts.bars = parseIntArg(nextValue(argv, i, flag), flag); i += 2; continue; }
    if (flag === '--bpm') { opts.bpm = parseIntArg(nextValue(argv, i, flag), flag); i += 2; continue; }
    if (flag === '--intent') {
      const v = nextValue(argv, i, flag) as AnthemIntent;
      if (!INTENTS.includes(v)) throw new Error('Unknown intent: ' + v + ' (valid: ' + INTENTS.join(', ') + ')');
      opts.intent = v;
      i += 2;
      continue;
    }
    if (flag === '--scale-mode') {
      const v = nextValue(argv, i, flag) as ScaleMode;
      if (!MODES.includes(v)) throw new Error('Unknown scale mode: ' + v);
      opts.scaleMode = v;
      i += 2;
      continue;
    }
    if (flag === '--energy-curve') {
      const v = nextValue(argv, i, flag) as EnergyCurve;
      if (!CURVES.includes(v)) throw new Error('Unknown energy curve: ' + v);
      opts.energyCurve = v;
      i += 2;
      continue;
    }
    if (flag === '--output') { opts.output = nextValue(argv, i, flag); i += 2; continue; }
    throw new Error('Unknown option: ' + flag + ' (see --help)');
  }
  return opts;
}

export function runCli(argv: string[]): number {
  let parsed: CliOptions | 'help';
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    console.error('error: ' + (e as Error).message);
    return 1;
  }
  if (parsed === 'help') {
    console.log(HELP_TEXT);
    return 0;
  }
  const opts = parsed;

  const config: AnthemConfig = {
    seed: opts.seed,
    intent: opts.intent,
    scale: { root: opts.scaleRoot, mode: opts.scaleMode },
    energyCurve: opts.energyCurve,
    targetRange: { min: 48, max: 84 },
    voices: opts.voices,
    bars: opts.bars,
    bpm: opts.bpm,
  };

  let out;
  try {
    out = createAnthemEngine(config).generate();
  } catch (e) {
    console.error('error: ' + (e as Error).message);
    return 1;
  }
  if (!out) {
    console.error('error: solver failed to satisfy hard constraints for this config');
    return 1;
  }

  if (opts.json) {
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  console.log('PSY ANTHEM');
  console.log('  seed:         ' + out.metadata.seed);
  console.log('  intent:       ' + out.metadata.intent);
  console.log('  bars/voices:  ' + out.metadata.bars + ' / ' + out.metadata.voices);
  console.log('  events:       ' + out.events.length);
  console.log('  chords:       ' + out.harmonicAnalysis.chords.length);
  console.log('  motif:        ' + out.motifDNA.coreNotes.join(' '));
  console.log('  memorability: ' + out.metadata.memorabilityScore + '/100 (' + out.metadata.quality + ')');

  const target = opts.output ?? ('psy-anthem-' + opts.seed + '.mid');
  const bytes = writeMidiFile(out, target, { bpm: opts.bpm });
  console.log('  midi:         ' + target + ' (' + bytes + ' bytes, format 1, division 480)');
  return 0;
}

if (import.meta.main) {
  process.exit(runCli(process.argv.slice(2)));
}
