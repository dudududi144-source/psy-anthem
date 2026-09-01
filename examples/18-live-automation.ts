// PSY ANTHEM - examples/18-live-automation.ts
// Run: bun run examples/18-live-automation.ts
// Live parameter automation over PSYBUS: velocity fades 1.0 -> 0.3 over
// 8 beats (exponential curve), then the automation auto-completes.
import { PsyAnthemAdapter } from '../src/integration/psybus-adapter';
import type { PsyBusEnvelope } from '../src/integration/psybus-types';
import { AnthemIntent, EnergyCurve } from '../src/types';

console.log('Live Automation Example');
console.log('=======================\n');

const messages: PsyBusEnvelope[] = [];
const adapter = new PsyAnthemAdapter({
  deviceId: 'anthem-001',
  seed: 42,
  send: (msg) => messages.push(msg),
});

// Load scene + start playback.
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
      bars: 16,
      bpm: 140,
    },
  },
});
adapter.handleMessage({ type: 'transport.play', deviceId: 'anthem-001', payload: { position: 0 } });

// Velocity automation: 1.0 -> 0.3 over 8 beats (exponential).
adapter.handleMessage({
  type: 'automation.start',
  deviceId: 'anthem-001',
  payload: { param: 'velocity', startValue: 1.0, endValue: 0.3, duration: 8, curve: 'exponential' },
});
console.log('Automation started: velocity 1.0 -> 0.3 over 8 beats (exponential)\n');

for (let beat = 0; beat < 16; beat++) {
  adapter.handleMessage({
    type: 'transport.position',
    deviceId: 'anthem-001',
    payload: { position: beat },
  });

  const batches = messages.filter(
    (m) => m.payload.kind === 'composition.events' && (m.payload as { position: number }).position === beat,
  );
  const batch = batches[batches.length - 1];
  if (batch) {
    const notes = (batch.payload as { events: Array<{ type: string; data: { velocity: number } }> }).events
      .filter((e) => e.type === 'note');
    if (notes.length > 0) {
      const avg = notes.reduce((s, e) => s + e.data.velocity, 0) / notes.length;
      const active = adapter.isAutomationActive('velocity') ? 'automation ON ' : 'automation OFF';
      console.log('Beat ' + String(beat + 1).padStart(2) + '/16: avg velocity = ' + avg.toFixed(1).padStart(5) + '  [' + active + ']');
    }
  }
}

console.log('\nAutomation complete - velocities restored after beat 8.');
