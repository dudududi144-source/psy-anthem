// PSY ANTHEM - examples/17-scene-morphing.ts
// Run: bun run examples/17-scene-morphing.ts
// Morphs an euphoric trance scene into a dark psy scene over 8 bars
// using a bezier (smoothstep) transition curve.
import { AnthemIntent, EnergyCurve } from '../src/types';
import type { AnthemConfig } from '../src/types';
import { SceneMorpher } from '../src/morphing/scene-morpher';

console.log('Scene Morphing Example');
console.log('======================\n');

const fromScene: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 32,
  bpm: 140,
};

const toScene: AnthemConfig = {
  seed: 137,
  intent: AnthemIntent.DARK_PSY,
  scale: { root: 3, mode: 'phrygian' },
  energyCurve: EnergyCurve.BUILD_DROP,
  targetRange: { min: 36, max: 96 },
  voices: 4,
  bars: 32,
  bpm: 145,
};

const morpher = new SceneMorpher();
morpher.loadScenes({ fromScene, toScene, durationBars: 8, curve: 'bezier' });
console.log('Scenes loaded, starting morph...\n');

for (let bar = 0; bar <= 8; bar++) {
  const progress = bar / 8;
  morpher.updateProgress(progress);

  const state = morpher.getState();
  const events = morpher.getEventsAtPosition(bar * 4); // 4 beats per bar

  console.log('Bar ' + String(bar).padStart(2) + '/8:');
  console.log('  progress:   ' + (state.progress * 100).toFixed(1) + '%');
  console.log('  events:     ' + events.length);
  console.log('  config:     ' + (state.currentConfig ? state.currentConfig.intent + ' @ ' + state.currentConfig.bpm + ' bpm, ' + state.currentConfig.voices + ' voices' : '-'));
  console.log('  state:      ' + (state.completed ? 'completed' : state.isTransitioning ? 'transitioning' : 'idle'));
  console.log('');
}

console.log('Morph complete!');
