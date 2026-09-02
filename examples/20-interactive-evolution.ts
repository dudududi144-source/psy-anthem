// PSY ANTHEM - examples/20-interactive-evolution.ts
// Run: bun run examples/20-interactive-evolution.ts
// Interactive control: start with conservative evolution, then the performer
// forces aggressive evolution mid-performance.
import { PsyAnthemAdapter } from '../src/integration/psybus-adapter';
import type { PsyBusEnvelope, RealtimeGenerationConfig } from '../src/integration/psybus-types';
import { AnthemIntent, EnergyCurve } from '../src/types';

console.log('Interactive Evolution Example');
console.log('=============================\n');

const messages: PsyBusEnvelope[] = [];
const adapter = new PsyAnthemAdapter({
  deviceId: 'anthem-001',
  seed: 42,
  send: (msg) => messages.push(msg),
});

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

// Conservative evolution: shallow mutations, rhythm preserved, every 8 bars.
const conservative: RealtimeGenerationConfig = {
  enabled: true,
  motifEvolution: {
    mutationRate: 0.3,
    evolutionDepth: 'shallow',
    constraints: { preserveRhythm: true, preserveContour: true, maxIntervalChange: 3 },
  },
  harmonicEvolution: { substitutionRate: 0.2, allowedSubstitutions: ['relative'] },
  regenerationIntervalBars: 8,
};
adapter.handleMessage({ type: 'realtime.enable', deviceId: 'anthem-001', payload: { config: conservative } });
adapter.handleMessage({ type: 'transport.play', deviceId: 'anthem-001', payload: { position: 0 } });
console.log('Playing with conservative evolution (8 bars)...\n');

for (let bar = 0; bar < 8; bar++) {
  adapter.handleMessage({ type: 'transport.position', deviceId: 'anthem-001', payload: { position: bar * 4 } });
}
console.log('Evolution events so far: ' + messages.filter((m) => m.payload.kind === 'realtime.evolved').length);

console.log('\nPerformer forces immediate evolution...');
adapter.handleMessage({ type: 'realtime.evolve', deviceId: 'anthem-001', payload: { force: true } });

for (let bar = 8; bar < 16; bar++) {
  adapter.handleMessage({ type: 'transport.position', deviceId: 'anthem-001', payload: { position: bar * 4 } });
}

const total = messages.filter((m) => m.payload.kind === 'realtime.evolved').length;
console.log('\nInteractive evolution complete! Total evolutions: ' + total);
