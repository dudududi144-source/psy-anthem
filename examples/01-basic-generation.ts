// PSY ANTHEM - examples/01-basic-generation.ts
// Run: bun run examples/01-basic-generation.ts
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },          // C minor
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,                                    // lead + harmony + counter
  bars: 32,
  bpm: 140,
};

const engine = createAnthemEngine(config);
const out = engine.generate();

if (!out) {
  console.error('generation failed');
  process.exit(1);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function pitchName(p: number): string {
  return NOTE_NAMES[((p % 12) + 12) % 12] + String(Math.floor(p / 12) - 1);
}

console.log('=== PSY ANTHEM - basic generation ===');
console.log('config:', JSON.stringify({ seed: config.seed, intent: config.intent, bars: config.bars, voices: config.voices }));
console.log('events generated:   ', out.events.length);
console.log('chord progression:  ', out.harmonicAnalysis.chords.length, 'chords');
console.log('tension curve:      ', out.harmonicAnalysis.tensionCurve.map((t) => t.toFixed(2)).join(' '));
console.log('motif DNA (pitches):', out.motifDNA.coreNotes.map(pitchName).join(' -> '));
console.log('motif DNA (rhythm): ', out.motifDNA.coreRhythm.join(', '), 'beats');
console.log('memorability:       ', out.metadata.memorabilityScore + '/100');
console.log('quality:            ', out.metadata.quality);
console.log('generation time:    ', out.metadata.generationTimeMs + 'ms');

// Voice breakdown
const byVoice = new Map<number, number>();
for (const e of out.events) {
  byVoice.set(e.channel, (byVoice.get(e.channel) ?? 0) + 1);
}
console.log('notes per voice:    ', JSON.stringify(Object.fromEntries(byVoice)));
