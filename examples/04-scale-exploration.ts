// PSY ANTHEM - examples/04-scale-exploration.ts
// Run: bun run examples/04-scale-exploration.ts
// Same seed + intent across different modes and roots.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig, ScaleMode } from '../src/types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function pitchName(p: number): string {
  return NOTE_NAMES[((p % 12) + 12) % 12] + String(Math.floor(p / 12) - 1);
}

const base: AnthemConfig = {
  seed: 2024,
  intent: AnthemIntent.FOREST,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 145,
};

const modes: ScaleMode[] = ['minor', 'major', 'dorian', 'phrygian', 'lydian', 'harmonicMinor', 'hungarianMinor'];

console.log('=== PSY ANTHEM - scale exploration (seed ' + base.seed + ', forest) ===');

for (const mode of modes) {
  for (const root of [0, 7]) { // C and G
    const out = createAnthemEngine({ ...base, scale: { root, mode } }).generate();
    if (!out) {
      console.log((NOTE_NAMES[root] + ' ' + mode).padEnd(20), 'FAILED');
      continue;
    }
    const motif = out.motifDNA.coreNotes.map(pitchName).join(' ');
    console.log((NOTE_NAMES[root] + ' ' + mode).padEnd(20),
      'events=' + String(out.events.length).padStart(4),
      'mem=' + String(out.metadata.memorabilityScore).padStart(3),
      'motif:', motif);
  }
}
