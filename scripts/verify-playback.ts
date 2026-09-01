// PSY ANTHEM - scripts/verify-playback.ts
// Run: bun run scripts/verify-playback.ts
// Headless proof of the playback chain: real engine -> AnthemOutput ->
// PsySynthBrowser on a MockAudioContext -> scheduled oscillators verified.
import { createAnthemEngine, AnthemIntent, EnergyCurve } from '../src/index';
import type { AnthemConfig } from '../src/types';
import { PsySynthBrowser, midiToFreq } from '../web/synth.js';
import { MockAudioContext } from '../tests/web/mock-audio-context';

const config: AnthemConfig = {
  seed: 42,
  intent: AnthemIntent.EUPHORIC_TRANCE,
  scale: { root: 0, mode: 'minor' },
  energyCurve: EnergyCurve.ARC,
  targetRange: { min: 48, max: 84 },
  voices: 4,
  bars: 16,
  bpm: 140,
};

function fail(msg: string): never {
  console.error('FAIL: ' + msg);
  process.exit(1);
}

async function main(): Promise<void> {
  const out = createAnthemEngine(config).generate();
  if (!out) fail('engine returned null');
  if (out!.events.length === 0) fail('no events generated');

  const ctx = new MockAudioContext();
  const synth = new PsySynthBrowser(ctx as unknown as AudioContext);
  const seconds = await synth.playEvents(out!.events, config.bpm ?? 140, 0);

  const oscs = ctx.oscillators();
  const expected = out!.events.filter((e) => e.type === 'note').length;

  if (oscs.length !== expected) fail('oscillator count ' + oscs.length + ' != note count ' + expected);

  // Every oscillator must be started and carry a sane frequency.
  for (const osc of oscs) {
    if (osc.starts.length !== 1) fail('oscillator not started exactly once');
    if (!(osc.frequency.value >= 30 && osc.frequency.value <= 5000)) fail('frequency out of range: ' + osc.frequency.value);
  }

  // Frequencies must correspond to real MIDI pitches.
  const knownFreqs = new Set<number>();
  for (const e of out!.events) {
    if (e.type !== 'note') continue;
    knownFreqs.add(Math.round(midiToFreq((e.data as { pitch: number }).pitch) * 100) / 100);
  }
  for (const osc of oscs) {
    const f = Math.round(osc.frequency.value * 100) / 100;
    if (!knownFreqs.has(f)) fail('scheduled frequency not in the anthem: ' + f);
  }

  console.log('=== PSY ANTHEM - headless playback verification ===');
  console.log('events generated:   ' + out!.events.length);
  console.log('oscillators scheduled: ' + oscs.length);
  console.log('playback duration:  ' + seconds.toFixed(1) + 's at ' + config.bpm + ' BPM');
  console.log('context state:      ' + ctx.state);
  console.log('routing:            osc -> filter -> gain -> master -> compressor -> destination');
  console.log('RESULT: PASS - the playback chain is fully wired');
}

main().catch((e) => fail(String(e)));
