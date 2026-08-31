// PSY ANTHEM - examples/06-export-midi.ts
// Run: bun run examples/06-export-midi.ts
// Writes a real Standard MIDI File (format 1) that any DAW can import.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';
import { toMidi, writeMidiFile } from '../src/export';

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 4,   // lead + harmony + counter + bass -> 4 MIDI tracks
  bars: 32,
  bpm: 140,
};

const out = createAnthemEngine(config).generate();
if (!out) {
  console.error('generation failed');
  process.exit(1);
}

// In-memory encoding (inspect the bytes yourself)
const bytes = toMidi(out, { bpm: config.bpm ?? 140 });
console.log('=== PSY ANTHEM - MIDI export ===');
console.log('SMF bytes:     ', bytes.length);
console.log('header:        ', Array.from(bytes.slice(0, 4)).map((b) => String.fromCharCode(b)).join(''));
console.log('format:        ', (bytes[8]! << 8) | bytes[9]!, '(multi-track)');
console.log('tracks:        ', (bytes[10]! << 8) | bytes[11]!, '(one per voice)');
console.log('division:      ', (bytes[12]! << 8) | bytes[13]!, 'ticks/quarter');

// Write to disk
const path = 'examples/out/psy-anthem-demo.mid';
const written = writeMidiFile(out, path, { bpm: config.bpm ?? 140 });
console.log('written to:    ', path, '(' + written + ' bytes)');
console.log('');
console.log('Import this file into any DAW (Ableton, FL Studio, Logic, Reaper...).');
console.log('Tracks: ch0 Lead (GM 0), ch1 Harmony (GM 80), ch2 Counter (GM 24), ch3 Bass (GM 33).');
