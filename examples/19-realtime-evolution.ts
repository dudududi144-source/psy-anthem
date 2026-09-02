// PSY ANTHEM - examples/19-realtime-evolution.ts
// Run: bun run examples/19-realtime-evolution.ts
// Real-time generative evolution: the anthem invents new melody + harmony
// every 4 bars while "playing".
import { PsyAnthemAdapter } from '../src/integration/psybus-adapter';
import type { PsyBusEnvelope, RealtimeGenerationConfig } from '../src/integration/psybus-types';
import { AnthemIntent, EnergyCurve } from '../src/types';

console.log('Real-time Generative Evolution Example');
console.log('======================================\n');

const messages: PsyBusEnvelope[] = [];
const adapter = new PsyAnthemAdapter({
  deviceId: 'anthem-001',
  seed: 42,
  send: (msg) => messages.push(msg),
});

// Load scene.
adapter.handleMessage({
  type: 'scene.load',
  deviceId: 'anthem-001',
  payload: {
    sceneId: 'scene-001',
    config: {
      seed: 42,
      intent: AnthemIntent.EUPHORIC_TRANCE,
      scale: { root: 0, mode: 'minor' },
      energyCurve: EnergyCurve.ARC,
      targetRange: { min: 48, max: 84 },
      voices: 3,
      bars: 32,
      bpm: 140,
    },
  },
});

// Enable realtime generation.
const realtimeConfig: RealtimeGenerationConfig = {
  enabled: true,
  motifEvolution: {
    mutationRate: 0.6,
    evolutionDepth: 'medium',
    constraints: { preserveRhythm: false, preserveContour: false, maxIntervalChange: 5 },
  },
  harmonicEvolution: {
    substitutionRate: 0.3,
    allowedSubstitutions: ['tritone', 'relative', 'chromatic'],
  },
  regenerationIntervalBars: 4,
};
adapter.handleMessage({ type: 'realtime.enable', deviceId: 'anthem-001', payload: { config: realtimeConfig } });
adapter.handleMessage({ type: 'transport.play', deviceId: 'anthem-001', payload: { position: 0 } });
console.log('Realtime generation enabled, playing...\n');

for (let bar = 0; bar < 16; bar++) {
  adapter.handleMessage({
    type: 'transport.position',
    deviceId: 'anthem-001',
    payload: { position: bar * 4 },
  });
}

const evolutions = messages.filter((m) => m.payload.kind === 'realtime.evolved');
console.log('Evolution events: ' + evolutions.length);
for (const e of evolutions) {
  const p = e.payload as { bar: number; motifMutations: number; harmonicSubstitutions: number };
  console.log('  bar ' + String(p.bar).padStart(2) + ': motif mutations=' + p.motifMutations + ', harmonic substitutions=' + p.harmonicSubstitutions);
}
console.log('\nRealtime evolution complete!');
