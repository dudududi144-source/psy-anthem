// PSY ANTHEM - examples/16-psybus-integration.ts
// Run: bun run examples/16-psybus-integration.ts
//
// The full closed loop, headless:
//   psy-anthem (composition) -> PSYBUS -> mock synth device (audio stand-in)
// Transport is driven by simulated clock ticks, like psyboss's AudioWorklet clock.

import { AnthemIntent, EnergyCurve } from '../src/index';
import { PsyAnthemAdapter, InMemoryPSYBUS } from '../src/integration';
import type { AnthemConfig, NoteData } from '../src/types';

console.log('PSYBUS Integration Example');
console.log('==========================');
console.log('');

// 1. The bus
const bus = new InMemoryPSYBUS(42);

// 2. The anthem adapter (composition engine as a bus participant)
const anthem = new PsyAnthemAdapter({
  deviceId: 'anthem-001',
  seed: 42,
  send: (msg) => bus.publish(msg),
});
bus.register('anthem-001');

// 3. A mock synth device: subscribes to note envelopes and "plays" them
let notesHeard = 0;
let ducksHeard = 0;
bus.subscribe('synth-001', (e) => e.payload.kind === 'note', (e) => {
  const p = e.payload as { note: number; vel: number; durBeats: number; channel: number };
  notesHeard++;
  if (notesHeard <= 8) {
    console.log('  [synth] note=' + p.note + ' vel=' + p.vel + ' dur=' + p.durBeats + ' ch=' + p.channel);
  }
});
bus.subscribe('synth-001', (e) => e.payload.kind === 'sidechain.duck', () => {
  ducksHeard++;
});
bus.register('synth-001');

// 4. Load a scene through the adapter control plane
const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 3,
  bars: 8,
  bpm: 140,
  harmonyComplexity: 'complex',
};

console.log('[boss] scene.load -> anthem-001');
anthem.loadScene('scene-001', config);

const loaded = bus.delivered.find((e) => e.payload.kind === 'scene.loaded');
if (!loaded) {
  console.error('scene failed to load');
  process.exit(1);
}
const meta = (loaded.payload as { metadata: { artisticQuality?: number; memorabilityScore: number; quality: string } }).metadata;
console.log('[boss] scene loaded: quality=' + meta.quality + ' artistic=' + meta.artisticQuality + ' memorability=' + meta.memorabilityScore);
console.log('');

// 5. Play + drive the clock (simulated AudioWorklet ticks: 16ths)
console.log('[boss] transport.start');
anthem.play(0);

const totalBeats = config.bars * 4;
const stepBeats = 0.25;
console.log('[boss] driving ' + (totalBeats / stepBeats) + ' clock ticks...');
for (let pos = stepBeats; pos <= totalBeats; pos += stepBeats) {
  anthem.handleEnvelope({
    rev: 0, seed: 42, src: 'boss', dst: 'broadcast', ts: 0,
    payload: { kind: 'transport', bpm: 140, beat: pos % 4, bar: Math.floor(pos / 4), phase: pos % 1, playing: true, audioTime: pos },
  });
}

// 6. Sidechain duck from the kick device
bus.broadcast({ kind: 'sidechain.duck', target: 'anthem', depth: 0.4, releaseMs: 120 }, 'drum-001');
anthem.handleEnvelope({
  rev: 0, seed: 42, src: 'drum-001', dst: 'broadcast', ts: 0,
  payload: { kind: 'sidechain.duck', target: 'anthem', depth: 0.4, releaseMs: 120 },
});

// 7. Telemetry
anthem.reportTelemetry();

// 8. Stop
anthem.stop();

console.log('');
console.log('[synth] notes heard:  ' + notesHeard);
console.log('[synth] ducks heard:  ' + ducksHeard);
const telemetry = bus.delivered.find((e) => e.payload.kind === 'device.telemetry');
if (telemetry) {
  const t = telemetry.payload as { events: number; quality: number | undefined; memorability: number; generationTime: number };
  console.log('[boss]  telemetry: events=' + t.events + ' quality=' + t.quality + ' memorability=' + t.memorability + ' genMs=' + t.generationTime);
}
console.log('');
console.log('Loop closed: psy-anthem -> PSYBUS -> synth device. ' + bus.delivered.length + ' envelopes delivered.');
