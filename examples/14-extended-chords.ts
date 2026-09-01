// PSY ANTHEM - examples/14-extended-chords.ts
// Run: bun run examples/14-extended-chords.ts
// Generates with harmonyComplexity 'complex' and prints the chord list +
// the artistic quality report (extended 9/11/13 chords).
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.PROGRESSIVE,
  scale: { root: 0, mode: 'dorian' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
  bpm: 140,
  harmonyComplexity: 'complex',
};

const out = createAnthemEngine(config).generate();
if (!out) {
  console.error('generation failed');
  process.exit(1);
}

console.log('Extended Chords Example');
console.log('=======================');
console.log('');
console.log('Chords:');
for (let i = 0; i < out.harmonicAnalysis.chords.length; i++) {
  const c = out.harmonicAnalysis.chords[i]!;
  console.log('  Bar ' + String(c.startBar + 1).padStart(2) + ': ' + NAMES[c.root] + ' ' + c.quality + ' (' + c.durationBars + ' bar' + (c.durationBars > 1 ? 's' : '') + ')');
}

const extended = out.harmonicAnalysis.chords.filter((c) =>
  c.quality.includes('9') || c.quality.includes('11') || c.quality.includes('13'),
).length;
console.log('');
console.log('Extended chords found: ' + extended + ' / ' + out.harmonicAnalysis.chords.length);
console.log('');

const m = out.metadata;
console.log('Artistic Quality: ' + m.artisticQuality + '/100');
const bd = m.artisticBreakdown;
if (bd) {
  console.log('  melodicInterest:   ' + bd.melodicInterest.toFixed(2));
  console.log('  harmonicRichness:  ' + bd.harmonicRichness.toFixed(2));
  console.log('  rhythmicVariety:   ' + bd.rhythmicVariety.toFixed(2));
  console.log('  texturalDepth:     ' + bd.texturalDepth.toFixed(2));
  console.log('  emotionalArc:      ' + bd.emotionalArc.toFixed(2));
}
if ((m.artisticIssues ?? []).length > 0) {
  console.log('Issues:');
  for (const issue of m.artisticIssues ?? []) console.log('  ! ' + issue);
}
if ((m.artisticSuggestions ?? []).length > 0) {
  console.log('Suggestions:');
  for (const s of m.artisticSuggestions ?? []) console.log('  > ' + s);
}
