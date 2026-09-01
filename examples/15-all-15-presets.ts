// PSY ANTHEM - examples/15-all-15-presets.ts
// Run: bun run examples/15-all-15-presets.ts
// Prints the full 15-preset arsenal and verifies every technique resolves
// to at least one known synthesis engine. Then generates one anthem and
// reports its artistic quality.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';
import { PRESETS_V2, PRESET_CATEGORIES, DEFAULT_VOICE_PRESETS } from '../web/presets.js';

const KNOWN_ENGINES = ['FM', 'Additive', 'Granular', 'Wavetable', 'Physical', 'Glitch'];

console.log('All 15 Presets Arsenal');
console.log('======================');
console.log('');

let ok = 0;
for (const cat of Object.keys(PRESET_CATEGORIES)) {
  console.log('[' + cat.toUpperCase() + ']');
  for (const id of (PRESET_CATEGORIES as Record<string, string[]>)[cat]!) {
    const preset = PRESETS_V2[id];
    const parts = String(preset.technique).split('+').map((s: string) => s.trim());
    const engines = parts.filter((p: string) => KNOWN_ENGINES.includes(p));
    const valid = engines.length >= 1;
    if (valid) ok++;
    const def = (Object.values(DEFAULT_VOICE_PRESETS) as string[]).includes(id) ? '  [default]' : '';
    console.log('  ' + (valid ? 'OK ' : 'BAD') + ' ' + preset.name.padEnd(15) + ' technique=' + preset.technique + def);
    console.log('       ' + preset.description);
  }
  console.log('');
}

console.log('Valid presets: ' + ok + ' / ' + Object.keys(PRESETS_V2).length);
console.log('');

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 16,
  bpm: 140,
};
const out = createAnthemEngine(config).generate();
if (!out) {
  console.error('generation failed');
  process.exit(1);
}
console.log('Generated anthem: ' + out.events.length + ' events');
console.log('Artistic quality: ' + out.metadata.artisticQuality + '/100');
console.log('');
console.log('Load these presets in the browser demo via the Voice Presets dropdowns.');
